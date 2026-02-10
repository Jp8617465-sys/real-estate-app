'use client';

import { useState, useMemo } from 'react';
import { useSocialPosts } from '@/hooks/use-social-posts';
import { ContentCalendar } from '@/components/social/content-calendar';
import { CreatePostDialog } from '@/components/social/create-post-dialog';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = 1, shift to make Monday the first day
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

type PlatformFilter = 'all' | 'instagram' | 'facebook' | 'linkedin';

export default function SocialPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const dateRange = useMemo(() => ({
    from: currentWeekStart.toISOString(),
    to: getWeekEnd(currentWeekStart).toISOString(),
  }), [currentWeekStart]);

  const { data: posts, isLoading } = useSocialPosts(
    dateRange,
    platformFilter === 'all' ? undefined : platformFilter,
  );

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
    { label: 'Instagram', value: 'instagram' },
    { label: 'Facebook', value: 'facebook' },
    { label: 'LinkedIn', value: 'linkedin' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="mt-1 text-sm text-gray-500">Schedule and manage social media posts</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Create Post
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-40 rounded bg-gray-100" />
            ))}
          </div>
        </div>
      ) : (
        <ContentCalendar
          posts={posts ?? []}
          currentWeekStart={currentWeekStart}
        />
      )}

      {/* Create Post Dialog */}
      {showCreateDialog && (
        <CreatePostDialog onClose={() => setShowCreateDialog(false)} />
      )}
    </div>
  );
}
