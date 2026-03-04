'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeSubscription, type RealtimeChangePayload } from './useRealtime';
import { RealtimeChannels } from '@realflow/shared';
import type { WorkflowRunRow } from '@realflow/shared';
import type { WorkflowRunStatus } from '@realflow/shared';

// ─── Types ──────────────────────────────────────────────────────────────

interface WorkflowRealtimeOptions {
  /** Subscribe to runs for a specific workflow, or all workflows if omitted */
  workflowId?: string;
  /** Callback when a workflow run fails */
  onRunFailed?: (info: WorkflowRunFailureInfo) => void;
  /** Callback when a workflow run completes */
  onRunCompleted?: (info: WorkflowRunCompletionInfo) => void;
  /** Callback when step progress changes */
  onStepProgress?: (info: WorkflowStepProgressInfo) => void;
  /** Whether the subscription is active */
  enabled?: boolean;
}

export interface WorkflowRunFailureInfo {
  runId: string;
  workflowId: string;
  error: string;
  failedAtStep: number;
}

export interface WorkflowRunCompletionInfo {
  runId: string;
  workflowId: string;
  completedAt: string;
}

export interface WorkflowStepProgressInfo {
  runId: string;
  workflowId: string;
  currentActionIndex: number;
  status: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * Subscribes to real-time workflow execution status changes.
 *
 * Provides:
 * - Live status transitions: running -> completed | failed
 * - Step-by-step progress tracking via currentActionIndex
 * - Error alerts for failed workflow runs
 * - Automatic React Query cache invalidation for workflow run queries
 */
export function useRealtimeWorkflow({
  workflowId,
  onRunFailed,
  onRunCompleted,
  onStepProgress,
  enabled = true,
}: WorkflowRealtimeOptions) {
  const queryClient = useQueryClient();
  const onRunFailedRef = useRef(onRunFailed);
  const onRunCompletedRef = useRef(onRunCompleted);
  const onStepProgressRef = useRef(onStepProgress);

  onRunFailedRef.current = onRunFailed;
  onRunCompletedRef.current = onRunCompleted;
  onStepProgressRef.current = onStepProgress;

  const handleChange = useCallback(
    (payload: RealtimeChangePayload<WorkflowRunRow>) => {
      switch (payload.eventType) {
        case 'INSERT': {
          // New workflow run started
          const run = payload.new;
          if (run.workflow_id) {
            queryClient.invalidateQueries({
              queryKey: ['workflows', run.workflow_id, 'runs'],
            });
          }
          break;
        }

        case 'UPDATE': {
          const run = payload.new;
          const previousRun = payload.old;
          const runWorkflowId = run.workflow_id ?? previousRun.workflow_id;

          // Invalidate the runs query for this workflow
          if (runWorkflowId) {
            queryClient.invalidateQueries({
              queryKey: ['workflows', runWorkflowId, 'runs'],
            });
          }

          const currentStatus = run.status as WorkflowRunStatus | undefined;

          // Step progress changed
          if (
            run.current_action_index !== undefined &&
            previousRun.current_action_index !== undefined &&
            run.current_action_index !== previousRun.current_action_index
          ) {
            onStepProgressRef.current?.({
              runId: (run.id ?? previousRun.id) as string,
              workflowId: runWorkflowId as string,
              currentActionIndex: run.current_action_index,
              status: currentStatus ?? 'running',
            });
          }

          // Status transition: running -> completed
          if (currentStatus === 'completed' && previousRun.status !== 'completed') {
            onRunCompletedRef.current?.({
              runId: (run.id ?? previousRun.id) as string,
              workflowId: runWorkflowId as string,
              completedAt: run.completed_at ?? new Date().toISOString(),
            });
          }

          // Status transition: running -> failed
          if (currentStatus === 'failed' && previousRun.status !== 'failed') {
            onRunFailedRef.current?.({
              runId: (run.id ?? previousRun.id) as string,
              workflowId: runWorkflowId as string,
              error: run.error ?? 'Unknown error',
              failedAtStep: run.current_action_index ?? 0,
            });
          }
          break;
        }

        case 'DELETE': {
          // Uncommon, but handle defensively
          const deletedWorkflowId = payload.old.workflow_id;
          if (deletedWorkflowId) {
            queryClient.invalidateQueries({
              queryKey: ['workflows', deletedWorkflowId, 'runs'],
            });
          }
          break;
        }
      }
    },
    [queryClient],
  );

  const channelName = workflowId
    ? RealtimeChannels.workflowRuns(workflowId)
    : RealtimeChannels.workflowRunsAll();

  const filter = workflowId ? `workflow_id=eq.${workflowId}` : undefined;

  return useRealtimeSubscription<WorkflowRunRow>(
    channelName,
    {
      table: 'workflow_runs',
      filter,
    },
    handleChange,
    { enabled },
  );
}
