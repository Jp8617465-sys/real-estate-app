'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Loader2, MessageSquare } from 'lucide-react';
import { usePortalMessages, useSendMessage } from '@/hooks/use-portal-messages';
import { usePortalClient } from '@/hooks/use-auth';
import type { PortalMessage } from '@/hooks/use-portal-messages';
import { useUploadDocument } from '@/hooks/use-documents';
import { LoadingSpinner } from '@/components/loading-spinner';
import { EmptyState } from '@/components/empty-state';
import { MessageBubble } from '@/components/message-bubble';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function groupByDate(messages: PortalMessage[]): Record<string, PortalMessage[]> {
  const grouped: Record<string, PortalMessage[]> = {};
  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toISOString().split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(msg);
  }
  return grouped;
}

export default function MessagesPage() {
  const [messageText, setMessageText] = useState('');
  const { data: portalClient } = usePortalClient();
  const { data: messages, isLoading, error } = usePortalMessages();
  const sendMutation = useSendMessage();
  const uploadMutation = useUploadDocument();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const agentName = portalClient?.agent?.full_name ?? 'Your Agent';
  const clientName = portalClient?.contact
    ? `${portalClient.contact.first_name} ${portalClient.contact.last_name}`
    : 'You';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!messageText.trim()) return;

    sendMutation.mutate(
      { text: messageText.trim() },
      {
        onSuccess: () => {
          setMessageText('');
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadMutation.mutate(
      { file, category: 'other' },
      {
        onSuccess: () => {
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        },
      },
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading messages..." />;
  }

  if (error) {
    return (
      <EmptyState
        icon={MessageSquare}
        heading="Unable to load messages"
        description="Please try again later."
      />
    );
  }

  const allMessages = messages ?? [];
  const grouped = groupByDate(allMessages);
  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-500">
          Chat with your buyers agent, {agentName}
        </p>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50"
        role="log"
        aria-label="Message history"
        aria-live="polite"
      >
        <div className="space-y-6 p-4 sm:p-6">
          {allMessages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              heading="No messages yet"
              description="Send a message to start a conversation with your agent."
            />
          ) : (
            sortedDates.map((dateKey) => {
              const dateMessages = grouped[dateKey];
              return (
                <div key={dateKey} className="space-y-4">
                  {/* Date separator */}
                  <div className="flex items-center gap-3" role="separator">
                    <div className="h-px flex-1 bg-gray-200" aria-hidden="true" />
                    <span className="text-xs font-medium text-gray-400">
                      {formatDate(dateMessages[0].created_at)}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" aria-hidden="true" />
                  </div>

                  {/* Messages */}
                  {dateMessages.map((msg) => {
                    const isClient = msg.direction === 'outbound';
                    const senderName = isClient ? clientName : agentName;

                    return (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        senderName={senderName}
                        isClient={isClient}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message input */}
      <div className="shrink-0 pt-4">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={uploadMutation.isPending}
            className="shrink-0 rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500"
            aria-label="Attach file"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <div className="flex-1">
            <label htmlFor="message-input" className="sr-only">
              Type a message
            </label>
            <textarea
              id="message-input"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-portal-300 focus:outline-none focus:ring-2 focus:ring-portal-100"
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!messageText.trim() || sendMutation.isPending}
            className="shrink-0 rounded-xl bg-portal-600 p-2.5 text-white shadow-sm transition-colors hover:bg-portal-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500 focus-visible:ring-offset-2"
            aria-label="Send message"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          Messages are visible to your buyers agent team
        </p>
      </div>
    </div>
  );
}
