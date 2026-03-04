'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';
import { RealtimeChannels } from '@realflow/shared';
import type { TransactionRow } from '@realflow/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────────

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface RealtimeProgressOptions {
  /** Callback fired when the search stage changes */
  onStageChange?: (info: StageChangeInfo) => void;
}

export interface StageChangeInfo {
  transactionId: string;
  fromStage: string;
  toStage: string;
}

interface RealtimeProgressResult {
  /** Current connection status */
  status: ConnectionStatus;
}

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * Portal-side real-time search progress hook.
 *
 * Subscribes to the client's transaction to detect stage transitions
 * in real time. When the agent moves the deal to a new stage, the
 * client portal immediately reflects the updated progress.
 *
 * Also invalidates timeline and dashboard queries so key dates and
 * milestones update live.
 */
export function useRealtimeProgress(
  options?: RealtimeProgressOptions,
): RealtimeProgressResult {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStageChangeRef = useRef(options?.onStageChange);
  onStageChangeRef.current = options?.onStageChange;

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

      const channelName = RealtimeChannels.searchProgress(contactId);
      const channel = supabase.channel(channelName);

      channel.on<{ [key: string]: string }>(
        'postgres_changes',
        {
          event: 'UPDATE' as const,
          schema: 'public',
          table: 'transactions',
          filter: `contact_id=eq.${contactId}`,
        },
        (payload) => {
          const newRow = payload.new as Partial<TransactionRow>;
          const oldRow = payload.old as Partial<TransactionRow>;

          // Stage change detected
          if (
            oldRow.current_stage &&
            newRow.current_stage &&
            oldRow.current_stage !== newRow.current_stage
          ) {
            onStageChangeRef.current?.({
              transactionId: (newRow.id ?? oldRow.id) as string,
              fromStage: oldRow.current_stage,
              toStage: newRow.current_stage,
            });
          }

          // Invalidate portal queries to reflect progress changes
          queryClient.invalidateQueries({
            queryKey: ['portal-dashboard'],
          });
          queryClient.invalidateQueries({
            queryKey: ['portal-timeline', contactId],
          });
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
