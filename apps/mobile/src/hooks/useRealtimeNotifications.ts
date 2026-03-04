import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { RealtimeChannels } from '@realflow/shared';
import type { NotificationRow } from '@realflow/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────────

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface RealtimeNotificationsOptions {
  /** The authenticated user's ID */
  userId: string;
  /** Callback when a new notification arrives (can trigger local push) */
  onNewNotification?: (info: NewNotificationInfo) => void;
  /** Whether the subscription is active */
  enabled?: boolean;
}

export interface NewNotificationInfo {
  notificationId: string;
  title: string;
  body: string;
  priority: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
}

interface RealtimeNotificationsResult {
  /** Current connection status */
  status: ConnectionStatus;
}

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * Mobile real-time notifications hook.
 *
 * Subscribes to the notifications table for the current user.
 * When a new notification is inserted (e.g., new lead, key date reminder),
 * the hook:
 * 1. Invalidates notification queries for instant UI update
 * 2. Calls onNewNotification so the app can trigger a local push notification
 *
 * This replaces the 30-second polling in useNotifications with instant
 * push-based delivery.
 */
export function useRealtimeNotifications({
  userId,
  onNewNotification,
  enabled = true,
}: RealtimeNotificationsOptions): RealtimeNotificationsResult {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNewNotificationRef = useRef(onNewNotification);
  onNewNotificationRef.current = onNewNotification;

  const getRetryDelay = useCallback(() => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current), maxDelay);
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }, []);

  useEffect(() => {
    if (!enabled || !userId) {
      setStatus('disconnected');
      return;
    }

    const subscribe = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');

      const channelName = RealtimeChannels.notifications(userId);
      const channel = supabase.channel(channelName);

      channel.on<{ [key: string]: string }>(
        'postgres_changes',
        {
          event: '*' as const,
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const eventType = payload.eventType;

          if (eventType === 'INSERT') {
            const row = payload.new as Partial<NotificationRow>;

            onNewNotificationRef.current?.({
              notificationId: row.id as string,
              title: row.title as string,
              body: row.body as string,
              priority: row.priority as string,
              category: row.category as string,
              entityType: row.entity_type ?? null,
              entityId: row.entity_id ?? null,
            });
          }

          // Invalidate notification queries for any change type
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
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
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      retryCountRef.current = 0;
    };
  }, [enabled, userId, queryClient, getRetryDelay]);

  return { status };
}
