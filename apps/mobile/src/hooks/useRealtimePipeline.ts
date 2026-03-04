import { useCallback, useRef, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { RealtimeChannels } from '@realflow/shared';
import type { TransactionRow } from '@realflow/shared';
import type { PipelineType } from '@realflow/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────────

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface MobilePipelineRealtimeOptions {
  /** The pipeline type to filter subscriptions */
  pipelineType: PipelineType;
  /** Current user ID for detecting other agent changes */
  currentUserId: string;
  /** Callback when another agent moves a deal */
  onOtherAgentChange?: (info: OtherAgentMobileChangeInfo) => void;
  /** Whether the subscription is active */
  enabled?: boolean;
}

export interface OtherAgentMobileChangeInfo {
  transactionId: string;
  fromStage: string;
  toStage: string;
  agentId: string;
}

interface MobilePipelineRealtimeResult {
  /** Current connection status */
  status: ConnectionStatus;
}

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * Mobile real-time pipeline hook.
 *
 * Subscribes to transaction changes for a specific pipeline type.
 * Mirrors the web useRealtimePipeline hook but uses the mobile
 * supabase singleton client and mobile-specific query keys.
 *
 * - INSERT: invalidates pipeline query to fetch new deal with joins
 * - UPDATE: merges server state into cache (server wins on conflicts)
 * - DELETE: removes deal from cache
 */
export function useRealtimePipeline({
  pipelineType,
  currentUserId,
  onOtherAgentChange,
  enabled = true,
}: MobilePipelineRealtimeOptions): MobilePipelineRealtimeResult {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const onOtherAgentChangeRef = useRef(onOtherAgentChange);
  onOtherAgentChangeRef.current = onOtherAgentChange;

  const getRetryDelay = useCallback(() => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current), maxDelay);
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      return;
    }

    const subscribe = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');

      const channelName = RealtimeChannels.pipeline(pipelineType);
      const channel = supabase.channel(channelName);

      channel.on<{ [key: string]: string }>(
        'postgres_changes',
        {
          event: '*' as const,
          schema: 'public',
          table: 'transactions',
          filter: `pipeline_type=eq.${pipelineType}`,
        },
        (payload) => {
          const eventType = payload.eventType;
          const queryKey = ['pipeline', pipelineType];

          if (eventType === 'INSERT') {
            // New transaction — invalidate to fetch with joined relations
            queryClient.invalidateQueries({ queryKey });
            return;
          }

          if (eventType === 'UPDATE') {
            const newRow = payload.new as Partial<TransactionRow>;
            const oldRow = payload.old as Partial<TransactionRow>;

            // Soft-delete handling
            if (newRow.is_deleted) {
              queryClient.setQueryData<Record<string, unknown>[]>(queryKey, (old) =>
                old?.filter((t) => t.id !== newRow.id) ?? [],
              );
              return;
            }

            // Detect stage change by another agent
            if (
              oldRow.current_stage &&
              newRow.current_stage &&
              oldRow.current_stage !== newRow.current_stage &&
              newRow.assigned_agent_id &&
              newRow.assigned_agent_id !== currentUserId
            ) {
              onOtherAgentChangeRef.current?.({
                transactionId: newRow.id as string,
                fromStage: oldRow.current_stage,
                toStage: newRow.current_stage,
                agentId: newRow.assigned_agent_id,
              });
            }

            // Server wins: merge server fields into cached row
            queryClient.setQueryData<Record<string, unknown>[]>(queryKey, (old) => {
              if (!old) return old;
              return old.map((transaction) => {
                if (transaction.id === newRow.id) {
                  return { ...transaction, ...newRow };
                }
                return transaction;
              });
            });
            return;
          }

          if (eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<TransactionRow>).id;
            queryClient.setQueryData<Record<string, unknown>[]>(queryKey, (old) =>
              old?.filter((t) => t.id !== deletedId) ?? [],
            );
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
          retryTimerRef.current = globalThis.setTimeout(subscribe, delay);
        } else if (subscriptionStatus === 'CLOSED') {
          setStatus('disconnected');
        }
      });

      channelRef.current = channel;
    };

    subscribe();

    return () => {
      if (retryTimerRef.current) {
        globalThis.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      retryCountRef.current = 0;
    };
  }, [enabled, pipelineType, currentUserId, queryClient, getRetryDelay]);

  return { status };
}
