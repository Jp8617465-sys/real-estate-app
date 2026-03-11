import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api-client';
import type {
  AnalyticsPeriod,
  DashboardSnapshot,
  AgentPerformance,
  RevenueForecast,
  MarketInsight,
  PipelineVelocity,
} from '@realflow/shared';

const supabase = createClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

/** Analytics-specific wrapper: adds auth token, full URL construction, and unwraps { data }. */
async function analyticsApiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getAuthToken();
  const url = new URL(`${apiUrl()}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const { data } = await apiFetch<{ data: T }>(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  return data;
}

// ─── Full Dashboard Snapshot ──────────────────────────────────────────────────

export function useAnalyticsSnapshot(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ['analytics-snapshot', period],
    queryFn: () => analyticsApiFetch<DashboardSnapshot>('/api/v1/analytics/snapshot', { period }),
    staleTime: 60_000,
  });
}

// ─── Pipeline Velocity ───────────────────────────────────────────────────────

export function usePipelineVelocity(
  period: AnalyticsPeriod,
  pipelineType?: 'buyer' | 'seller' | 'buyers_agent',
) {
  return useQuery({
    queryKey: ['pipeline-velocity', period, pipelineType],
    queryFn: () => {
      const params: Record<string, string> = { period };
      if (pipelineType) params.pipelineType = pipelineType;
      return analyticsApiFetch<PipelineVelocity[]>('/api/v1/analytics/pipeline-velocity', params);
    },
    staleTime: 60_000,
  });
}

// ─── Agent Performance ───────────────────────────────────────────────────────

export function useAgentPerformance(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ['agent-performance', period],
    queryFn: () =>
      analyticsApiFetch<AgentPerformance>('/api/v1/analytics/agent-performance', { period }),
    staleTime: 60_000,
  });
}

// ─── Revenue Forecast ────────────────────────────────────────────────────────

export function useRevenueForecast(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ['revenue-forecast', period],
    queryFn: () => analyticsApiFetch<RevenueForecast>('/api/v1/analytics/revenue', { period }),
    staleTime: 60_000,
  });
}

// ─── Market Insights ─────────────────────────────────────────────────────────

export function useMarketInsights(
  suburbs: string[],
  propertyType?: 'house' | 'unit' | 'townhouse',
) {
  return useQuery({
    queryKey: ['market-insights', suburbs, propertyType],
    queryFn: () => {
      const params: Record<string, string> = { suburbs: suburbs.join(',') };
      if (propertyType) params.propertyType = propertyType;
      return analyticsApiFetch<MarketInsight[]>('/api/v1/analytics/market-insights', params);
    },
    enabled: suburbs.length > 0,
    staleTime: 5 * 60_000,
  });
}

// ─── Market Snapshots (from market_snapshots table) ──────────────────────────

export interface MarketSnapshotRow {
  id: string;
  suburb: string;
  state: string;
  postcode: string | null;
  property_type: string;
  median_sale_price: number | null;
  median_days_on_market: number | null;
  auction_clearance_rate: number | null;
  total_listings: number | null;
  price_change_1y_percent: number | null;
  snapshot_date: string;
  created_at: string;
}

export function useMarketSnapshots(limit: number = 50) {
  return useQuery({
    queryKey: ['market-snapshots', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as MarketSnapshotRow[];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Historical Snapshots for a suburb ───────────────────────────────────────

export function useSuburbHistory(suburb: string, state: string, propertyType?: string) {
  return useQuery({
    queryKey: ['suburb-history', suburb, state, propertyType],
    queryFn: async () => {
      let query = supabase
        .from('market_snapshots')
        .select('*')
        .ilike('suburb', suburb)
        .ilike('state', state)
        .order('snapshot_date', { ascending: true })
        .limit(24);

      if (propertyType) {
        query = query.eq('property_type', propertyType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as MarketSnapshotRow[];
    },
    enabled: suburb.length > 0 && state.length > 0,
    staleTime: 5 * 60_000,
  });
}

// ─── Revenue comparison across periods ───────────────────────────────────────

export function useRevenueComparison() {
  return useQuery({
    queryKey: ['revenue-comparison'],
    queryFn: async () => {
      const periods: AnalyticsPeriod[] = ['7d', '30d', '90d', 'ytd'];
      const results = await Promise.all(
        periods.map((p) =>
          analyticsApiFetch<RevenueForecast>('/api/v1/analytics/revenue', { period: p }),
        ),
      );
      return periods.map((p, i) => {
        const { period: _period, ...rest } = results[i];
        return { period: p, ...rest };
      });
    },
    staleTime: 60_000,
  });
}

// ─── Lead source analytics (from contacts table) ────────────────────────────

export interface LeadSourceStat {
  source: string;
  count: number;
  convertedCount: number;
  conversionRate: number;
}

export function useLeadSourceStats() {
  return useQuery({
    queryKey: ['lead-source-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('source, types')
        .eq('is_deleted', false);

      if (error) throw error;

      const sourceMap = new Map<string, { total: number; converted: number }>();

      for (const row of data ?? []) {
        const r = row as Record<string, unknown>;
        const source = (r.source as string) ?? 'Unknown';
        const types = (r.types as string[]) ?? [];
        const existing = sourceMap.get(source) ?? { total: 0, converted: 0 };
        existing.total += 1;
        // Count as converted if they have progressed beyond initial buyer type
        if (types.includes('past-client')) {
          existing.converted += 1;
        }
        sourceMap.set(source, existing);
      }

      const stats: LeadSourceStat[] = [];
      sourceMap.forEach((val, source) => {
        stats.push({
          source,
          count: val.total,
          convertedCount: val.converted,
          conversionRate: val.total > 0 ? Math.round((val.converted / val.total) * 100) : 0,
        });
      });

      return stats.sort((a, b) => b.count - a.count);
    },
    staleTime: 60_000,
  });
}
