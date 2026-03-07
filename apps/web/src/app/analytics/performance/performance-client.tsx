'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { AnalyticsPeriod } from '@realflow/shared';
import { formatCurrency } from '@/lib/utils';
import { useAgentPerformance, useLeadSourceStats } from '@/hooks/use-analytics';
import {
  MetricCard,
  MetricCardSkeleton,
  ChartContainer,
  PeriodSelector,
  DataTable,
} from '@/components/analytics';
import type { Column } from '@/components/analytics';
import type { LeadSourceStat } from '@/hooks/use-analytics';

// ─── Bar colors ──────────────────────────────────────────────────────────────

const BAR_COLORS = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
];

// ─── Lead Source Tooltip ─────────────────────────────────────────────────────

interface SourceTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: LeadSourceStat }>;
}

function SourceTooltip({ active, payload }: SourceTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-gray-900">{data.source}</p>
      <p className="text-gray-600">{data.count} leads</p>
      <p className="text-green-600">{data.conversionRate}% conversion</p>
    </div>
  );
}

// ─── Lead Source Table Columns ───────────────────────────────────────────────

const leadSourceColumns: Column<LeadSourceStat>[] = [
  {
    key: 'source',
    header: 'Source',
    sortable: true,
    sortValue: (row) => row.source,
    render: (row) => (
      <span className="font-medium text-gray-900">{row.source}</span>
    ),
  },
  {
    key: 'count',
    header: 'Total Leads',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.count,
    render: (row) => <span className="text-gray-700">{row.count}</span>,
  },
  {
    key: 'converted',
    header: 'Converted',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.convertedCount,
    render: (row) => <span className="text-gray-700">{row.convertedCount}</span>,
  },
  {
    key: 'conversionRate',
    header: 'Conversion Rate',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.conversionRate,
    render: (row) => {
      const rate = row.conversionRate;
      return (
        <span
          className={
            rate >= 30
              ? 'font-medium text-green-600'
              : rate >= 15
                ? 'font-medium text-amber-600'
                : 'text-gray-600'
          }
        >
          {rate}%
        </span>
      );
    },
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function PerformanceClient() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const { data: perf, isLoading: perfLoading, error: perfError } = useAgentPerformance(period);
  const { data: leadSources, isLoading: sourcesLoading } = useLeadSourceStats();

  const isLoading = perfLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Metrics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track agent productivity, lead quality, and response efficiency.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Error */}
      {perfError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          role="alert"
        >
          Unable to load performance data. Please try again.
        </div>
      )}

      {/* Performance KPIs */}
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
              title="Deals Closed"
              value={String(perf?.dealsSettled ?? 0)}
              subtitle={`${formatCurrency(perf?.totalRevenue ?? 0)} total revenue`}
              accentColor="green"
            />
            <MetricCard
              title="Avg Deal Value"
              value={formatCurrency(perf?.avgDealValue ?? 0)}
              subtitle="Per settled deal"
            />
            <MetricCard
              title="Response Time"
              value={
                perf?.avgResponseTimeMinutes !== null && perf?.avgResponseTimeMinutes !== undefined
                  ? `${perf.avgResponseTimeMinutes}m`
                  : 'N/A'
              }
              subtitle="Average first response"
              accentColor={
                perf?.avgResponseTimeMinutes !== null &&
                perf?.avgResponseTimeMinutes !== undefined &&
                perf.avgResponseTimeMinutes <= 15
                  ? 'green'
                  : 'amber'
              }
            />
            <MetricCard
              title="Offer Conversion"
              value={`${perf?.offerConversionRate ?? 0}%`}
              subtitle="Offers that convert to settlement"
              accentColor="brand"
            />
          </>
        )}
      </div>

      {/* Activity Stats */}
      {!isLoading && perf && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title="Messages Sent"
            value={String(perf.messagesSent)}
            subtitle="This period"
          />
          <MetricCard
            title="Inspections Done"
            value={String(perf.inspectionsDone)}
            subtitle="Properties inspected"
          />
          <MetricCard
            title="Deals In Progress"
            value={String(perf.dealsInProgress)}
            subtitle="Currently active"
            accentColor="blue"
          />
        </div>
      )}

      {/* Lead Source Effectiveness Chart */}
      <ChartContainer
        title="Lead Source Effectiveness"
        subtitle="Which channels bring the most leads and best conversion rates"
        isLoading={sourcesLoading}
        isEmpty={!leadSources || leadSources.length === 0}
        emptyMessage="No lead source data available yet. Sources appear as contacts are added."
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={leadSources ?? []}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="source"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip content={<SourceTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {(leadSources ?? []).map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* Lead Source Table */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Lead Source Detail</h2>
        <DataTable
          columns={leadSourceColumns}
          data={leadSources ?? []}
          keyExtractor={(row) => row.source}
          isLoading={sourcesLoading}
          emptyMessage="No lead source data available."
        />
      </section>
    </div>
  );
}
