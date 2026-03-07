'use client';

import { cn } from '@/lib/utils';
import type { SocialPlatform } from '@realflow/shared';

interface EngagementDataPoint {
  date: string;
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  shares: number;
  comments: number;
}

interface EngagementChartProps {
  data: EngagementDataPoint[];
  metric?: 'impressions' | 'reach' | 'engagement' | 'clicks' | 'shares' | 'comments';
  platform?: SocialPlatform;
}

const metricLabels: Record<string, { label: string; color: string }> = {
  impressions: { label: 'Impressions', color: 'bg-blue-500' },
  reach: { label: 'Reach', color: 'bg-green-500' },
  engagement: { label: 'Engagement', color: 'bg-purple-500' },
  clicks: { label: 'Clicks', color: 'bg-amber-500' },
  shares: { label: 'Shares', color: 'bg-pink-500' },
  comments: { label: 'Comments', color: 'bg-indigo-500' },
};

export function EngagementChart({
  data,
  metric = 'engagement',
  platform,
}: EngagementChartProps) {
  const metricConfig = metricLabels[metric] ?? metricLabels.engagement!;
  const values = data.map((d) => d[metric]);
  const maxValue = Math.max(...values, 1);

  // Calculate totals
  const total = values.reduce((sum, v) => sum + v, 0);
  const average = data.length > 0 ? Math.round(total / data.length) : 0;
  const trend = data.length >= 2
    ? ((values[values.length - 1]! - values[0]!) / Math.max(values[0]!, 1)) * 100
    : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {metricConfig.label}
            {platform && <span className="ml-1 text-gray-500">({platform})</span>}
          </h3>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-gray-900">
              {total.toLocaleString('en-AU')}
            </span>
            <span className="text-sm text-gray-500">total</span>
            <span className={cn(
              'text-xs font-medium',
              trend >= 0 ? 'text-green-600' : 'text-red-600',
            )}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Average: {average.toLocaleString('en-AU')}</p>
          <p>{data.length} data points</p>
        </div>
      </div>

      {/* Bar chart */}
      {data.length > 0 ? (
        <div className="flex items-end gap-1" style={{ height: 120 }}>
          {data.map((point, idx) => {
            const height = maxValue > 0 ? (point[metric] / maxValue) * 100 : 0;
            const dateLabel = new Date(point.date).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
            });

            return (
              <div
                key={idx}
                className="group relative flex flex-1 flex-col items-center"
                style={{ height: '100%' }}
              >
                {/* Tooltip */}
                <div className="pointer-events-none absolute -top-10 z-10 hidden rounded bg-gray-900 px-2 py-1 text-xs text-white shadow group-hover:block">
                  {point[metric].toLocaleString('en-AU')}
                  <br />
                  {dateLabel}
                </div>

                {/* Bar */}
                <div className="flex flex-1 items-end w-full">
                  <div
                    className={cn(
                      'w-full min-h-[2px] rounded-t transition-all group-hover:opacity-80',
                      metricConfig.color,
                    )}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-[120px] items-center justify-center text-sm text-gray-400">
          No data available
        </div>
      )}

      {/* Date labels (first and last) */}
      {data.length > 1 && (
        <div className="mt-1 flex justify-between text-[10px] text-gray-400">
          <span>
            {new Date(data[0]!.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </span>
          <span>
            {new Date(data[data.length - 1]!.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      )}
    </div>
  );
}
