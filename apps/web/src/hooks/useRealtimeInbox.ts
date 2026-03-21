'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeSubscription, type RealtimeChangePayload } from './useRealtime';
import { RealtimeChannels, PresenceChannels } from '@realflow/shared';
import type { ConversationMessageRow, TypingPresenceState } from '@realflow/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────────

interface InboxRealtimeOptions {
  /** Agent ID to scope inbox subscription */
  agentId: string;
  /** Currently active conversation contact ID (if viewing a thread) */
  activeContactId?: string;
  /** Whether to play a notification sound on new inbound message */
  enableSound?: boolean;
  /** Whether to request browser notification permission and show notifications */
  enableBrowserNotifications?: boolean;
  /** Whether the subscription is active */
  enabled?: boolean;
}

interface InboxRealtimeResult {
  /** Connection status of the inbox subscription */
  status: ReturnType<typeof useRealtimeSubscription>['status'];
  /** Users currently typing in the active conversation */
  typingUsers: TypingPresenceState[];
  /** Broadcast that the current user is typing */
  sendTypingIndicator: (isTyping: boolean) => void;
}

interface NewMessageInfo {
  messageId: string;
  contactId: string;
  channel: string;
  contentPreview: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const TYPING_TIMEOUT_MS = 5000;
const NOTIFICATION_SOUND_PATH = '/sounds/notification.mp3';

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * Real-time inbox hook. Subscribes to conversation_messages for the agent
 * and provides:
 *
 * - Automatic React Query cache invalidation on new messages
 * - Unread count badge auto-updates
 * - Browser notifications and sound for new inbound messages
 * - Typing indicator support via Supabase presence channels
 * - Auto-scroll trigger for active conversations
 */
export function useRealtimeInbox({
  agentId,
  activeContactId,
  enableSound = true,
  enableBrowserNotifications = true,
  enabled = true,
}: InboxRealtimeOptions): InboxRealtimeResult {
  const queryClient = useQueryClient();
  const [typingUsers, setTypingUsers] = useState<TypingPresenceState[]>([]);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Request browser notification permission on mount
  useEffect(() => {
    if (
      enableBrowserNotifications &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission();
    }
  }, [enableBrowserNotifications]);

  // Initialize notification sound
  useEffect(() => {
    if (enableSound && typeof Audio !== 'undefined') {
      audioRef.current = new Audio(NOTIFICATION_SOUND_PATH);
      audioRef.current.volume = 0.5;
    }
    return () => {
      audioRef.current = null;
    };
  }, [enableSound]);

  const showBrowserNotification = useCallback(
    (info: NewMessageInfo) => {
      if (
        enableBrowserNotifications &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.hidden
      ) {
        const notification = new Notification('New message', {
          body: info.contentPreview || 'You have a new message',
          icon: '/icons/realflow-icon-192.png',
          tag: `message-${info.messageId}`,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    },
    [enableBrowserNotifications],
  );

  const playNotificationSound = useCallback(() => {
    if (enableSound && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Audio play can fail if user hasn't interacted with page yet
      });
    }
  }, [enableSound]);

  const handleMessageChange = useCallback(
    (payload: RealtimeChangePayload<ConversationMessageRow>) => {
      switch (payload.eventType) {
        case 'INSERT': {
          const msg = payload.new;

          // Invalidate inbox threads to refresh the list
          queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });

          // If this message is for the active conversation, invalidate the thread
          if (msg.contact_id && msg.contact_id === activeContactId) {
            queryClient.invalidateQueries({
              queryKey: ['conversation', activeContactId],
            });
          }

          // If inbound message, update unread counts and notify
          if (msg.direction === 'inbound') {
            queryClient.invalidateQueries({ queryKey: ['inbox-unread'] });

            // Only notify if message is NOT for the currently viewed conversation
            const isViewingThisConversation = msg.contact_id === activeContactId;
            if (!isViewingThisConversation) {
              const contentPreview =
                typeof msg.content === 'object' && msg.content !== null
                  ? (((msg.content as Record<string, unknown>).text as string) ?? '')
                  : '';

              playNotificationSound();
              showBrowserNotification({
                messageId: msg.id as string,
                contactId: msg.contact_id as string,
                channel: msg.channel as string,
                contentPreview: contentPreview.slice(0, 100),
              });
            }
          }
          break;
        }

        case 'UPDATE': {
          const msg = payload.new;

          // Read status changed — refresh unread counts
          if (payload.old.is_read !== msg.is_read) {
            queryClient.invalidateQueries({ queryKey: ['inbox-unread'] });
            queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
          }

          // If viewing the affected conversation, refresh it
          if (msg.contact_id === activeContactId) {
            queryClient.invalidateQueries({
              queryKey: ['conversation', activeContactId],
            });
          }
          break;
        }

        case 'DELETE': {
          // Soft-delete: refresh threads and conversation
          queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
          const deletedContactId = payload.old.contact_id;
          if (deletedContactId === activeContactId) {
            queryClient.invalidateQueries({
              queryKey: ['conversation', activeContactId],
            });
          }
          break;
        }
      }
    },
    [activeContactId, queryClient, playNotificationSound, showBrowserNotification],
  );

  // Main message subscription
  const { status } = useRealtimeSubscription<ConversationMessageRow>(
    RealtimeChannels.inboxMessages(agentId),
    {
      table: 'conversation_messages',
      filter: `agent_id=eq.${agentId}`,
    },
    handleMessageChange,
    { enabled },
  );

  // ─── Presence / Typing Indicator ──────────────────────────────────────

  useEffect(() => {
    if (!enabled || !activeContactId) {
      return;
    }

    const supabase = createClient();
    const presenceChannelName = PresenceChannels.conversationPresence(activeContactId);
    const channel = supabase.channel(presenceChannelName);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<TypingPresenceState>();
        const users: TypingPresenceState[] = [];
        for (const key of Object.keys(state)) {
          const presences = state[key];
          if (Array.isArray(presences)) {
            for (const presence of presences) {
              if (
                presence.isTyping &&
                presence.userId !== agentId &&
                // Expire typing indicators older than timeout
                Date.now() - new Date(presence.typingStartedAt).getTime() < TYPING_TIMEOUT_MS
              ) {
                users.push(presence);
              }
            }
          }
        }
        setTypingUsers(users);
      })
      .subscribe();

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
      setTypingUsers([]);
    };
  }, [activeContactId, agentId, enabled]);

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.track({
          userId: agentId,
          displayName: '', // Caller should provide this via context if needed
          typingStartedAt: new Date().toISOString(),
          isTyping,
        } satisfies TypingPresenceState);
      }
    },
    [agentId],
  );

  return {
    status,
    typingUsers,
    sendTypingIndicator,
  };
}
