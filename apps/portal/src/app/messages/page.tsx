'use client';

import { useState } from 'react';
import { Send, Paperclip } from 'lucide-react';

// ── Mock data ────────────────────────────────────────────────────────
interface MockMessage {
  id: string;
  sender: 'agent' | 'client';
  senderName: string;
  content: string;
  timestamp: string;
}

const MOCK_MESSAGES: MockMessage[] = [
  {
    id: '1',
    sender: 'agent',
    senderName: 'Alex Morgan',
    content:
      'Hi Sarah, I have great news! We have had our offer accepted on 42 Latrobe Terrace at $1,095,000. Contracts have been sent to Henderson & Partners for review.',
    timestamp: '2026-02-05T10:30:00Z',
  },
  {
    id: '2',
    sender: 'client',
    senderName: 'Sarah Johnson',
    content:
      'That is wonderful news! James and I are so excited. What are the next steps from here?',
    timestamp: '2026-02-05T10:45:00Z',
  },
  {
    id: '3',
    sender: 'agent',
    senderName: 'Alex Morgan',
    content:
      'The main priorities are: 1) Building & pest inspection - I have booked this for Monday 10 Feb at 9am. 2) Mark Henderson will review the contract and advise on any special conditions. 3) We need to confirm finance approval with your broker. I will keep the due diligence tracker updated so you can follow along in the portal.',
    timestamp: '2026-02-05T11:00:00Z',
  },
  {
    id: '4',
    sender: 'client',
    senderName: 'Sarah Johnson',
    content:
      'Perfect, that all makes sense. I have already called our broker and they are starting the formal approval process. Should we be concerned about anything with the inspection?',
    timestamp: '2026-02-05T14:20:00Z',
  },
  {
    id: '5',
    sender: 'agent',
    senderName: 'Alex Morgan',
    content:
      'The property presented well at inspection, so I am not expecting any major surprises. The roof looks sound and there were no visible signs of structural issues. We will know more after Monday. I will call you as soon as I have the report.',
    timestamp: '2026-02-05T14:35:00Z',
  },
  {
    id: '6',
    sender: 'agent',
    senderName: 'Alex Morgan',
    content:
      'Update: Building & pest is done. Report has been uploaded to your Documents section. Minor timber damage in the subfloor area noted - inspector confirmed it is not structural and does not require immediate attention. Overall a clean report. Happy to chat through it in detail whenever suits.',
    timestamp: '2026-02-10T16:15:00Z',
  },
  {
    id: '7',
    sender: 'client',
    senderName: 'Sarah Johnson',
    content:
      'Thanks Alex, I have had a look at the report. Relieved to hear nothing major. When do we need to confirm we are proceeding? And any update on the bank valuation?',
    timestamp: '2026-02-10T18:00:00Z',
  },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function groupByDate(messages: MockMessage[]): Record<string, MockMessage[]> {
  const grouped: Record<string, MockMessage[]> = {};
  for (const msg of messages) {
    const dateKey = new Date(msg.timestamp).toISOString().split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(msg);
  }
  return grouped;
}

export default function MessagesPage() {
  const [messageText, setMessageText] = useState('');
  const grouped = groupByDate(MOCK_MESSAGES);
  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-500">
          Chat with your buyers agent, Alex Morgan
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50">
        <div className="space-y-6 p-4 sm:p-6">
          {sortedDates.map((dateKey) => {
            const messages = grouped[dateKey];
            return (
              <div key={dateKey} className="space-y-4">
                {/* Date separator */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-medium text-gray-400">
                    {formatDate(messages[0].timestamp)}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Messages */}
                {messages.map((msg) => {
                  const isClient = msg.sender === 'client';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] ${
                          isClient ? 'order-1' : ''
                        }`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-2.5 ${
                            isClient
                              ? 'bg-portal-600 text-white'
                              : 'bg-white text-gray-900 shadow-sm'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                        <div
                          className={`mt-1 flex items-center gap-1.5 text-[11px] text-gray-400 ${
                            isClient ? 'justify-end' : ''
                          }`}
                        >
                          <span>{msg.senderName}</span>
                          <span>{formatTime(msg.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Message input */}
      <div className="shrink-0 pt-4">
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="shrink-0 rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-portal-300 focus:outline-none focus:ring-2 focus:ring-portal-100"
            />
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl bg-portal-600 p-2.5 text-white shadow-sm transition-colors hover:bg-portal-700 disabled:opacity-50"
            disabled={!messageText.trim()}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          Messages are visible to your buyers agent team
        </p>
      </div>
    </div>
  );
}
