'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { useMarketSnapshots } from '@/hooks/use-analytics';
import type { MarketSnapshotRow } from '@/hooks/use-analytics';
import {
  MetricCard,
  MetricCardSkeleton,
  ChartContainer,
  DataTable,
} from '@/components/analytics';
import type { Column } from '@/components/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAuDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Table Columns ──────────────────────────────────────────────────────────

const marketColumns: Column<MarketSnapshotRow>[] = [
  {
    key: 'suburb',
    header: 'Suburb',
    sortable: true,
    sortValue: (row) => row.suburb,
    render: (row) => (
      <span className="font-medium text-gray-900">
        {row.suburb}
        {row.state && (
          <span className="ml-1 text-xs text-gray-400">{row.state}</span>
        )}
      </span>
    ),
  },
  {
    key: 'property_type',
    header: 'Type',
    sortable: true,
    sortValue: (row) => row.property_type,
    render: (row) => (
      <span className="capitalize text-gray-600">{row.property_type}</span>
    ),
  },
  {
    key: 'median_sale_price',
    header: 'Median Price',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.median_sale_price ?? 0,
    render: (row) => (
      <span className="text-gray-900">
        {row.median_sale_price !== null ? formatCurrency(row.median_sale_price) : 'N/A'}
      </span>
    ),
  },
  {
    key: 'median_days_on_market',
    header: 'Days on Market',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.median_days_on_market ?? 0,
    render: (row) => (
      <span className="text-gray-600">
        {row.median_days_on_market !== null
          ? `${Math.round(row.median_days_on_market)}d`
          : 'N/A'}
      </span>
    ),
  },
  {
    key: 'auction_clearance_rate',
    header: 'Clearance Rate',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.auction_clearance_rate ?? 0,
    render: (row) => (
      <span className="text-gray-600">
        {row.auction_clearance_rate !== null
          ? `${row.auction_clearance_rate.toFixed(1)}%`
          : 'N/A'}
      </span>
    ),
  },
  {
    key: 'price_change_1y_percent',
    header: '1Y Change',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.price_change_1y_percent ?? 0,
    render: (row) => {
      const change = row.price_change_1y_percent;
      if (change === null) return <span className="text-gray-400">N/A</span>;
      const isPositive = change > 0;
      const isNegative = change < 0;
      return (
        <span
          className={
            isPositive
              ? 'font-medium text-green-600'
              : isNegative
                ? 'font-medium text-red-600'
                : 'text-gray-600'
          }
        >
          {isPositive ? '+' : ''}
          {change.toFixed(1)}%
        </span>
      );
    },
  },
  {
    key: 'snapshot_date',
    header: 'As Of',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.snapshot_date,
    render: (row) => (
      <span className="text-xs text-gray-500">{formatAuDate(row.snapshot_date)}</span>
    ),
  },
];

// ─── Median Price Tooltip ───────────────────────────────────────────────────

interface PriceTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function PriceTooltip({ active, payload, label }: PriceTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-gray-900">{label}</p>
      <p className="text-brand-600">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MarketClient() {
  const { data: snapshots, isLoading, error } = useMarketSnapshots(100);
  const [selectedSuburb, setSelectedSuburb] = useState<string | null>(null);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');

  // Derive unique suburbs for the heatmap/selector
  const suburbList = useMemo(() => {
    if (!snapshots) return [];
    const seen = new Set<string>();
    return snapshots
      .filter((s) => {
        const key = `${s.suburb}-${s.state}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((s) => ({ suburb: s.suburb, state: s.state }));
  }, [snapshots]);

  // Filter snapshots
  const filteredSnapshots = useMemo(() => {
    if (!snapshots) return [];
    return snapshots.filter((s) => {
      if (propertyTypeFilter !== 'all' && s.property_type !== propertyTypeFilter) return false;
      return true;
    });
  }, [snapshots, propertyTypeFilter]);

  // Get latest snapshot per suburb for the overview cards
  const latestBySuburb = useMemo(() => {
    const map = new Map<string, MarketSnapshotRow>();
    for (const s of filteredSnapshots) {
      const key = `${s.suburb}-${s.state}`;
      if (!map.has(key)) map.set(key, s);
    }
    return Array.from(map.values());
  }, [filteredSnapshots]);

  // Calculate aggregate metrics
  const avgMedianPrice = useMemo(() => {
    const prices = latestBySuburb
      .filter((s) => s.median_sale_price !== null)
      .map((s) => s.median_sale_price as number);
    return prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  }, [latestBySuburb]);

  const avgDaysOnMarket = useMemo(() => {
    const days = latestBySuburb
      .filter((s) => s.median_days_on_market !== null)
      .map((s) => s.median_days_on_market as number);
    return days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
  }, [latestBySuburb]);

  const avgClearance = useMemo(() => {
    const rates = latestBySuburb
      .filter((s) => s.auction_clearance_rate !== null)
      .map((s) => s.auction_clearance_rate as number);
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }, [latestBySuburb]);

  // Build trend data for selected suburb
  const trendData = useMemo(() => {
    if (!selectedSuburb || !snapshots) return [];
    return snapshots
      .filter((s) => `${s.suburb}-${s.state}` === selectedSuburb)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      .map((s) => ({
        date: formatAuDate(s.snapshot_date),
        price: s.median_sale_price ?? 0,
      }));
  }, [selectedSuburb, snapshots]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Insights</h1>
          <p className="mt-1 text-sm text-gray-500">
            Suburb performance data, median prices, and days on market trends.
          </p>
        </div>

        {/* Property type filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="property-type-filter" className="text-sm text-gray-500">
            Type:
          </label>
          <select
            id="property-type-filter"
            value={propertyTypeFilter}
            onChange={(e) => setPropertyTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All Types</option>
            <option value="house">House</option>
            <option value="unit">Unit</option>
            <option value="townhouse">Townhouse</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          role="alert"
        >
          Unable to load market data. Please try again.
        </div>
      )}

      {/* Summary KPIs */}
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
              title="Tracked Suburbs"
              value={String(suburbList.length)}
              subtitle="With active market data"
            />
            <MetricCard
              title="Avg Median Price"
              value={formatCurrency(avgMedianPrice)}
              subtitle="Across tracked suburbs"
              accentColor="brand"
            />
            <MetricCard
              title="Avg Days on Market"
              value={`${avgDaysOnMarket}d`}
              subtitle="Median across suburbs"
              accentColor={avgDaysOnMarket <= 30 ? 'green' : 'amber'}
            />
            <MetricCard
              title="Avg Clearance Rate"
              value={`${avgClearance.toFixed(1)}%`}
              subtitle="Auction clearance"
              accentColor={avgClearance >= 70 ? 'green' : avgClearance >= 50 ? 'amber' : 'red'}
            />
          </>
        )}
      </div>

      {/* Suburb Performance Heatmap (visual representation) */}
      {!isLoading && latestBySuburb.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Suburb Performance
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Select a suburb to view its price trend over time.
          </p>
          <div className="flex flex-wrap gap-2">
            {latestBySuburb.map((s) => {
              const key = `${s.suburb}-${s.state}`;
              const isSelected = selectedSuburb === key;
              const change = s.price_change_1y_percent ?? 0;

              // Color code by price change
              let bgColor = 'bg-gray-100 text-gray-700';
              if (change > 5) bgColor = 'bg-green-100 text-green-800';
              else if (change > 0) bgColor = 'bg-green-50 text-green-700';
              else if (change < -5) bgColor = 'bg-red-100 text-red-800';
              else if (change < 0) bgColor = 'bg-red-50 text-red-700';

              return (
                <button
                  key={key}
                  onClick={() => setSelectedSuburb(isSelected ? null : key)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'ring-2 ring-brand-500 ring-offset-1'
                      : ''
                  } ${bgColor}`}
                  aria-pressed={isSelected}
                  aria-label={`${s.suburb} ${s.state}: ${change > 0 ? '+' : ''}${change.toFixed(1)}% yearly change`}
                >
                  <span className="font-semibold">{s.suburb}</span>
                  <span className="ml-1 text-xs">
                    {change > 0 ? '+' : ''}
                    {change.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Median Price Trend for Selected Suburb */}
      {selectedSuburb && (
        <ChartContainer
          title={`Median Price Trend: ${selectedSuburb.replace('-', ', ').toUpperCase()}`}
          subtitle="Historical median sale price over time"
          isEmpty={trendData.length === 0}
          emptyMessage="No historical data available for this suburb."
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tickFormatter={(v: number) => {
                    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
                    return `$${v}`;
                  }}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip content={<PriceTooltip />} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      )}

      {/* Market Data Table */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Market Snapshot Data
        </h2>
        <DataTable
          columns={marketColumns}
          data={filteredSnapshots}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No market data available. Data populates as suburb preferences are captured."
        />
      </section>
    </div>
  );
}
