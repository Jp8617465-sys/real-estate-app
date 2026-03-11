'use client';

import { useState, useMemo } from 'react';
import { useSocialAnalytics } from '@/hooks/use-social';
import { EngagementChart } from '@/components/social/engagement-chart';
import { cn } from '@/lib/utils';
import type { SocialPlatform } from '@realflow/shared';

type MetricKey = 'impressions' | 'reach' | 'engagement' | 'clicks' | 'shares' | 'comments';
type PlatformFilter = 'all' | SocialPlatform;

export default function SocialAnalyticsPage() {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('engagement');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const { data: analyticsResponse, isLoading } = useSocialAnalytics();
  const posts = (analyticsResponse?.data ?? []) as Array<Record<string, unknown>>;

  // Filter posts by platform
  const filteredPosts = useMemo(() => {
    if (platformFilter === 'all') return posts;
    return posts.filter((post) => {
      const platforms = (post.platforms as string[]) ?? [];
      return platforms.includes(platformFilter);
    });
  }, [posts, platformFilter]);

  // Aggregate analytics into daily data points
  const chartData = useMemo(() => {
    const dailyMap = new Map<
      string,
      {
        date: string;
        impressions: number;
        reach: number;
        engagement: number;
        clicks: number;
        shares: number;
        comments: number;
      }
    >();

    for (const post of filteredPosts) {
      const publishedAt = post.published_at as string | null;
      if (!publishedAt) continue;

      const date = publishedAt.split('T')[0]!;
      const analytics = post.analytics as Record<string, number> | null;

      const existing = dailyMap.get(date) ?? {
        date,
        impressions: 0,
        reach: 0,
        engagement: 0,
        clicks: 0,
        shares: 0,
        comments: 0,
      };

      if (analytics) {
        existing.impressions += analytics.impressions ?? 0;
        existing.reach += analytics.reach ?? 0;
        existing.engagement += analytics.engagement ?? 0;
        existing.clicks += analytics.clicks ?? 0;
        existing.shares += analytics.shares ?? 0;
        existing.comments += analytics.comments ?? 0;
      }

      dailyMap.set(date, existing);
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPosts]);

  // Overall totals
  const totals = useMemo(() => {
    const result = {
      impressions: 0,
      reach: 0,
      engagement: 0,
      clicks: 0,
      shares: 0,
      comments: 0,
      totalPosts: filteredPosts.length,
    };

    for (const post of filteredPosts) {
      const analytics = post.analytics as Record<string, number> | null;
      if (analytics) {
        result.impressions += analytics.impressions ?? 0;
        result.reach += analytics.reach ?? 0;
        result.engagement += analytics.engagement ?? 0;
        result.clicks += analytics.clicks ?? 0;
        result.shares += analytics.shares ?? 0;
        result.comments += analytics.comments ?? 0;
      }
    }

    return result;
  }, [filteredPosts]);

  // Best performing posts
  const bestPosts = useMemo(() => {
    return [...filteredPosts]
      .sort((a, b) => {
        const aAnalytics = a.analytics as Record<string, number> | null;
        const bAnalytics = b.analytics as Record<string, number> | null;
        const aScore = (aAnalytics?.engagement ?? 0) + (aAnalytics?.clicks ?? 0);
        const bScore = (bAnalytics?.engagement ?? 0) + (bAnalytics?.clicks ?? 0);
        return bScore - aScore;
      })
      .slice(0, 5);
  }, [filteredPosts]);

  // Platform breakdown
  const platformBreakdown = useMemo(() => {
    const breakdown: Record<
      string,
      {
        platform: string;
        posts: number;
        impressions: number;
        engagement: number;
        clicks: number;
      }
    > = {};

    for (const post of posts) {
      const platforms = (post.platforms as string[]) ?? [];
      const analytics = post.analytics as Record<string, number> | null;

      for (const p of platforms) {
        if (!breakdown[p]) {
          breakdown[p] = { platform: p, posts: 0, impressions: 0, engagement: 0, clicks: 0 };
        }
        breakdown[p].posts += 1;
        if (analytics) {
          breakdown[p].impressions += analytics.impressions ?? 0;
          breakdown[p].engagement += analytics.engagement ?? 0;
          breakdown[p].clicks += analytics.clicks ?? 0;
        }
      }
    }

    return Object.values(breakdown);
  }, [posts]);

  const metrics: Array<{ key: MetricKey; label: string }> = [
    { key: 'impressions', label: 'Impressions' },
    { key: 'reach', label: 'Reach' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'clicks', label: 'Clicks' },
    { key: 'shares', label: 'Shares' },
    { key: 'comments', label: 'Comments' },
  ];

  const platformTabs: Array<{ label: string; value: PlatformFilter }> = [
    { label: 'All Platforms', value: 'all' },
    { label: 'Facebook', value: 'facebook' },
    { label: 'Instagram', value: 'instagram' },
    { label: 'LinkedIn', value: 'linkedin' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Loading analytics data...</p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100" />
            ))}
          </div>
          <div className="h-48 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track engagement and performance across your social channels
          </p>
        </div>
        <a
          href="/social"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Posts
        </a>
      </div>

      {/* Platform Filter */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {platformTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setPlatformFilter(tab.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              platformFilter === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => (
          <button
            key={metric.key}
            onClick={() => setSelectedMetric(metric.key)}
            className={cn(
              'rounded-xl border p-4 text-left transition-all',
              selectedMetric === metric.key
                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                : 'border-gray-200 bg-white hover:border-gray-300',
            )}
          >
            <p className="text-xs font-medium text-gray-500">{metric.label}</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {totals[metric.key].toLocaleString('en-AU')}
            </p>
          </button>
        ))}
      </div>

      {/* Engagement Chart */}
      <EngagementChart
        data={chartData}
        metric={selectedMetric}
        platform={platformFilter === 'all' ? undefined : platformFilter}
      />

      {/* Two-column layout: Best Posts + Platform Comparison */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Best Performing Posts */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Best Performing Posts</h3>
          <div className="mt-4 space-y-3">
            {bestPosts.length === 0 ? (
              <p className="text-sm text-gray-400">No published posts with analytics data</p>
            ) : (
              bestPosts.map((post, idx) => {
                const analytics = post.analytics as Record<string, number> | null;
                const platforms = (post.platforms as string[]) ?? [];
                const content = post.content as string;

                return (
                  <div
                    key={post.id as string}
                    className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex gap-1 mb-1">
                        {platforms.map((p) => (
                          <span
                            key={p}
                            className={cn(
                              'rounded px-1 py-0.5 text-[9px] font-bold',
                              p === 'facebook'
                                ? 'bg-blue-100 text-blue-700'
                                : p === 'instagram'
                                  ? 'bg-pink-100 text-pink-700'
                                  : 'bg-sky-100 text-sky-700',
                            )}
                          >
                            {p === 'facebook' ? 'FB' : p === 'instagram' ? 'IG' : 'LI'}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-700 truncate">{content}</p>
                      {analytics && (
                        <div className="mt-1 flex gap-3 text-[10px] text-gray-500">
                          <span>
                            {(analytics.engagement ?? 0).toLocaleString('en-AU')} engagements
                          </span>
                          <span>{(analytics.clicks ?? 0).toLocaleString('en-AU')} clicks</span>
                          <span>
                            {(analytics.impressions ?? 0).toLocaleString('en-AU')} impressions
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Platform Comparison */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Platform Comparison</h3>
          <div className="mt-4 space-y-4">
            {platformBreakdown.length === 0 ? (
              <p className="text-sm text-gray-400">No data available</p>
            ) : (
              platformBreakdown.map((pb) => {
                const maxImpressions = Math.max(...platformBreakdown.map((p) => p.impressions), 1);
                const barWidth = (pb.impressions / maxImpressions) * 100;

                return (
                  <div key={pb.platform} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold',
                            pb.platform === 'facebook'
                              ? 'bg-blue-100 text-blue-700'
                              : pb.platform === 'instagram'
                                ? 'bg-pink-100 text-pink-700'
                                : 'bg-sky-100 text-sky-700',
                          )}
                        >
                          {pb.platform === 'facebook'
                            ? 'FB'
                            : pb.platform === 'instagram'
                              ? 'IG'
                              : 'LI'}
                        </span>
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {pb.platform}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {pb.posts} post{pb.posts !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          pb.platform === 'facebook'
                            ? 'bg-blue-500'
                            : pb.platform === 'instagram'
                              ? 'bg-pink-500'
                              : 'bg-sky-500',
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    <div className="flex gap-4 text-[10px] text-gray-500">
                      <span>{pb.impressions.toLocaleString('en-AU')} impressions</span>
                      <span>{pb.engagement.toLocaleString('en-AU')} engagement</span>
                      <span>{pb.clicks.toLocaleString('en-AU')} clicks</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Audience Insights Summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Audience Insights Summary</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Engagement Rate</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {totals.impressions > 0
                ? ((totals.engagement / totals.impressions) * 100).toFixed(2)
                : '0.00'}
              %
            </p>
            <p className="mt-1 text-xs text-gray-400">Engagement / impressions across all posts</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Click-Through Rate</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {totals.impressions > 0
                ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
                : '0.00'}
              %
            </p>
            <p className="mt-1 text-xs text-gray-400">Clicks / impressions across all posts</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Average Engagement</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {totals.totalPosts > 0
                ? Math.round(totals.engagement / totals.totalPosts).toLocaleString('en-AU')
                : '0'}
            </p>
            <p className="mt-1 text-xs text-gray-400">Average engagements per published post</p>
          </div>
        </div>
      </div>
    </div>
  );
}
