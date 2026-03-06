'use client';

import { useState, useMemo } from 'react';
import { useSocialPosts, useSocialAccounts, usePublishPost, useDeletePost } from '@/hooks/use-social';
import { PostCalendar } from '@/components/social/post-calendar';
import { PostComposer } from '@/components/social/post-composer';
import { SocialAccountCard } from '@/components/social/social-account-card';
import type { SocialPlatform, PostStatus } from '@realflow/shared';

// ─── Helpers ────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  const startMonth = weekStart.toLocaleDateString('en-AU', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-AU', { month: 'short' });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const year = weekStart.getFullYear();

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${startMonth} ${year}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
}

// ─── Types ───────────────────────────────────────────────────────────────

type PlatformFilter = 'all' | SocialPlatform;
type StatusFilter = 'all' | PostStatus;
type ViewMode = 'calendar' | 'list';

// ─── Page ────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [showComposer, setShowComposer] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  const publishPost = usePublishPost();
  const deletePost = useDeletePost();

  const dateRange = useMemo(() => ({
    dateFrom: currentWeekStart.toISOString(),
    dateTo: getWeekEnd(currentWeekStart).toISOString(),
    platform: platformFilter === 'all' ? undefined : platformFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  }), [currentWeekStart, platformFilter, statusFilter]);

  const { data: posts, isLoading } = useSocialPosts(dateRange);
  const { data: accounts } = useSocialAccounts();

  const goToPrevWeek = () => {
    setCurrentWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToToday = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  const platformTabs: Array<{ label: string; value: PlatformFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Facebook', value: 'facebook' },
    { label: 'Instagram', value: 'instagram' },
    { label: 'LinkedIn', value: 'linkedin' },
  ];

  const statusTabs: Array<{ label: string; value: StatusFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Drafts', value: 'draft' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Published', value: 'published' },
    { label: 'Failed', value: 'failed' },
  ];

  // Stats
  const totalPosts = posts?.length ?? 0;
  const draftCount = posts?.filter((p) => p.status === 'draft').length ?? 0;
  const scheduledCount = posts?.filter((p) => p.status === 'scheduled').length ?? 0;
  const publishedCount = posts?.filter((p) => p.status === 'published').length ?? 0;
  const failedCount = posts?.filter((p) => p.status === 'failed').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Publishing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, schedule, and publish posts across Facebook, Instagram, and LinkedIn
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAccounts(!showAccounts)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showAccounts ? 'Hide Accounts' : 'Accounts'}
          </button>
          <a
            href="/social/analytics"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Analytics
          </a>
          <button
            onClick={() => setShowComposer(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Create Post
          </button>
        </div>
      </div>

      {/* Connected Accounts */}
      {showAccounts && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>
          {accounts && accounts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <SocialAccountCard
                  key={account.id as string}
                  account={account}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm text-gray-500">No social accounts connected</p>
              <p className="mt-1 text-xs text-gray-400">
                Connect your Facebook, Instagram, or LinkedIn accounts to start publishing
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Posts', value: totalPosts, color: 'text-gray-900' },
          { label: 'Drafts', value: draftCount, color: 'text-gray-600' },
          { label: 'Scheduled', value: scheduledCount, color: 'text-yellow-600' },
          { label: 'Published', value: publishedCount, color: 'text-green-600' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium text-gray-500">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Controls Row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Prev
          </button>
          <button
            onClick={goToToday}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={goToNextWeek}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Next
          </button>
          <span className="ml-2 text-sm font-semibold text-gray-900">
            {formatWeekLabel(currentWeekStart)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
          </div>

          {/* Platform Tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {platformTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setPlatformFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  platformFilter === tab.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                {tab.value === 'failed' && failedCount > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                    {failedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-40 rounded bg-gray-100" />
            ))}
          </div>
        </div>
      ) : viewMode === 'calendar' ? (
        <PostCalendar
          posts={posts ?? []}
          currentWeekStart={currentWeekStart}
        />
      ) : (
        /* List View */
        <div className="space-y-3">
          {(posts ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-500">No posts found for this period</p>
              <button
                onClick={() => setShowComposer(true)}
                className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Create your first post
              </button>
            </div>
          ) : (
            (posts ?? []).map((post) => {
              const postId = post.id as string;
              const status = post.status as string;

              return (
                <div
                  key={postId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {((post.platforms as string[]) ?? []).map((p) => (
                        <span
                          key={p}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            p === 'facebook' ? 'bg-blue-100 text-blue-700'
                              : p === 'instagram' ? 'bg-pink-100 text-pink-700'
                                : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {p === 'facebook' ? 'FB' : p === 'instagram' ? 'IG' : 'LI'}
                        </span>
                      ))}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                        status === 'draft' ? 'bg-gray-100 text-gray-600'
                          : status === 'scheduled' ? 'bg-yellow-100 text-yellow-700'
                            : status === 'published' ? 'bg-green-100 text-green-700'
                              : status === 'failed' ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                      }`}>
                        {status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 truncate">
                      {post.content as string}
                    </p>
                    {post.scheduled_at ? (
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(post.scheduled_at as string).toLocaleString('en-AU', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="ml-4 flex gap-2">
                    {(status === 'draft' || status === 'failed') && (
                      <button
                        onClick={() => publishPost.mutate(postId)}
                        disabled={publishPost.isPending}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        Publish
                      </button>
                    )}
                    {(status === 'draft' || status === 'scheduled') && (
                      <button
                        onClick={() => deletePost.mutate(postId)}
                        disabled={deletePost.isPending}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Composer Modal */}
      {showComposer && (
        <PostComposer onClose={() => setShowComposer(false)} />
      )}
    </div>
  );
}
