'use client';

import { cn } from '@/lib/utils';
import { PostCard } from './post-card';

interface PostCalendarProps {
  posts: Array<Record<string, unknown>>;
  currentWeekStart: Date;
  onPostClick?: (postId: string) => void;
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

export function PostCalendar({ posts, currentWeekStart, onPostClick }: PostCalendarProps) {
  const days = getDayDates(currentWeekStart);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Desktop: 7-column grid */}
      <div className="hidden sm:grid sm:grid-cols-7 sm:divide-x sm:divide-gray-200">
        {days.map((day, idx) => {
          const dayPosts = posts.filter((post) => {
            const scheduledAt = post.scheduled_at as string | null;
            if (!scheduledAt) return false;
            return isSameDay(new Date(scheduledAt), day);
          });

          return (
            <div key={idx} className="min-h-[200px]">
              <div
                className={cn(
                  'border-b border-gray-200 px-3 py-2 text-center',
                  isToday(day) ? 'bg-brand-50' : 'bg-gray-50',
                )}
              >
                <p className="text-xs font-medium text-gray-500">{DAY_LABELS[idx]}</p>
                <p
                  className={cn(
                    'text-sm font-semibold',
                    isToday(day) ? 'text-brand-700' : 'text-gray-900',
                  )}
                >
                  {day.getDate()}
                </p>
              </div>
              <div className="space-y-2 p-2">
                {dayPosts.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">No posts</p>
                ) : (
                  dayPosts.map((post) => (
                    <div
                      key={post.id as string}
                      onClick={() => onPostClick?.(post.id as string)}
                      className={onPostClick ? 'cursor-pointer' : ''}
                    >
                      <PostCard post={post} />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical list */}
      <div className="divide-y divide-gray-200 sm:hidden">
        {days.map((day, idx) => {
          const dayPosts = posts.filter((post) => {
            const scheduledAt = post.scheduled_at as string | null;
            if (!scheduledAt) return false;
            return isSameDay(new Date(scheduledAt), day);
          });

          if (dayPosts.length === 0) return null;

          return (
            <div key={idx} className="p-3">
              <p
                className={cn(
                  'mb-2 text-sm font-semibold',
                  isToday(day) ? 'text-brand-700' : 'text-gray-900',
                )}
              >
                {DAY_LABELS[idx]} {day.getDate()}{' '}
                {day.toLocaleDateString('en-AU', { month: 'short' })}
                {isToday(day) && (
                  <span className="ml-1 text-xs font-normal text-brand-500">(Today)</span>
                )}
              </p>
              <div className="space-y-2">
                {dayPosts.map((post) => (
                  <div
                    key={post.id as string}
                    onClick={() => onPostClick?.(post.id as string)}
                    className={onPostClick ? 'cursor-pointer' : ''}
                  >
                    <PostCard post={post} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
