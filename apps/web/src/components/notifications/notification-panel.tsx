'use client';

import Link from 'next/link';
import {
  useNotifications,
  useMarkNotificationRead,
  useDismissNotification,
} from '@/hooks/use-notifications';
import type { Notification } from '@realflow/shared';

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

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function groupByDate(items: Notification[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: Notification[] }[] = [];
  const todayItems = items.filter((n) => new Date(n.createdAt) >= today);
  const yesterdayItems = items.filter(
    (n) => new Date(n.createdAt) >= yesterday && new Date(n.createdAt) < today,
  );
  const olderItems = items.filter((n) => new Date(n.createdAt) < yesterday);

  if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (olderItems.length > 0) groups.push({ label: 'Earlier', items: olderItems });
  return groups;
}

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { data, isLoading } = useNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const dismiss = useDismissNotification();

  const notifications = data?.data ?? [];
  const unreadIds = notifications.filter((n) => n.status !== 'read').map((n) => n.id);

  function handleMarkAllRead() {
    unreadIds.forEach((id) => markRead.mutate(id));
  }

  const groups = groupByDate(notifications);

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg sm:w-96">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {unreadIds.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[440px] overflow-y-auto">
        {isLoading && (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            All caught up! No new notifications.
          </p>
        )}

        {!isLoading &&
          groups.map((group) => (
            <div key={group.label}>
              <p className="sticky top-0 bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group.label}
              </p>
              {group.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onDismiss={() => dismiss.mutate(notification.id)}
                  onRead={() => {
                    if (notification.status !== 'read') markRead.mutate(notification.id);
                    onClose();
                  }}
                />
              ))}
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <Link
          href="/notifications"
          onClick={onClose}
          className="block text-center text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}

function NotificationRow({
  notification,
  onDismiss,
  onRead,
}: {
  notification: Notification;
  onDismiss: () => void;
  onRead: () => void;
}) {
  const icon = CATEGORY_ICONS[notification.category] ?? '🔔';

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
        notification.status !== 'read' ? 'bg-brand-50/40' : ''
      }`}
    >
      {/* Unread dot */}
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          notification.status !== 'read' ? 'bg-brand-500' : 'bg-transparent'
        }`}
      />

      {/* Icon */}
      <span className="text-lg leading-none">{icon}</span>

      {/* Content */}
      <button className="flex-1 text-left" onClick={onRead}>
        <p className="text-sm font-medium text-gray-900 line-clamp-1">{notification.title}</p>
        {notification.body && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{notification.body}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(notification.createdAt)}</p>
      </button>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="mt-0.5 shrink-0 text-gray-300 hover:text-gray-500"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
