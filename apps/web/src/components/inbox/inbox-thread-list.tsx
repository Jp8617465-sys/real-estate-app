'use client';

import { cn } from '@/lib/utils';
import { ChannelIcon } from './channel-icon';
import type { MessageChannel } from '@realflow/shared';

interface InboxThread {
  contact_id: string;
  contact_first_name: string;
  contact_last_name: string;
  last_message_channel: MessageChannel;
  last_message_direction: 'inbound' | 'outbound';
  last_message_content: { text?: string; subject?: string };
  last_message_at: string;
  last_message_is_read: boolean;
  unread_count: number;
  channels: MessageChannel[];
}

interface InboxThreadListProps {
  threads: InboxThread[];
  selectedContactId: string | null;
  onSelectThread: (contactId: string) => void;
  isLoading: boolean;
}

export function InboxThreadList({
  threads,
  selectedContactId,
  onSelectThread,
  isLoading,
}: InboxThreadListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg bg-gray-100 p-4">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (!threads.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-gray-500">No conversations yet</p>
        <p className="mt-1 text-xs text-gray-400">
          Messages from email, SMS, social media, and portal enquiries will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {threads.map((thread) => {
        const isSelected = thread.contact_id === selectedContactId;
        const isUnread = thread.unread_count > 0;
        const preview = thread.last_message_content?.subject ?? thread.last_message_content?.text ?? '';
        const timeAgo = formatRelativeTime(thread.last_message_at);

        return (
          <button
            key={thread.contact_id}
            onClick={() => onSelectThread(thread.contact_id)}
            className={cn(
              'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
              isSelected && 'bg-brand-50 hover:bg-brand-50',
              isUnread && !isSelected && 'bg-blue-50/30',
            )}
          >
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {thread.contact_first_name[0]}
              {thread.contact_last_name[0]}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'truncate text-sm',
                    isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700',
                  )}
                >
                  {thread.contact_first_name} {thread.contact_last_name}
                </span>
                <span className="ml-2 shrink-0 text-xs text-gray-400">{timeAgo}</span>
              </div>

              <div className="mt-0.5 flex items-center gap-1.5">
                <ChannelIcon channel={thread.last_message_channel} />
                <p
                  className={cn(
                    'truncate text-xs',
                    isUnread ? 'font-medium text-gray-700' : 'text-gray-500',
                  )}
                >
                  {thread.last_message_direction === 'outbound' && (
                    <span className="text-gray-400">You: </span>
                  )}
                  {preview.slice(0, 80)}
                </p>
              </div>

              {/* Channel badges */}
              {thread.channels.length > 1 && (
                <div className="mt-1 flex gap-0.5">
                  {thread.channels.map((ch) => (
                    <ChannelIcon key={ch} channel={ch} className="opacity-50" />
                  ))}
                </div>
              )}
            </div>

            {/* Unread badge */}
            {isUnread && (
              <span className="mt-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                {thread.unread_count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
