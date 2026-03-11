'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  DashboardSnapshot,
  AnalyticsPeriod,
  MarketInsight,
  PipelineVelocity,
} from '@realflow/shared';

// ─── Currency formatter ───────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

function formatAud(amount: number): string {
  return AUD.format(amount);
}

// ─── Buyers-agent stage display order ────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  brief: 'Brief',
  property_search: 'Property Search',
  inspections: 'Inspections',
  due_diligence: 'Due Diligence',
  offer: 'Offer',
  contract: 'Contract',
  settlement: 'Settlement',
};

const STAGE_ORDER = [
  'lead',
  'brief',
  'property_search',
  'inspections',
  'due_diligence',
  'offer',
  'contract',
  'settlement',
];

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-24 rounded bg-gray-200" />
      <div className="mt-3 h-7 w-20 rounded bg-gray-300" />
      <div className="mt-2 h-3 w-32 rounded bg-gray-200" />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string | null;
}

function KpiCard({ title, value, sub }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {sub !== undefined && sub !== null && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
    </div>
  );
}

// ─── Pipeline Funnel (CSS-only horizontal bar chart) ─────────────────────────

interface PipelineFunnelProps {
  stages: PipelineVelocity[];
}

function PipelineFunnel({ stages }: PipelineFunnelProps) {
  // Sort stages by canonical order
  const sorted = [...stages].sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a.stage);
    const bi = STAGE_ORDER.indexOf(b.stage);
    if (ai === -1 && bi === -1) return a.stage.localeCompare(b.stage);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const maxCount = Math.max(...sorted.map((s) => s.activeCount), 1);

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No pipeline data available for this period.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((stage) => {
        const widthPct = Math.round((stage.activeCount / maxCount) * 100);
        const label = STAGE_LABELS[stage.stage] ?? stage.stage;

        return (
          <div key={`${stage.stage}-${stage.pipelineType}`} className="flex items-center gap-3">
            {/* Stage name */}
            <div className="w-36 shrink-0 text-right text-xs font-medium text-gray-600">
              {label}
            </div>

            {/* Bar track */}
            <div
              className="flex-1 overflow-hidden rounded-full bg-gray-100"
              style={{ height: '22px' }}
            >
              <div
                className="flex h-full items-center rounded-full bg-brand-600 px-2 transition-all duration-500"
                style={{ width: `${Math.max(widthPct, 4)}%` }}
              >
                {stage.activeCount > 0 && (
                  <span className="text-[10px] font-semibold text-white">{stage.activeCount}</span>
                )}
              </div>
            </div>

            {/* Avg days + conversion */}
            <div className="w-28 shrink-0 text-right text-xs text-gray-500">
              {stage.avgDaysInStage > 0 ? (
                <span>{stage.avgDaysInStage.toFixed(1)}d avg</span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
              {stage.conversionRate > 0 && (
                <span className="ml-1 text-brand-600">({stage.conversionRate}%)</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Revenue Section ──────────────────────────────────────────────────────────

interface RevenueSectionProps {
  earned: number;
  pipeline: number;
  forecast: number;
  retainer: number;
  success: number;
  referral: number;
}

function RevenueSection({
  earned,
  pipeline,
  forecast,
  retainer,
  success,
  referral,
}: RevenueSectionProps) {
  return (
    <div className="space-y-4">
      {/* Top three headline figures */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Earned</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatAud(earned)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Pipeline</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatAud(pipeline)}</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">Forecast</p>
          <p className="mt-1 text-xl font-bold text-brand-700">{formatAud(forecast)}</p>
        </div>
      </div>

      {/* Breakdown row */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Retainer:</span> {formatAud(retainer)}
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Success:</span> {formatAud(success)}
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Referral:</span> {formatAud(referral)}
        </div>
      </div>
    </div>
  );
}

// ─── Market Insights Table ────────────────────────────────────────────────────

interface MarketInsightsTableProps {
  insights: MarketInsight[];
}

function MarketInsightsTable({ insights }: MarketInsightsTableProps) {
  if (insights.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No market data available. Market insights populate as client suburb preferences are
        captured.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Suburb
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Type
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Median Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Days on Mkt
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Clearance
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              1Y Change
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {insights.map((row, idx) => {
            const changeIsPositive = (row.priceChange1yPercent ?? 0) > 0;
            const changeIsNegative = (row.priceChange1yPercent ?? 0) < 0;

            return (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {row.suburb}
                  {row.state && <span className="ml-1 text-xs text-gray-400">{row.state}</span>}
                </td>
                <td className="px-4 py-3 text-sm capitalize text-gray-600">{row.propertyType}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">
                  {row.medianSalePrice !== null ? formatAud(row.medianSalePrice) : 'n/a'}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {row.medianDaysOnMarket !== null
                    ? `${Math.round(row.medianDaysOnMarket)}d`
                    : 'n/a'}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {row.clearanceRate !== null ? `${row.clearanceRate.toFixed(1)}%` : 'n/a'}
                </td>
                <td
                  className={`px-4 py-3 text-right text-sm font-medium ${
                    changeIsPositive
                      ? 'text-green-600'
                      : changeIsNegative
                        ? 'text-red-600'
                        : 'text-gray-600'
                  }`}
                >
                  {row.priceChange1yPercent !== null
                    ? `${row.priceChange1yPercent > 0 ? '+' : ''}${row.priceChange1yPercent.toFixed(1)}%`
                    : 'n/a'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Period selector ──────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  value: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
}

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'YTD', value: 'ytd' },
];

function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === p.value
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Dashboard Client ────────────────────────────────────────────────────

export default function DashboardClient() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSnapshot() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token ?? '';
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

        const res = await fetch(`${apiUrl}/api/v1/analytics/snapshot?period=${period}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }

        const json = (await res.json()) as { data: DashboardSnapshot };

        if (!cancelled) {
          setSnapshot(json.data);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load analytics. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchSnapshot();

    return () => {
      cancelled = true;
    };
  }, [period]);

  const perf = snapshot?.agentPerformance;
  const revenue = snapshot?.revenue;

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Performance overview for your buyers agency practice.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Error state */}
      {error !== null && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <KpiCard
              title="Active Clients"
              value={String(perf?.dealsInProgress ?? 0)}
              sub="In pipeline right now"
            />
            <KpiCard
              title="Settled This Period"
              value={String(perf?.dealsSettled ?? 0)}
              sub={
                perf?.dealsSettled ? formatAud(perf.totalRevenue) + ' earned' : 'No settlements yet'
              }
            />
            <KpiCard
              title="Pipeline Value"
              value={revenue ? formatAud(revenue.pipelineValue) : '$0'}
              sub="Estimated success fees"
            />
            <KpiCard
              title="Avg Response Time"
              value={
                perf?.avgResponseTimeMinutes !== null && perf?.avgResponseTimeMinutes !== undefined
                  ? `${perf.avgResponseTimeMinutes}m`
                  : 'n/a'
              }
              sub="Sprint 5: response tracking"
            />
          </>
        )}
      </div>

      {/* Pipeline Funnel */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Pipeline Funnel</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-5 flex-1 animate-pulse rounded-full bg-gray-100" />
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : (
          <PipelineFunnel stages={snapshot?.pipelineVelocity ?? []} />
        )}
      </section>

      {/* Revenue Section */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Revenue</h2>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="h-12 animate-pulse rounded-xl border border-gray-200 bg-white" />
          </div>
        ) : (
          <RevenueSection
            earned={revenue?.earnedRevenue ?? 0}
            pipeline={revenue?.pipelineValue ?? 0}
            forecast={revenue?.forecastRevenue ?? 0}
            retainer={revenue?.retainerFees ?? 0}
            success={revenue?.successFees ?? 0}
            referral={revenue?.referralFees ?? 0}
          />
        )}
      </section>

      {/* Market Insights */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Market Insights</h2>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-xl border border-gray-200 bg-white" />
        ) : (
          <MarketInsightsTable insights={snapshot?.marketInsights ?? []} />
        )}
      </section>

      {/* Footer timestamp */}
      {snapshot !== null && !isLoading && (
        <p className="text-right text-xs text-gray-400">
          Generated at{' '}
          {new Date(snapshot.generatedAt).toLocaleString('en-AU', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      )}
    </div>
  );
}
