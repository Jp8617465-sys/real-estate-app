'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChannelIcon, getChannelLabel } from './channel-icon';
import type { MessageChannel, ConversationMessage, MessageContent } from '@realflow/shared';

interface ConversationViewProps {
  contactId: string;
  contactName: string;
  messages: ConversationMessage[];
  totalMessages: number;
  isLoading: boolean;
  onSendMessage: (params: {
    channel: MessageChannel;
    content: MessageContent;
  }) => void;
  isSending: boolean;
}

const REPLY_CHANNELS: MessageChannel[] = [
  'email',
  'sms',
  'whatsapp',
  'instagram_dm',
  'facebook_messenger',
  'internal_note',
];

export function ConversationView({
  contactId,
  contactName,
  messages,
  totalMessages,
  isLoading,
  onSendMessage,
  isSending,
}: ConversationViewProps) {
  const [replyText, setReplyText] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('email');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Auto-select the channel the contact last used
  useEffect(() => {
    if (messages.length > 0) {
      const lastInbound = [...messages]
        .reverse()
        .find((m) => m.direction === 'inbound');
      if (lastInbound && REPLY_CHANNELS.includes(lastInbound.channel)) {
        setSelectedChannel(lastInbound.channel);
      }
    }
  }, [contactId, messages]);

  const handleSend = () => {
    if (!replyText.trim()) return;

    const content: MessageContent = {
      text: replyText,
    };

    if (selectedChannel === 'email' && replySubject) {
      content.subject = replySubject;
    }

    onSendMessage({ channel: selectedChannel, content });
    setReplyText('');
    setReplySubject('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-gray-400">Loading conversation...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{contactName}</h2>
            <p className="text-xs text-gray-500">
              {totalMessages} messages across{' '}
              {new Set(messages.map((m) => m.channel)).size} channels
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              View Contact
            </button>
          </div>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply Composer */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        {/* Channel Selector */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-gray-500">Reply via:</span>
          <div className="flex gap-1">
            {REPLY_CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedChannel === ch
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {getChannelLabel(ch)}
              </button>
            ))}
          </div>
        </div>

        {/* Subject line for email */}
        {selectedChannel === 'email' && (
          <input
            type="text"
            value={replySubject}
            onChange={(e) => setReplySubject(e.target.value)}
            placeholder="Subject"
            className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        )}

        {/* Message Input */}
        <div className="flex items-end gap-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Type a ${getChannelLabel(selectedChannel)} message...`}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || isSending}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
              replyText.trim() && !isSending
                ? 'bg-brand-600 hover:bg-brand-700'
                : 'cursor-not-allowed bg-gray-300',
            )}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>

        {/* 24hr window warning for social channels */}
        {(selectedChannel === 'instagram_dm' || selectedChannel === 'facebook_messenger') && (
          <p className="mt-2 text-xs text-amber-600">
            Social DM replies are only possible within 24 hours of the contact's last message.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Message Bubble Component ────────────────────────────────────────────

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isOutbound = message.direction === 'outbound';
  const isInternalNote = message.channel === 'internal_note';
  const time = new Date(message.createdAt).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Date(message.createdAt).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Phone call display
  if (message.channel === 'phone_call') {
    const outcome = message.metadata?.callOutcome ?? 'unknown';
    const duration = message.metadata?.callDuration;

    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <ChannelIcon channel="phone_call" />
        <span className="text-xs text-gray-500">
          Phone call ({outcome})
          {duration ? ` - ${Math.floor(duration / 60)}m ${duration % 60}s` : ''}
        </span>
        <span className="text-xs text-gray-400">{time}</span>
      </div>
    );
  }

  // Internal note display
  if (isInternalNote) {
    return (
      <div className="mx-8 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
        <div className="flex items-center gap-1.5">
          <ChannelIcon channel="internal_note" />
          <span className="text-xs font-medium text-yellow-700">Internal Note</span>
          <span className="text-xs text-yellow-500">{time} - {date}</span>
        </div>
        <p className="mt-1 text-sm text-yellow-800">{message.content.text}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2.5',
          isOutbound
            ? 'rounded-br-md bg-brand-600 text-white'
            : 'rounded-bl-md bg-gray-100 text-gray-900',
        )}
      >
        {/* Subject line for emails */}
        {message.content.subject && (
          <p
            className={cn(
              'mb-1 text-xs font-semibold',
              isOutbound ? 'text-brand-200' : 'text-gray-500',
            )}
          >
            {message.content.subject}
          </p>
        )}

        {/* Message body */}
        <p className="whitespace-pre-wrap text-sm">{message.content.text}</p>

        {/* Attachments */}
        {message.content.attachments && message.content.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.content.attachments.map((att) => (
              <div
                key={att.id}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1 text-xs',
                  isOutbound ? 'bg-brand-500/50' : 'bg-gray-200',
                )}
              >
                <span>📎</span>
                <span className="truncate">{att.fileName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer: channel + time */}
        <div
          className={cn(
            'mt-1 flex items-center gap-1.5 text-xs',
            isOutbound ? 'text-brand-200' : 'text-gray-400',
          )}
        >
          <ChannelIcon channel={message.channel} className="opacity-60" />
          <span>{time}</span>
          {message.status === 'failed' && (
            <span className="font-medium text-red-400">Failed</span>
          )}
        </div>
      </div>
    </div>
  );
}
