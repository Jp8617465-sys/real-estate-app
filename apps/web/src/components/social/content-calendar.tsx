'use client';

import { PostCard } from './post-card';

interface ContentCalendarProps {
  posts: Array<Record<string, unknown>>;
  currentWeekStart: Date;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDayDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function ContentCalendar({ posts, currentWeekStart }: ContentCalendarProps) {
  const days = getDayDates(currentWeekStart);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 divide-x divide-gray-200">
        {days.map((day, idx) => {
          // Filter posts for this day
          const dayPosts = posts.filter((post) => {
            const scheduledAt = post.scheduled_at as string | null;
            if (!scheduledAt) return false;
            return isSameDay(new Date(scheduledAt), day);
          });

          return (
            <div key={idx} className="min-h-[200px]">
              {/* Day header */}
              <div
                className={`border-b border-gray-200 px-3 py-2 text-center ${
                  isToday(day) ? 'bg-brand-50' : 'bg-gray-50'
                }`}
              >
                <p className="text-xs font-medium text-gray-500">{DAY_LABELS[idx]}</p>
                <p
                  className={`text-sm font-semibold ${
                    isToday(day) ? 'text-brand-700' : 'text-gray-900'
                  }`}
                >
                  {day.getDate()}
                </p>
              </div>

              {/* Posts for this day */}
              <div className="space-y-2 p-2">
                {dayPosts.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">No posts scheduled</p>
                ) : (
                  dayPosts.map((post) => (
                    <PostCard key={post.id as string} post={post} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
