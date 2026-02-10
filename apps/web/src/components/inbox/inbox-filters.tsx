'use client';

import { cn } from '@/lib/utils';
import type { MessageChannel } from '@realflow/shared';

interface InboxFiltersProps {
  selectedChannels: MessageChannel[];
  onToggleChannel: (channel: MessageChannel) => void;
  showUnreadOnly: boolean;
  onToggleUnreadOnly: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  unreadCounts: Record<string, number>;
  totalUnread: number;
}

const CHANNEL_FILTERS: Array<{ channel: MessageChannel; label: string }> = [
  { channel: 'email', label: 'Email' },
  { channel: 'sms', label: 'SMS' },
  { channel: 'phone_call', label: 'Calls' },
  { channel: 'whatsapp', label: 'WhatsApp' },
  { channel: 'instagram_dm', label: 'Instagram' },
  { channel: 'facebook_messenger', label: 'Facebook' },
  { channel: 'domain_enquiry', label: 'Domain' },
  { channel: 'rea_enquiry', label: 'REA' },
];

export function InboxFilters({
  selectedChannels,
  onToggleChannel,
  showUnreadOnly,
  onToggleUnreadOnly,
  searchQuery,
  onSearchChange,
  unreadCounts,
  totalUnread,
}: InboxFiltersProps) {
  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Channel Filters */}
      <div className="flex items-center gap-1 overflow-x-auto px-4 pb-3">
        {/* All / Unread toggle */}
        <button
          onClick={onToggleUnreadOnly}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            showUnreadOnly
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          Unread
          {totalUnread > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white/20 px-1 text-xs">
              {totalUnread}
            </span>
          )}
        </button>

        <span className="mx-1 text-gray-300">|</span>

        {/* Channel filters */}
        {CHANNEL_FILTERS.map(({ channel, label }) => {
          const isActive = selectedChannels.includes(channel);
          const count = unreadCounts[channel] ?? 0;

          return (
            <button
              key={channel}
              onClick={() => onToggleChannel(channel)}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
              )}
            >
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    'ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-xs',
                    isActive ? 'bg-brand-200 text-brand-800' : 'bg-gray-200 text-gray-600',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
