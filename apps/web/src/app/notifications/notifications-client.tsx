'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useMarkNotificationRead,
  useDismissNotification,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notifications';
import type { Notification } from '@realflow/shared';

const CATEGORY_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Unread', value: 'unread' },
  { label: 'Matches', value: 'property_match' },
  { label: 'Deadlines', value: 'key_date' },
  { label: 'Leads', value: 'new_lead' },
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  new_lead: '👤',
  property_match: '🏠',
  key_date: '📅',
  pipeline_update: '📈',
  follow_up_due: '💬',
  daily_action_list: '⭐',
  system: '🔔',
  digest: '📋',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; items: Notification[] }[] = [];
  const todayItems = items.filter((n) => new Date(n.createdAt) >= today);
  const yesterdayItems = items.filter(
    (n) => new Date(n.createdAt) >= yesterday && new Date(n.createdAt) < today,
  );
  const thisWeekItems = items.filter(
    (n) => new Date(n.createdAt) >= weekAgo && new Date(n.createdAt) < yesterday,
  );
  const olderItems = items.filter((n) => new Date(n.createdAt) < weekAgo);

  if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (thisWeekItems.length > 0) groups.push({ label: 'This Week', items: thisWeekItems });
  if (olderItems.length > 0) groups.push({ label: 'Older', items: olderItems });
  return groups;
}

function NotificationRow({
  notification,
  onMarkRead,
  onDismiss,
}: {
  notification: Notification;
  onMarkRead: () => void;
  onDismiss: () => void;
}) {
  const icon = CATEGORY_ICONS[notification.category] ?? '🔔';
  const priorityClass =
    PRIORITY_COLORS[notification.priority] ?? PRIORITY_COLORS['low']!;

  return (
    <div
      className={`flex items-start gap-4 rounded-xl border px-4 py-3 transition-colors ${
        notification.status !== 'read' ? 'border-brand-200 bg-brand-50/30' : 'border-gray-100 bg-white'
      }`}
    >
      {/* Icon */}
      <span className="mt-0.5 text-xl leading-none">{icon}</span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm font-medium ${
              notification.status !== 'read' ? 'text-gray-900' : 'text-gray-700'
            }`}
          >
            {notification.title}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityClass}`}>
              {notification.priority}
            </span>
            <span className="text-xs text-gray-400">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>
        </div>
        {notification.body && (
          <p className="mt-1 text-sm text-gray-500">{notification.body}</p>
        )}
        <div className="mt-2 flex items-center gap-3">
          {notification.status !== 'read' && (
            <button
              onClick={onMarkRead}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Mark read
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function PreferencesPanel() {
  const { data: prefs } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [quietStart, setQuietStart] = useState(prefs?.quietHoursStart ?? '21:00');
  const [quietEnd, setQuietEnd] = useState(prefs?.quietHoursEnd ?? '07:00');
  const [digestEnabled, setDigestEnabled] = useState(prefs?.digestModeEnabled ?? true);

  function handleSave() {
    update.mutate({ quietHoursStart: quietStart, quietHoursEnd: quietEnd, digestModeEnabled: digestEnabled });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Notification Preferences</h3>
      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700">Quiet Hours</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span className="text-xs text-gray-500">to</span>
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="digest"
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="digest" className="text-sm text-gray-700">
            Enable daily digest (batched low-priority notifications)
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  );
}

export function NotificationsClient() {
  const [filter, setFilter] = useState<{ label: string; value: string | undefined }>({
    label: 'All',
    value: undefined,
  });
  const [showPrefs, setShowPrefs] = useState(false);

  const { data, isLoading } = useNotifications(
    filter.value === 'unread'
      ? { status: 'unread' }
      : filter.value
      ? { category: filter.value }
      : undefined,
  );
  const markRead = useMarkNotificationRead();
  const dismiss = useDismissNotification();

  const notifications = data?.data ?? [];
  const groups = groupByDate(notifications);
  const unreadIds = notifications.filter((n) => n.status !== 'read').map((n) => n.id);

  function handleMarkAllRead() {
    unreadIds.forEach((id) => markRead.mutate(id));
  }

  function handleBulkDismiss() {
    unreadIds.forEach((id) => dismiss.mutate(id));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">Your activity feed and alerts</p>
        </div>
        <button
          onClick={() => setShowPrefs((p) => !p)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          ⚙️ Preferences
        </button>
      </div>

      {/* Preferences panel */}
      {showPrefs && <PreferencesPanel />}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              filter.label === f.label
                ? 'bg-brand-100 text-brand-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {unreadIds.length > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">{unreadIds.length} unread</span>
          <button
            onClick={handleMarkAllRead}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Mark all read
          </button>
          <button
            onClick={handleBulkDismiss}
            className="font-medium text-gray-500 hover:text-gray-700"
          >
            Dismiss all
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-start gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3"
            >
              <div className="h-7 w-7 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <span className="text-4xl">🔔</span>
          <p className="mt-3 text-sm font-medium text-gray-900">No notifications</p>
          <p className="mt-1 text-sm text-gray-500">You're all caught up!</p>
        </div>
      )}

      {/* Grouped notifications */}
      {!isLoading &&
        groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onMarkRead={() => markRead.mutate(notification.id)}
                  onDismiss={() => dismiss.mutate(notification.id)}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
