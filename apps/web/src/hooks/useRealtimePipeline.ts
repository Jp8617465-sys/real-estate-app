'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeSubscription, type RealtimeChangePayload } from './useRealtime';
import { RealtimeChannels } from '@realflow/shared';
import type { TransactionRow } from '@realflow/shared';
import type { PipelineType } from '@realflow/shared';

// ─── Types ──────────────────────────────────────────────────────────────

interface PipelineRealtimeOptions {
  /** The pipeline type to filter subscriptions */
  pipelineType: PipelineType;
  /** Current user ID — used to detect changes made by other agents */
  currentUserId: string;
  /** Callback when another agent moves a deal */
  onOtherAgentChange?: (info: OtherAgentChangeInfo) => void;
  /** Whether the subscription is enabled (defaults to true) */
  enabled?: boolean;
}

export interface OtherAgentChangeInfo {
  transactionId: string;
  fromStage: string;
  toStage: string;
  agentId: string;
}

// ─── Transaction row with joined relations (matches query shape) ────────

interface TransactionWithRelations extends Record<string, unknown> {
  id: string;
  contact_id: string;
  property_id: string | null;
  pipeline_type: string;
  current_stage: string;
  assigned_agent_id: string;
  is_deleted: boolean;
  updated_at: string;
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    buyer_profile: Record<string, unknown> | null;
    lead_score: number | null;
  };
  property?: {
    id: string;
    address_street_number: string;
    address_street_name: string;
    address_suburb: string;
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * Subscribes to real-time pipeline/transaction changes.
 *
 * - INSERT: new deal appears in pipeline instantly
 * - UPDATE: stage change reflected in UI without refetch
 * - DELETE (soft): deal removed from view
 *
 * Optimistic update reconciliation: when a local optimistic update
 * conflicts with a server-side change, the server state wins.
 * If a different agent moves a deal, the `onOtherAgentChange` callback
 * fires so the UI can show a toast notification.
 */
export function useRealtimePipeline({
  pipelineType,
  currentUserId,
  onOtherAgentChange,
  enabled = true,
}: PipelineRealtimeOptions) {
  const queryClient = useQueryClient();
  const onOtherAgentChangeRef = useRef(onOtherAgentChange);
  onOtherAgentChangeRef.current = onOtherAgentChange;

  const handleChange = useCallback(
    (payload: RealtimeChangePayload<TransactionRow>) => {
      const queryKey = ['transactions', pipelineType];

      switch (payload.eventType) {
        case 'INSERT': {
          // A new transaction was created — invalidate to fetch full row with joins
          queryClient.invalidateQueries({ queryKey });
          break;
        }

        case 'UPDATE': {
          const updatedRow = payload.new;
          const previousRow = payload.old;

          // If soft-deleted, remove from cache
          if (updatedRow.is_deleted) {
            queryClient.setQueryData<TransactionWithRelations[]>(queryKey, (old) =>
              old?.filter((t) => t.id !== updatedRow.id) ?? [],
            );
            return;
          }

          // Stage change detection
          if (
            previousRow.current_stage &&
            updatedRow.current_stage &&
            previousRow.current_stage !== updatedRow.current_stage
          ) {
            // Check if another agent made this change
            if (
              updatedRow.assigned_agent_id &&
              updatedRow.assigned_agent_id !== currentUserId
            ) {
              onOtherAgentChangeRef.current?.({
                transactionId: updatedRow.id as string,
                fromStage: previousRow.current_stage as string,
                toStage: updatedRow.current_stage as string,
                agentId: updatedRow.assigned_agent_id as string,
              });
            }
          }

          // Server wins: update the cached transaction with server state
          queryClient.setQueryData<TransactionWithRelations[]>(queryKey, (old) => {
            if (!old) return old;
            return old.map((transaction) => {
              if (transaction.id === updatedRow.id) {
                // Merge server fields onto existing cached row (preserves joined relations)
                return {
                  ...transaction,
                  ...updatedRow,
                };
              }
              return transaction;
            });
          });
          break;
        }

        case 'DELETE': {
          // Hard delete (should not happen per project conventions, but handle defensively)
          const deletedId = payload.old.id;
          queryClient.setQueryData<TransactionWithRelations[]>(queryKey, (old) =>
            old?.filter((t) => t.id !== deletedId) ?? [],
          );
          break;
        }
      }
    },
    [pipelineType, currentUserId, queryClient],
  );

  const channelName = RealtimeChannels.pipeline(pipelineType);

  return useRealtimeSubscription<TransactionRow>(
    channelName,
    {
      table: 'transactions',
      filter: `pipeline_type=eq.${pipelineType}`,
    },
    handleChange,
    { enabled },
  );
}
