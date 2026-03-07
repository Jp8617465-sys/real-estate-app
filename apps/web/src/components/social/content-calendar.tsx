'use client';

import { PostCalendar } from './post-calendar';

/**
 * ContentCalendar is a backward-compatible wrapper around PostCalendar.
 * Existing pages that import ContentCalendar continue to work unchanged.
 */

interface ContentCalendarProps {
  posts: Array<Record<string, unknown>>;
  currentWeekStart: Date;
}

export function ContentCalendar({ posts, currentWeekStart }: ContentCalendarProps) {
  return <PostCalendar posts={posts} currentWeekStart={currentWeekStart} />;
}
