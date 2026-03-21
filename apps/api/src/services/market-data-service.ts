/**
 * Market Data Service
 *
 * Fetches suburb performance data from Domain.com.au, transforms it to
 * the market_snapshots table schema, and upserts records. Includes
 * in-memory caching to avoid excessive API calls and graceful error
 * handling for rate limits and transient failures.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { DomainClient } from '@realflow/integrations';
import { DomainAPIError } from '@realflow/integrations/src/errors';
import type { MarketSnapshot } from '@realflow/shared';

// ─── Domain API Response Schema ─────────────────────────────────────

/**
 * Zod schema for the Domain suburb performance statistics API response.
 * Only the fields we consume are validated; extra fields are stripped.
 */
export const DomainSuburbPerformanceSchema = z
  .object({
    header: z.object({
      suburb: z.string(),
      state: z.string(),
      propertyCategory: z.string().optional(),
    }),
    series: z
      .object({
        seriesInfo: z
          .array(
            z.object({
              year: z.number(),
              month: z.number(),
              values: z
                .object({
                  medianSoldPrice: z.number().optional(),
                  numberSold: z.number().optional(),
                  daysOnMarket: z.number().optional(),
                  auctionClearanceRate: z.number().optional(),
                  numberListed: z.number().optional(),
                  medianSoldPriceChange: z.number().optional(),
                })
                .passthrough(),
            }),
          )
          .default([]),
      })
      .optional(),
  })
  .passthrough();

export type DomainSuburbPerformance = z.infer<typeof DomainSuburbPerformanceSchema>;

// ─── Suburb Query Input Schema ──────────────────────────────────────

export const SuburbQuerySchema = z.object({
  suburb: z.string().min(1),
  state: z.string().min(1),
  postcode: z.string().min(3),
  propertyType: z.enum(['house', 'unit']).default('house'),
});

export type SuburbQuery = z.infer<typeof SuburbQuerySchema>;

// ─── Cache Entry ────────────────────────────────────────────────────

interface CacheEntry {
  data: MarketSnapshot;
  expiresAt: number;
}

// ─── Service Result Types ───────────────────────────────────────────

export interface MarketDataRefreshResult {
  suburb: string;
  state: string;
  propertyType: string;
  success: boolean;
  snapshot: MarketSnapshot | null;
  error: string | null;
}

export interface BulkRefreshResult {
  total: number;
  succeeded: number;
  failed: number;
  results: MarketDataRefreshResult[];
}

// ─── Market Data Service ────────────────────────────────────────────

export class MarketDataService {
  private domainClient: DomainClient;
  private supabase: SupabaseClient;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number;

  constructor(supabase: SupabaseClient, options?: { cacheTtlMs?: number }) {
    this.supabase = supabase;
    this.cacheTtlMs = options?.cacheTtlMs ?? 60 * 60 * 1000; // 1 hour default

    this.domainClient = new DomainClient({
      clientId: process.env['DOMAIN_CLIENT_ID'] ?? '',
      clientSecret: process.env['DOMAIN_CLIENT_SECRET'] ?? '',
    });
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Fetch suburb performance from Domain API, transform, and upsert into
   * market_snapshots. Returns the resulting MarketSnapshot.
   *
   * Uses in-memory cache to avoid repeat calls within the TTL window.
   */
  async fetchAndUpsert(query: SuburbQuery): Promise<MarketDataRefreshResult> {
    const parsed = SuburbQuerySchema.safeParse(query);
    if (!parsed.success) {
      return {
        suburb: query.suburb,
        state: query.state,
        propertyType: query.propertyType ?? 'house',
        success: false,
        snapshot: null,
        error: `Invalid input: ${parsed.error.message}`,
      };
    }

    const { suburb, state, postcode, propertyType } = parsed.data;
    const cacheKey = this.buildCacheKey(suburb, state, propertyType);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        suburb,
        state,
        propertyType,
        success: true,
        snapshot: cached.data,
        error: null,
      };
    }

    try {
      const rawResponse = await this.domainClient.getSuburbPerformance(
        suburb,
        state,
        postcode,
        propertyType,
      );

      const parseResult = DomainSuburbPerformanceSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        return {
          suburb,
          state,
          propertyType,
          success: false,
          snapshot: null,
          error: `Invalid Domain API response: ${parseResult.error.message}`,
        };
      }

      const snapshot = this.transformToSnapshot(parseResult.data, postcode);
      await this.upsertSnapshot(snapshot, propertyType);

      // Update cache
      this.cache.set(cacheKey, {
        data: snapshot,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      return {
        suburb,
        state,
        propertyType,
        success: true,
        snapshot,
        error: null,
      };
    } catch (err) {
      const errorMessage = this.formatError(err);
      return {
        suburb,
        state,
        propertyType,
        success: false,
        snapshot: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch and upsert market data for multiple suburbs, respecting rate limits
   * by adding a delay between calls.
   */
  async bulkFetchAndUpsert(
    queries: SuburbQuery[],
    options?: { delayMs?: number },
  ): Promise<BulkRefreshResult> {
    const delayMs = options?.delayMs ?? 500;
    const results: MarketDataRefreshResult[] = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]!;
      const result = await this.fetchAndUpsert(query);
      results.push(result);

      // Rate-limit delay between calls (skip after last)
      if (i < queries.length - 1 && delayMs > 0) {
        await this.delay(delayMs);
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return {
      total: queries.length,
      succeeded,
      failed: queries.length - succeeded,
      results,
    };
  }

  /**
   * Get the latest market snapshot for a suburb from the database.
   * Returns null if no data exists.
   */
  async getLatestSnapshot(
    suburb: string,
    state: string,
    propertyType?: string,
  ): Promise<MarketSnapshot | null> {
    let query = this.supabase
      .from('market_snapshots')
      .select('*')
      .ilike('suburb', suburb)
      .ilike('state', state)
      .order('data_as_of', { ascending: false })
      .limit(1);

    if (propertyType) {
      query = query.eq('property_type', propertyType);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;

    return this.dbRowToSnapshot(data);
  }

  /**
   * Get historical snapshots for a suburb from the database.
   */
  async getHistoricalSnapshots(
    suburb: string,
    state: string,
    options?: { propertyType?: string; limit?: number },
  ): Promise<MarketSnapshot[]> {
    let query = this.supabase
      .from('market_snapshots')
      .select('*')
      .ilike('suburb', suburb)
      .ilike('state', state)
      .order('data_as_of', { ascending: false })
      .limit(options?.limit ?? 24);

    if (options?.propertyType) {
      query = query.eq('property_type', options.propertyType);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row) => this.dbRowToSnapshot(row));
  }

  /**
   * Get snapshots for multiple suburbs (used by consolidation report integration).
   */
  async getSnapshotsForSuburbs(
    suburbs: Array<{ suburb: string; state: string }>,
  ): Promise<MarketSnapshot[]> {
    if (suburbs.length === 0) return [];

    // Build OR filter for multiple suburbs
    const filters = suburbs
      .map((s) => `and(suburb.ilike.${s.suburb},state.ilike.${s.state})`)
      .join(',');

    const { data, error } = await this.supabase
      .from('market_snapshots')
      .select('*')
      .or(filters)
      .order('data_as_of', { ascending: false });

    if (error || !data) return [];

    // Deduplicate: keep only the latest per suburb+state+property_type
    const seen = new Set<string>();
    const deduped: MarketSnapshot[] = [];

    for (const row of data) {
      const key = `${(row.suburb as string).toLowerCase()}|${(row.state as string).toLowerCase()}|${row.property_type as string}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(this.dbRowToSnapshot(row));
      }
    }

    return deduped;
  }

  /**
   * Get active suburbs from client briefs and pipeline properties.
   * Used by the scheduler to determine which suburbs to refresh.
   */
  async getActiveSuburbs(): Promise<SuburbQuery[]> {
    // Fetch suburbs from active client briefs
    const { data: briefs } = await this.supabase
      .from('client_briefs')
      .select('requirements')
      .eq('is_deleted', false);

    const suburbMap = new Map<string, SuburbQuery>();

    if (briefs) {
      for (const brief of briefs) {
        const requirements = brief.requirements as {
          suburbs?: Array<{ suburb: string; state: string; postcode?: string }>;
        } | null;

        if (requirements?.suburbs) {
          for (const s of requirements.suburbs) {
            const key = `${s.suburb.toLowerCase()}|${s.state.toLowerCase()}`;
            if (!suburbMap.has(key)) {
              suburbMap.set(key, {
                suburb: s.suburb,
                state: s.state,
                postcode: s.postcode ?? '',
                propertyType: 'house',
              });
            }
          }
        }
      }
    }

    // Fetch suburbs from pipeline properties
    const { data: properties } = await this.supabase
      .from('properties')
      .select('address_suburb, address_state, address_postcode')
      .eq('is_deleted', false)
      .not('address_suburb', 'is', null);

    if (properties) {
      for (const prop of properties) {
        const suburb = prop.address_suburb as string;
        const state = prop.address_state as string;
        const postcode = prop.address_postcode as string;

        if (suburb && state) {
          const key = `${suburb.toLowerCase()}|${state.toLowerCase()}`;
          if (!suburbMap.has(key)) {
            suburbMap.set(key, {
              suburb,
              state,
              postcode: postcode ?? '',
              propertyType: 'house',
            });
          }
        }
      }
    }

    return Array.from(suburbMap.values());
  }

  /**
   * Clear the in-memory cache. Useful in testing or after forced refreshes.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ─── Internal Helpers ───────────────────────────────────────────

  /**
   * Transform Domain API suburb performance response into a MarketSnapshot.
   * Extracts the most recent data point from the series.
   */
  transformToSnapshot(response: DomainSuburbPerformance, postcode: string): MarketSnapshot {
    const { header, series } = response;
    const seriesData = series?.seriesInfo ?? [];

    // Get the most recent data point
    const latest =
      seriesData.length > 0
        ? seriesData.reduce((newest, current) => {
            const newestDate = newest.year * 12 + newest.month;
            const currentDate = current.year * 12 + current.month;
            return currentDate > newestDate ? current : newest;
          })
        : null;

    // Compute 12-month price change if we have enough data
    let medianPriceChange12m: number | undefined;
    if (seriesData.length >= 2) {
      const sortedSeries = [...seriesData].sort(
        (a, b) => b.year * 12 + b.month - (a.year * 12 + a.month),
      );
      const current = sortedSeries[0];
      // Find the entry closest to 12 months ago
      const targetMonths = current!.year * 12 + current!.month - 12;
      const yearAgo = sortedSeries.reduce((closest, entry) => {
        const entryMonths = entry.year * 12 + entry.month;
        const closestMonths = closest.year * 12 + closest.month;
        return Math.abs(entryMonths - targetMonths) < Math.abs(closestMonths - targetMonths)
          ? entry
          : closest;
      });

      if (
        current?.values.medianSoldPrice &&
        yearAgo.values.medianSoldPrice &&
        yearAgo.values.medianSoldPrice > 0
      ) {
        medianPriceChange12m = Number(
          (
            ((current.values.medianSoldPrice - yearAgo.values.medianSoldPrice) /
              yearAgo.values.medianSoldPrice) *
            100
          ).toFixed(4),
        );
      }
    }

    const dataAsOf = latest
      ? new Date(latest.year, latest.month - 1, 1).toISOString()
      : new Date().toISOString();

    const snapshot: MarketSnapshot = {
      suburb: header.suburb,
      state: header.state,
      medianPrice: latest?.values.medianSoldPrice,
      medianPriceChange12m: medianPriceChange12m ?? latest?.values.medianSoldPriceChange,
      daysOnMarket: latest?.values.daysOnMarket,
      auctionClearanceRate: latest?.values.auctionClearanceRate,
      totalListings: latest?.values.numberListed,
      dataAsOf,
    };

    return snapshot;
  }

  /**
   * Upsert a market snapshot into the database.
   * Uses the unique index on (suburb, state, property_type, data_source, data_as_of).
   */
  private async upsertSnapshot(snapshot: MarketSnapshot, propertyType: string): Promise<void> {
    const row = {
      suburb: snapshot.suburb,
      state: snapshot.state,
      postcode: undefined as string | undefined,
      median_price: snapshot.medianPrice,
      median_price_change_12m: snapshot.medianPriceChange12m,
      days_on_market: snapshot.daysOnMarket,
      auction_clearance_rate: snapshot.auctionClearanceRate,
      total_listings: snapshot.totalListings,
      property_type: propertyType,
      data_source: 'domain',
      data_as_of: snapshot.dataAsOf ?? new Date().toISOString(),
    };

    const { error } = await this.supabase.from('market_snapshots').upsert(row, {
      onConflict: 'suburb,state,property_type,data_source,data_as_of',
    });

    if (error) {
      console.error('[MarketDataService] Upsert error:', error.message);
      throw new Error(`Failed to upsert market snapshot: ${error.message}`);
    }
  }

  /**
   * Convert a database row to a MarketSnapshot type.
   */
  private dbRowToSnapshot(row: Record<string, unknown>): MarketSnapshot {
    return {
      suburb: row.suburb as string,
      state: row.state as string,
      medianPrice: row.median_price as number | undefined,
      medianPriceChange12m: row.median_price_change_12m as number | undefined,
      daysOnMarket: row.days_on_market as number | undefined,
      auctionClearanceRate: row.auction_clearance_rate as number | undefined,
      totalListings: row.total_listings as number | undefined,
      dataAsOf: row.data_as_of as string | undefined,
    };
  }

  private buildCacheKey(suburb: string, state: string, propertyType: string): string {
    return `${suburb.toLowerCase()}|${state.toLowerCase()}|${propertyType}`;
  }

  private formatError(err: unknown): string {
    if (err instanceof DomainAPIError) {
      if (err.statusCode === 429) {
        return 'Domain API rate limit exceeded — retry later';
      }
      return `Domain API error: ${err.statusCode} ${err.statusText}`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
