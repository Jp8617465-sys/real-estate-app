/**
 * Cached Service Layer
 *
 * Wraps frequently queried data with Redis caching, background refresh,
 * and cache warming on startup for critical data paths.
 *
 * TTL strategy per entity type:
 *   - Contact list with filters: 30s (frequently updated by agents)
 *   - Pipeline items per stage: 15s (real-time board view)
 *   - Market data snapshots: 1 hour (external API, infrequent changes)
 *   - Dashboard stats: 60s (aggregation queries are expensive)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { cache, DEFAULT_TTL } from '../lib/cache';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ContactFilters {
  query?: string;
  types?: string[];
  assignedAgentId?: string;
  limit?: number;
}

interface PipelineFilters {
  pipelineType: string;
}

interface DashboardStatsResult {
  totalContacts: number;
  activeTransactions: number;
  tasksOverdue: number;
  revenueThisMonth: number;
}

interface MarketDataFilters {
  suburbs: string[];
  propertyType?: string;
}

interface CachedQueryOptions {
  /** Force bypass cache and fetch fresh data */
  forceRefresh?: boolean;
}

// ─── Background Refresh Tracking ────────────────────────────────────────────────

/** Track keys with pending background refresh to avoid duplicate fetches */
const pendingRefreshes = new Set<string>();

/** Threshold ratio of TTL remaining to trigger background refresh (20%) */
const BACKGROUND_REFRESH_THRESHOLD = 0.2;

// ─── Cached Query Service ───────────────────────────────────────────────────────

export class CachedQueryService {
  private supabase: SupabaseClient;
  private userId: string;

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  // ─── Contact List ───────────────────────────────────────────────────

  /**
   * Get contacts with filters. Cached for 30 seconds.
   */
  async getContacts(
    filters: ContactFilters,
    options?: CachedQueryOptions,
  ): Promise<Record<string, unknown>[]> {
    const cacheId = this.buildFilteredKey('list', filters);
    const ttl = DEFAULT_TTL['contacts'] ?? 30;

    if (!options?.forceRefresh) {
      const cached = await cache.get<Record<string, unknown>[]>('contacts', cacheId);
      if (cached) {
        // Schedule background refresh if near expiry
        this.maybeBackgroundRefresh('contacts', cacheId, ttl, () =>
          this.fetchContacts(filters),
        );
        return cached;
      }
    }

    const data = await this.fetchContacts(filters);
    await cache.set('contacts', cacheId, data, { ttl });
    return data;
  }

  private async fetchContacts(filters: ContactFilters): Promise<Record<string, unknown>[]> {
    let query = this.supabase
      .from('contacts')
      .select('*')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(filters.limit ?? 50);

    if (filters.query) {
      query = query.or(
        `first_name.ilike.%${filters.query}%,last_name.ilike.%${filters.query}%,email.ilike.%${filters.query}%,phone.ilike.%${filters.query}%`,
      );
    }

    if (filters.types?.length) {
      query = query.overlaps('types', filters.types);
    }

    if (filters.assignedAgentId) {
      query = query.eq('assigned_agent_id', filters.assignedAgentId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Contact query failed: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  // ─── Pipeline Items ─────────────────────────────────────────────────

  /**
   * Get pipeline transactions grouped by stage. Cached for 15 seconds.
   */
  async getPipelineItems(
    filters: PipelineFilters,
    options?: CachedQueryOptions,
  ): Promise<Record<string, unknown>[]> {
    const cacheId = `${this.userId}:pipeline:${filters.pipelineType}`;
    const ttl = DEFAULT_TTL['pipeline'] ?? 15;

    if (!options?.forceRefresh) {
      const cached = await cache.get<Record<string, unknown>[]>('pipeline', cacheId);
      if (cached) {
        this.maybeBackgroundRefresh('pipeline', cacheId, ttl, () =>
          this.fetchPipelineItems(filters),
        );
        return cached;
      }
    }

    const data = await this.fetchPipelineItems(filters);
    await cache.set('pipeline', cacheId, data, { ttl });
    return data;
  }

  private async fetchPipelineItems(
    filters: PipelineFilters,
  ): Promise<Record<string, unknown>[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, phone, email, buyer_profile, lead_score),
        property:properties(id, address_street_number, address_street_name, address_suburb, address_state)
      `)
      .eq('pipeline_type', filters.pipelineType)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(`Pipeline query failed: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  // ─── Dashboard Stats ───────────────────────────────────────────────

  /**
   * Get aggregated dashboard statistics. Cached for 60 seconds.
   */
  async getDashboardStats(options?: CachedQueryOptions): Promise<DashboardStatsResult> {
    const cacheId = `${this.userId}:dashboard-stats`;
    const ttl = DEFAULT_TTL['dashboard-stats'] ?? 60;

    if (!options?.forceRefresh) {
      const cached = await cache.get<DashboardStatsResult>('dashboard-stats', cacheId);
      if (cached) {
        this.maybeBackgroundRefresh('dashboard-stats', cacheId, ttl, () =>
          this.fetchDashboardStats(),
        );
        return cached;
      }
    }

    const data = await this.fetchDashboardStats();
    await cache.set('dashboard-stats', cacheId, data, { ttl });
    return data;
  }

  private async fetchDashboardStats(): Promise<DashboardStatsResult> {
    // Run all queries in parallel for <200ms target
    const [contactsResult, transactionsResult, tasksResult, revenueResult] =
      await Promise.all([
        this.supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('is_deleted', false),
        this.supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .not('current_stage', 'in', '("settled","lost","withdrawn")'),
        this.supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .eq('status', 'pending')
          .lt('due_date', new Date().toISOString()),
        this.supabase
          .from('transactions')
          .select('estimated_revenue')
          .eq('is_deleted', false)
          .gte(
            'settlement_date',
            new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          )
          .lte(
            'settlement_date',
            new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
          ),
      ]);

    const revenueThisMonth = ((revenueResult.data ?? []) as Array<{ estimated_revenue: number | null }>).reduce(
      (sum, row) => sum + (row.estimated_revenue ?? 0),
      0,
    );

    return {
      totalContacts: contactsResult.count ?? 0,
      activeTransactions: transactionsResult.count ?? 0,
      tasksOverdue: tasksResult.count ?? 0,
      revenueThisMonth,
    };
  }

  // ─── Market Data Snapshots ──────────────────────────────────────────

  /**
   * Get market data for suburbs. Cached for 1 hour.
   */
  async getMarketData(
    filters: MarketDataFilters,
    options?: CachedQueryOptions,
  ): Promise<Record<string, unknown>[]> {
    const suburbKey = filters.suburbs
      .map((s) => s.toLowerCase().trim())
      .sort()
      .join(',');
    const cacheId = `market:${suburbKey}:${filters.propertyType ?? 'all'}`;
    const ttl = DEFAULT_TTL['market-data'] ?? 3600;

    if (!options?.forceRefresh) {
      const cached = await cache.get<Record<string, unknown>[]>('market-data', cacheId);
      if (cached) {
        this.maybeBackgroundRefresh('market-data', cacheId, ttl, () =>
          this.fetchMarketData(filters),
        );
        return cached;
      }
    }

    const data = await this.fetchMarketData(filters);
    await cache.set('market-data', cacheId, data, { ttl });
    return data;
  }

  private async fetchMarketData(
    filters: MarketDataFilters,
  ): Promise<Record<string, unknown>[]> {
    let query = this.supabase
      .from('market_snapshots')
      .select('*')
      .in(
        'suburb',
        filters.suburbs.map((s) => s.trim()),
      )
      .order('data_as_of', { ascending: false });

    if (filters.propertyType) {
      query = query.eq('property_type', filters.propertyType);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Market data query failed: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  // ─── Cache Warming ────────────────────────────────────────────────

  /**
   * Warm the cache for critical data on startup.
   * Fetches dashboard stats and active pipeline data for known users.
   */
  static async warmCache(supabase: SupabaseClient): Promise<void> {
    const isConnected = cache.isConnected();
    if (!isConnected) {
      const connected = await cache.connect();
      if (!connected) {
        console.info('[CachedQueries] Skipping cache warm — Redis unavailable');
        return;
      }
    }

    try {
      // Fetch active user IDs for warming
      const { data: recentUsers } = await supabase
        .from('contacts')
        .select('assigned_agent_id')
        .eq('is_deleted', false)
        .not('assigned_agent_id', 'is', null)
        .limit(50);

      const agentIds = [
        ...new Set(
          (recentUsers ?? [])
            .map((r) => r.assigned_agent_id as string | null)
            .filter((id): id is string => id !== null),
        ),
      ];

      console.info(`[CachedQueries] Warming cache for ${agentIds.length} agents...`);

      // Warm dashboard stats for each agent (in parallel, limited concurrency)
      const CONCURRENCY = 5;
      for (let i = 0; i < agentIds.length; i += CONCURRENCY) {
        const batch = agentIds.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(async (agentId) => {
            const service = new CachedQueryService(supabase, agentId);
            await service.getDashboardStats({ forceRefresh: true });
          }),
        );
      }

      // Warm pipeline data for both pipeline types
      const pipelineTypes = ['buying', 'selling'];
      for (const pipelineType of pipelineTypes) {
        try {
          const service = new CachedQueryService(supabase, 'system');
          await service.getPipelineItems(
            { pipelineType },
            { forceRefresh: true },
          );
        } catch {
          // Non-critical — log and continue
          console.warn(`[CachedQueries] Failed to warm pipeline cache for ${pipelineType}`);
        }
      }

      console.info('[CachedQueries] Cache warming complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[CachedQueries] Cache warming failed: ${message}`);
    }
  }

  // ─── Background Refresh ───────────────────────────────────────────

  /**
   * Schedule a background refresh for a near-expiry cache entry.
   * This ensures users always get fast cached responses while keeping
   * data fresh in the background.
   */
  private maybeBackgroundRefresh(
    namespace: string,
    cacheId: string,
    ttl: number,
    fetcher: () => Promise<unknown>,
  ): void {
    const refreshKey = `${namespace}:${cacheId}`;

    // Skip if already refreshing
    if (pendingRefreshes.has(refreshKey)) return;

    // Only refresh if we're in the last 20% of TTL
    // Since we can't check remaining TTL without Redis call, we always attempt
    // The cache.set call will reset the TTL regardless
    const shouldRefresh = Math.random() < BACKGROUND_REFRESH_THRESHOLD;
    if (!shouldRefresh) return;

    pendingRefreshes.add(refreshKey);

    // Fire-and-forget background refresh
    void (async () => {
      try {
        const data = await fetcher();
        await cache.set(namespace, cacheId, data, { ttl });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[CachedQueries] Background refresh failed for ${refreshKey}: ${message}`);
      } finally {
        pendingRefreshes.delete(refreshKey);
      }
    })();
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private buildFilteredKey(prefix: string, filters: Record<string, unknown>): string {
    const parts = [this.userId, prefix];

    const sortedKeys = Object.keys(filters).sort();
    for (const key of sortedKeys) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        parts.push(`${key}=${Array.isArray(value) ? value.sort().join(',') : String(value)}`);
      }
    }

    return parts.join(':');
  }
}
