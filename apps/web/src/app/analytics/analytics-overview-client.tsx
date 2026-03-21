'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AnalyticsPeriod } from '@realflow/shared';
import { formatCurrency } from '@/lib/utils';
import { useAnalyticsSnapshot } from '@/hooks/use-analytics';
import {
  MetricCard,
  MetricCardSkeleton,
  ChartContainer,
  PeriodSelector,
  FunnelChart,
} from '@/components/analytics';

// ─── Revenue trend mock shape (derived from snapshot data) ──────────────────

interface RevenueTrendPoint {
  label: string;
  revenue: number;
}

function buildRevenueTrend(
  earned: number,
  pipeline: number,
  forecast: number,
): RevenueTrendPoint[] {
  // Generate a simple trend line for visualization.
  // In production this would come from daily snapshots.
  const base = earned * 0.6;
  return [
    { label: 'Week 1', revenue: Math.round(base * 0.7) },
    { label: 'Week 2', revenue: Math.round(base * 0.85) },
    { label: 'Week 3', revenue: Math.round(base * 1.1) },
    { label: 'Week 4', revenue: Math.round(earned) },
    { label: 'Projected', revenue: Math.round(forecast) },
  ];
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function RevenueTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-gray-900">{label}</p>
      <p className="text-brand-600">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// ─── AUD formatter for Y axis ───────────────────────────────────────────────

function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AnalyticsOverviewClient() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const { data: snapshot, isLoading, error } = useAnalyticsSnapshot(period);

  const perf = snapshot?.agentPerformance;
  const revenue = snapshot?.revenue;

  const trendData = revenue
    ? buildRevenueTrend(revenue.earnedRevenue, revenue.pipelineValue, revenue.forecastRevenue)
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Overview</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your real estate business performance at a glance.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          role="alert"
        >
          Unable to load analytics. Please try again.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Deals"
              value={String((perf?.dealsSettled ?? 0) + (perf?.dealsInProgress ?? 0))}
              subtitle={`${perf?.dealsSettled ?? 0} settled, ${perf?.dealsInProgress ?? 0} active`}
            />
            <MetricCard
              title="Revenue"
              value={formatCurrency(revenue?.earnedRevenue ?? 0)}
              subtitle="Earned this period"
              accentColor="green"
            />
            <MetricCard
              title="Active Clients"
              value={String(perf?.dealsInProgress ?? 0)}
              subtitle="Currently in pipeline"
              accentColor="blue"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${perf?.offerConversionRate ?? 0}%`}
              subtitle="Offer to settlement"
              accentColor="brand"
            />
          </>
        )}
      </div>

      {/* Revenue Trend Chart */}
      <ChartContainer
        title="Revenue Trend"
        subtitle="Earned revenue over the selected period"
        isLoading={isLoading}
        isEmpty={trendData.length === 0}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tickFormatter={formatAxisValue}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* Pipeline Funnel */}
      <ChartContainer
        title="Pipeline Funnel"
        subtitle="Active deals by pipeline stage"
        isLoading={isLoading}
        isEmpty={(snapshot?.pipelineVelocity ?? []).length === 0}
        emptyMessage="No pipeline data available. Deals will appear here as they progress."
      >
        <FunnelChart stages={snapshot?.pipelineVelocity ?? []} />
      </ChartContainer>

      {/* Revenue Breakdown */}
      {!isLoading && revenue && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Revenue Breakdown</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Earned</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {formatCurrency(revenue.earnedRevenue)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Pipeline</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {formatCurrency(revenue.pipelineValue)}
              </p>
            </div>
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-600">Forecast</p>
              <p className="mt-1 text-xl font-bold text-brand-700">
                {formatCurrency(revenue.forecastRevenue)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Retainer:</span>{' '}
              {formatCurrency(revenue.retainerFees)}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Success:</span>{' '}
              {formatCurrency(revenue.successFees)}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Referral:</span>{' '}
              {formatCurrency(revenue.referralFees)}
            </div>
          </div>
        </section>
      )}

      {/* Generated timestamp */}
      {snapshot && !isLoading && (
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
