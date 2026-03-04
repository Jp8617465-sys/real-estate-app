'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { AnalyticsPeriod } from '@realflow/shared';
import { formatCurrency } from '@/lib/utils';
import { useRevenueForecast, useRevenueComparison } from '@/hooks/use-analytics';
import {
  MetricCard,
  MetricCardSkeleton,
  ChartContainer,
  PeriodSelector,
} from '@/components/analytics';

// ─── Period labels ──────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  '7d': 'This Week',
  '30d': 'This Month',
  '90d': 'This Quarter',
  ytd: 'Year to Date',
};

// ─── Revenue By Type (derived from forecast data) ───────────────────────────

interface RevenueByType {
  type: string;
  amount: number;
}

function buildRevenueByType(
  retainer: number,
  success: number,
  referral: number,
): RevenueByType[] {
  return [
    { type: 'Retainer Fees', amount: retainer },
    { type: 'Success Fees', amount: success },
    { type: 'Referral Fees', amount: referral },
  ].filter((r) => r.amount > 0);
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface RevenueTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Comparison Chart Tooltip ───────────────────────────────────────────────

interface ComparisonTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function ComparisonTooltip({ active, payload, label }: ComparisonTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── AUD Y-axis formatter ───────────────────────────────────────────────────

function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function RevenueClient() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const { data: forecast, isLoading, error } = useRevenueForecast(period);
  const { data: comparison, isLoading: compLoading } = useRevenueComparison();

  const revenueByType = forecast
    ? buildRevenueByType(forecast.retainerFees, forecast.successFees, forecast.referralFees)
    : [];

  // Build comparison chart data
  const comparisonData = (comparison ?? []).map((c) => ({
    period: PERIOD_LABELS[c.period],
    earned: c.earnedRevenue,
    forecast: c.forecastRevenue,
    pipeline: c.pipelineValue,
  }));

  // Calculate confidence based on pipeline vs forecast ratio
  const confidenceLevel =
    forecast && forecast.forecastRevenue > 0
      ? forecast.pipelineValue / forecast.forecastRevenue >= 0.7
        ? 'High'
        : forecast.pipelineValue / forecast.forecastRevenue >= 0.4
          ? 'Medium'
          : 'Low'
      : 'N/A';

  const confidenceColor =
    confidenceLevel === 'High'
      ? 'green'
      : confidenceLevel === 'Medium'
        ? 'amber'
        : confidenceLevel === 'Low'
          ? 'red'
          : undefined;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Forecasting</h1>
          <p className="mt-1 text-sm text-gray-500">
            Projected revenue, pipeline weighted values, and fee breakdowns.
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
          Unable to load revenue data. Please try again.
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
              title="Earned Revenue"
              value={formatCurrency(forecast?.earnedRevenue ?? 0)}
              subtitle={PERIOD_LABELS[period]}
              accentColor="green"
            />
            <MetricCard
              title="Pipeline Value"
              value={formatCurrency(forecast?.pipelineValue ?? 0)}
              subtitle="Weighted by probability"
              accentColor="blue"
            />
            <MetricCard
              title="Forecast Revenue"
              value={formatCurrency(forecast?.forecastRevenue ?? 0)}
              subtitle="Projected total"
              accentColor="brand"
            />
            <MetricCard
              title="Forecast Confidence"
              value={confidenceLevel}
              subtitle="Based on pipeline coverage"
              accentColor={confidenceColor as 'green' | 'amber' | 'red' | undefined}
            />
          </>
        )}
      </div>

      {/* Revenue by Fee Type */}
      <ChartContainer
        title="Revenue by Fee Type"
        subtitle="Breakdown of revenue streams for the selected period"
        isLoading={isLoading}
        isEmpty={revenueByType.length === 0}
        emptyMessage="No revenue data for this period."
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByType} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tickFormatter={formatAxisValue}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* Historical vs Projected Comparison */}
      <ChartContainer
        title="Earned vs Forecast Comparison"
        subtitle="Compare actual revenue against projections across time periods"
        isLoading={compLoading}
        isEmpty={comparisonData.length === 0}
        emptyMessage="No comparison data available."
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tickFormatter={formatAxisValue}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip content={<ComparisonTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="earned"
                stroke="#10b981"
                strokeWidth={2}
                name="Earned"
                dot={{ fill: '#10b981', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Forecast"
                dot={{ fill: '#6366f1', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="pipeline"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Pipeline"
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* Detailed Fee Breakdown */}
      {!isLoading && forecast && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Detailed Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" role="table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Fee Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Amount (AUD)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { label: 'Retainer Fees', amount: forecast.retainerFees },
                  { label: 'Success Fees', amount: forecast.successFees },
                  { label: 'Referral Fees', amount: forecast.referralFees },
                ].map((row) => {
                  const totalEarned = forecast.earnedRevenue || 1;
                  const pct = Math.round((row.amount / totalEarned) * 100);
                  return (
                    <tr key={row.label} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {row.label}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">Total Earned</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {formatCurrency(forecast.earnedRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
