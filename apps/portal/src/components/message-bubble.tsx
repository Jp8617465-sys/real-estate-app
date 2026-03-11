'use client';

import { Check, CheckCheck } from 'lucide-react';
import type { PortalMessage } from '@/hooks/use-portal-messages';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

interface MessageBubbleProps {
  message: PortalMessage;
  senderName: string;
  isClient: boolean;
}

export function MessageBubble({ message, senderName, isClient }: MessageBubbleProps) {
  const hasAttachments = message.content?.attachments && message.content.attachments.length > 0;

  return (
    <div className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] ${isClient ? 'order-1' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isClient ? 'bg-portal-600 text-white' : 'bg-white text-gray-900 shadow-sm'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content?.text ?? ''}
          </p>

          {/* Attachments */}
          {hasAttachments && (
            <div className="mt-2 space-y-1">
              {(message.content.attachments ?? []).map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs underline ${
                    isClient
                      ? 'text-portal-100 hover:text-white'
                      : 'text-portal-600 hover:text-portal-700'
                  }`}
                >
                  {attachment.fileName}
                </a>
              ))}
            </div>
          )}
        </div>
        <div
          className={`mt-1 flex items-center gap-1.5 text-[11px] text-gray-400 ${
            isClient ? 'justify-end' : ''
          }`}
        >
          <span>{senderName}</span>
          <span>{formatTime(message.created_at)}</span>
          {/* Read receipt indicator for client messages */}
          {isClient && (
            <span aria-label={message.is_read ? 'Read' : 'Delivered'}>
              {message.is_read ? (
                <CheckCheck className="h-3 w-3 text-portal-400" aria-hidden="true" />
              ) : (
                <Check className="h-3 w-3 text-gray-300" aria-hidden="true" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
