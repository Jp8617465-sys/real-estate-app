'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';
import { RealtimeChannels } from '@realflow/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────────

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface RealtimeMessagesResult {
  /** Current connection status */
  status: ConnectionStatus;
}

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * Portal-side real-time messages hook.
 *
 * Subscribes to conversation_messages for the portal client's contact_id
 * so the client sees new messages from their agent instantly without polling.
 *
 * Replaces the 30-second polling interval in usePortalMessages with
 * instant push-based updates.
 */
export function useRealtimeMessages(): RealtimeMessagesResult {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contactId = portalClient?.contact_id;
  const enabled = !!user?.id && !!contactId;

  const getRetryDelay = useCallback(() => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current), maxDelay);
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }, []);

  useEffect(() => {
    if (!enabled || !contactId) {
      setStatus('disconnected');
      return;
    }

    const supabase = createClient();

    const subscribe = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');

      const channelName = RealtimeChannels.conversationMessages(contactId);
      const channel = supabase.channel(channelName);

      channel.on<{ [key: string]: string }>(
        'postgres_changes',
        {
          event: '*' as const,
          schema: 'public',
          table: 'conversation_messages',
          filter: `contact_id=eq.${contactId}`,
        },
        (payload) => {
          const eventType = payload.eventType;

          if (eventType === 'INSERT') {
            // New message — invalidate messages query to show it instantly
            queryClient.invalidateQueries({
              queryKey: ['portal-messages', contactId],
            });
            queryClient.invalidateQueries({
              queryKey: ['portal-dashboard'],
            });
          }

          if (eventType === 'UPDATE') {
            // Message status changed (e.g., read receipt)
            queryClient.invalidateQueries({
              queryKey: ['portal-messages', contactId],
            });
          }
        },
      );

      channel.subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('connected');
          retryCountRef.current = 0;
        } else if (
          subscriptionStatus === 'CHANNEL_ERROR' ||
          subscriptionStatus === 'TIMED_OUT'
        ) {
          setStatus('disconnected');
          const delay = getRetryDelay();
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(subscribe, delay);
        } else if (subscriptionStatus === 'CLOSED') {
          setStatus('disconnected');
        }
      });

      channelRef.current = channel;
    };

    subscribe();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      retryCountRef.current = 0;
    };
  }, [enabled, contactId, queryClient, getRetryDelay]);

  return { status };
}
