'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RealtimeEventType } from '@realflow/shared';

// ─── Connection Status ──────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// ─── Subscription Filter ────────────────────────────────────────────────

export interface SubscriptionFilter {
  /** The Postgres schema to listen to (defaults to 'public') */
  schema?: string;
  /** The table name to subscribe to */
  table: string;
  /** Postgres filter expression (e.g. 'pipeline_type=eq.buying') */
  filter?: string;
  /** Which event types to listen for. Defaults to all ('*') */
  event?: RealtimeEventType | '*';
}

// ─── Typed Change Payload ───────────────────────────────────────────────

export interface RealtimeChangePayload<T> {
  eventType: RealtimeEventType;
  new: Partial<T>;
  old: Partial<T>;
  table: string;
  schema: string;
  commitTimestamp: string;
}

// ─── Backoff Configuration ──────────────────────────────────────────────

interface BackoffConfig {
  /** Initial delay in ms before first reconnection attempt */
  initialDelayMs: number;
  /** Maximum delay in ms between reconnection attempts */
  maxDelayMs: number;
  /** Multiplier applied to delay after each attempt */
  multiplier: number;
}

const DEFAULT_BACKOFF: BackoffConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
};

// ─── Core Subscription Hook ─────────────────────────────────────────────

/**
 * Generic Supabase Realtime subscription hook.
 *
 * Subscribes to postgres_changes on mount and cleans up on unmount.
 * Tracks connection status and reconnects with exponential backoff
 * when the connection drops.
 *
 * @param channelName - Unique name for the Realtime channel
 * @param subscriptionFilter - Table, schema, filter, and event type config
 * @param callback - Handler invoked with typed payloads on each change event
 * @param options - Optional backoff configuration and enabled flag
 */
export function useRealtimeSubscription<T>(
  channelName: string,
  subscriptionFilter: SubscriptionFilter,
  callback: (payload: RealtimeChangePayload<T>) => void,
  options?: {
    enabled?: boolean;
    backoff?: Partial<BackoffConfig>;
  },
) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const enabled = options?.enabled ?? true;

  // Keep callback ref current without re-subscribing
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const backoff: BackoffConfig = {
    ...DEFAULT_BACKOFF,
    ...options?.backoff,
  };

  const getRetryDelay = useCallback(() => {
    const delay = Math.min(
      backoff.initialDelayMs * Math.pow(backoff.multiplier, retryCountRef.current),
      backoff.maxDelayMs,
    );
    // Add jitter: +/- 25%
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }, [backoff.initialDelayMs, backoff.multiplier, backoff.maxDelayMs]);

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      return;
    }

    const supabase = createClient();

    const subscribe = () => {
      // Clean up previous channel if it exists
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');

      const channel = supabase.channel(channelName);

      const pgFilter = {
        event: (subscriptionFilter.event ?? '*') as '*',
        schema: subscriptionFilter.schema ?? 'public',
        table: subscriptionFilter.table,
        filter: subscriptionFilter.filter,
      };

      channel.on<{ [key: string]: string }>(
        'postgres_changes',
        pgFilter,
        (payload) => {
          const typed: RealtimeChangePayload<T> = {
            eventType: payload.eventType as RealtimeEventType,
            new: (payload.new ?? {}) as Partial<T>,
            old: (payload.old ?? {}) as Partial<T>,
            table: subscriptionFilter.table,
            schema: subscriptionFilter.schema ?? 'public',
            commitTimestamp: (payload as unknown as { commit_timestamp?: string }).commit_timestamp ?? new Date().toISOString(),
          };
          callbackRef.current(typed);
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
          // Schedule reconnection with exponential backoff
          const delay = getRetryDelay();
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            subscribe();
          }, delay);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, subscriptionFilter.table, subscriptionFilter.filter, subscriptionFilter.event, subscriptionFilter.schema, enabled]);

  return { status };
}

// ─── Connection Status Hook ─────────────────────────────────────────────

/**
 * Provides the current Supabase Realtime connection status.
 * Useful for displaying a connection indicator in the UI.
 */
export function useRealtimeStatus(channelName: string, filter: SubscriptionFilter) {
  const noop = useCallback(() => {}, []);
  const { status } = useRealtimeSubscription<Record<string, never>>(
    channelName,
    filter,
    noop,
  );
  return status;
}
