'use client';

import { useState, useCallback } from 'react';
import { InboxThreadList } from '@/components/inbox/inbox-thread-list';
import { ConversationView } from '@/components/inbox/conversation-view';
import { InboxFilters } from '@/components/inbox/inbox-filters';
import {
  useInboxThreads,
  useConversationThread,
  useSendMessage,
  useMarkAsRead,
  useUnreadCounts,
} from '@/hooks/use-inbox';
import type { MessageChannel, MessageContent } from '@realflow/shared';

export default function InboxPage() {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<MessageChannel[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: threads, isLoading: threadsLoading } = useInboxThreads({
    channels: selectedChannels.length > 0 ? selectedChannels : undefined,
    isRead: showUnreadOnly ? false : undefined,
    searchQuery: searchQuery || undefined,
  });

  const { data: conversation, isLoading: conversationLoading } = useConversationThread(
    selectedContactId ?? '',
  );

  const { data: unreadData } = useUnreadCounts();

  // Mutations
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  // Selected contact name
  const selectedThread = threads?.find(
    (t: Record<string, unknown>) => t.contact_id === selectedContactId,
  ) as Record<string, string> | undefined;
  const contactName = selectedThread
    ? `${selectedThread.contact_first_name} ${selectedThread.contact_last_name}`
    : '';

  // Handlers
  const handleSelectThread = useCallback(
    (contactId: string) => {
      setSelectedContactId(contactId);
      markAsRead.mutate(contactId);
    },
    [markAsRead],
  );

  const handleToggleChannel = useCallback((channel: MessageChannel) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }, []);

  const handleSendMessage = useCallback(
    (params: { channel: MessageChannel; content: MessageContent }) => {
      if (!selectedContactId) return;
      sendMessage.mutate({
        contactId: selectedContactId,
        channel: params.channel,
        content: params.content,
      });
    },
    [selectedContactId, sendMessage],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
          <p className="text-sm text-gray-500">
            All conversations across every channel
          </p>
        </div>
        {unreadData && unreadData.total > 0 && (
          <span className="rounded-full bg-brand-600 px-3 py-1 text-sm font-semibold text-white">
            {unreadData.total} unread
          </span>
        )}
      </div>

      {/* Main Content: Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Thread List */}
        <div className="flex w-full flex-col border-r border-gray-200 lg:w-96">
          <InboxFilters
            selectedChannels={selectedChannels}
            onToggleChannel={handleToggleChannel}
            showUnreadOnly={showUnreadOnly}
            onToggleUnreadOnly={() => setShowUnreadOnly((prev) => !prev)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            unreadCounts={unreadData?.counts ?? {}}
            totalUnread={unreadData?.total ?? 0}
          />

          <div className="flex-1 overflow-y-auto">
            <InboxThreadList
              threads={(threads ?? []) as Parameters<typeof InboxThreadList>[0]['threads']}
              selectedContactId={selectedContactId}
              onSelectThread={handleSelectThread}
              isLoading={threadsLoading}
            />
          </div>
        </div>

        {/* Right Panel: Conversation View */}
        <div className="hidden flex-1 lg:flex">
          {selectedContactId ? (
            <ConversationView
              contactId={selectedContactId}
              contactName={contactName}
              messages={conversation?.messages ?? []}
              totalMessages={conversation?.totalMessages ?? 0}
              isLoading={conversationLoading}
              onSendMessage={handleSendMessage}
              isSending={sendMessage.isPending}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">Select a conversation</p>
                <p className="mt-1 text-xs text-gray-500">
                  Choose a contact from the list to view their messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
