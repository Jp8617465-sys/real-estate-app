import type {
  Workflow,
  WorkflowTrigger,
  WorkflowAction,
  WorkflowCondition,
  ExecutionStepLog,
  ActionErrorPolicy,
  RetryConfig,
} from '@realflow/shared';
import { recoverFromError, getErrorPolicy, notifyWorkflowError } from './workflow-error-recovery';
import type { RecoveryResult } from './workflow-error-recovery';

// ─── Types ────────────────────────────────────────────────────────

export interface WorkflowEvent {
  type: 'stage_change' | 'new_lead' | 'field_change' | 'form_submitted';
  contactId?: string;
  transactionId?: string;
  data: Record<string, unknown>;
}

export interface SupabaseClient {
  from: (table: string) => {
    insert: (data: Record<string, unknown>) => {
      select: () => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    update: (data: Record<string, unknown>) => {
      eq: (field: string, value: unknown) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
    };
  };
}

export interface WorkflowContext {
  contactId?: string;
  transactionId?: string;
  entityData: Record<string, unknown>;
  supabase: SupabaseClient;
  /** Variable context carried across steps during execution. */
  variables?: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  actionType: string;
  result?: Record<string, unknown>;
  error?: string;
  warning?: string;
  paused?: boolean;
  resumeAt?: string;
  retryAttempts?: number;
  recoveryStrategy?: string;
}

export interface WorkflowRunResult {
  workflowId: string;
  runId: string;
  status: 'completed' | 'failed' | 'paused';
  actionsExecuted: number;
  results: ActionResult[];
  executionLog: ExecutionStepLog[];
  error?: string;
}

/** Options for the enhanced runWorkflow function. */
export interface RunWorkflowOptions {
  /** Enable retry with error recovery for failed actions. */
  enableRetry?: boolean;
  /** Default retry configuration applied to all actions unless overridden. */
  defaultRetryConfig?: RetryConfig;
  /** Per-action error policies keyed by action type. */
  actionErrorPolicies?: Record<string, Partial<ActionErrorPolicy>>;
  /** Callback fired when a retry attempt begins. */
  onRetryAttempt?: (stepIndex: number, attempt: number, delay: number) => void;
  /** Callback fired when an execution step log entry is created. */
  onStepLog?: (entry: ExecutionStepLog) => void;
}

// ─── Duration Parsing ─────────────────────────────────────────────

/**
 * Parse duration strings like "7d", "24h", "30m" to milliseconds.
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Expected format like "7d", "24h", "30m".`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

// ─── Dot-notation Field Access ────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ─── Trigger Evaluation ───────────────────────────────────────────

export function evaluateTrigger(trigger: WorkflowTrigger, event: WorkflowEvent): boolean {
  switch (trigger.type) {
    case 'stage_change': {
      if (event.type !== 'stage_change') return false;
      if (event.data.to !== trigger.to) return false;
      if (trigger.from !== undefined && event.data.from !== trigger.from) return false;
      return true;
    }
    case 'new_lead': {
      if (event.type !== 'new_lead') return false;
      if (trigger.source !== undefined && event.data.source !== trigger.source) return false;
      return true;
    }
    case 'field_change': {
      if (event.type !== 'field_change') return false;
      if (event.data.field !== trigger.field) return false;
      return true;
    }
    case 'form_submitted': {
      if (event.type !== 'form_submitted') return false;
      if (event.data.formId !== trigger.formId) return false;
      return true;
    }
    // Scheduler-based triggers - not evaluated by event dispatch
    case 'time_based':
    case 'no_activity':
    case 'date_approaching':
      return false;
    default:
      return false;
  }
}

// ─── Condition Evaluation ─────────────────────────────────────────

export function evaluateCondition(condition: WorkflowCondition, context: WorkflowContext): boolean {
  const value = getNestedValue(context.entityData, condition.field);

  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'contains':
      return String(value ?? '').includes(String(condition.value ?? ''));
    case 'greater_than':
      return Number(value) > Number(condition.value);
    case 'less_than':
      return Number(value) < Number(condition.value);
    case 'is_empty':
      return value === null || value === undefined || value === '';
    case 'is_not_empty':
      return value !== null && value !== undefined && value !== '';
    default:
      return false;
  }
}

export function evaluateConditions(conditions: WorkflowCondition[], context: WorkflowContext): boolean {
  // No conditions means always pass (AND of empty set is true)
  if (conditions.length === 0) return true;
  return conditions.every((condition) => evaluateCondition(condition, context));
}

// ─── Action Execution ─────────────────────────────────────────────

export async function executeAction(action: WorkflowAction, context: WorkflowContext): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'create_task': {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + action.dueDaysFromNow);

        const { data, error } = await context.supabase
          .from('tasks')
          .insert({
            title: action.taskTitle,
            type: action.taskType,
            priority: 'medium',
            status: 'pending',
            contact_id: context.contactId,
            transaction_id: context.transactionId,
            due_date: dueDate.toISOString(),
            is_automated: true,
          })
          .select()
          .single();

        if (error) return { success: false, actionType: 'create_task', error: error.message };
        return { success: true, actionType: 'create_task', result: data ?? undefined };
      }

      case 'assign_contact': {
        if (!context.contactId) {
          return { success: false, actionType: 'assign_contact', error: 'No contact ID in context' };
        }
        const { error } = await context.supabase
          .from('contacts')
          .update({ assigned_agent_id: action.agentId })
          .eq('id', context.contactId);

        if (error) return { success: false, actionType: 'assign_contact', error: error.message };
        return { success: true, actionType: 'assign_contact' };
      }

      case 'update_field': {
        const table = context.contactId ? 'contacts' : 'transactions';
        const entityId = context.contactId ?? context.transactionId;

        if (!entityId) {
          return { success: false, actionType: 'update_field', error: 'No entity ID in context' };
        }

        const { error } = await context.supabase
          .from(table)
          .update({ [action.field]: action.value })
          .eq('id', entityId);

        if (error) return { success: false, actionType: 'update_field', error: error.message };
        return { success: true, actionType: 'update_field' };
      }

      case 'add_tag': {
        if (!context.contactId) {
          return { success: false, actionType: 'add_tag', error: 'No contact ID in context' };
        }
        // Get current tags then append
        const currentTags = (context.entityData.tags as string[]) ?? [];
        const newTags = [...new Set([...currentTags, action.tag])];

        const { error } = await context.supabase
          .from('contacts')
          .update({ tags: newTags })
          .eq('id', context.contactId);

        if (error) return { success: false, actionType: 'add_tag', error: error.message };
        return { success: true, actionType: 'add_tag', result: { tags: newTags } };
      }

      case 'notify_agent': {
        const { data, error } = await context.supabase
          .from('conversation_messages')
          .insert({
            type: 'internal_note',
            content: action.message,
            contact_id: context.contactId,
          })
          .select()
          .single();

        if (error) return { success: false, actionType: 'notify_agent', error: error.message };
        return { success: true, actionType: 'notify_agent', result: data ?? undefined };
      }

      case 'send_email': {
        const { data, error } = await context.supabase
          .from('outbox')
          .insert({
            channel: 'email',
            template_id: action.templateId,
            contact_id: context.contactId,
            status: 'queued',
          })
          .select()
          .single();

        if (error) return { success: false, actionType: 'send_email', error: error.message };
        return { success: true, actionType: 'send_email', result: data ?? undefined };
      }

      case 'send_sms': {
        const { data, error } = await context.supabase
          .from('outbox')
          .insert({
            channel: 'sms',
            template_id: action.templateId,
            contact_id: context.contactId,
            status: 'queued',
          })
          .select()
          .single();

        if (error) return { success: false, actionType: 'send_sms', error: error.message };
        return { success: true, actionType: 'send_sms', result: data ?? undefined };
      }

      case 'post_social': {
        const { data, error } = await context.supabase
          .from('social_posts')
          .insert({
            platforms: action.platforms,
            template_id: action.templateId,
            contact_id: context.contactId,
            status: 'scheduled',
          })
          .select()
          .single();

        if (error) return { success: false, actionType: 'post_social', error: error.message };
        return { success: true, actionType: 'post_social', result: data ?? undefined };
      }

      case 'webhook': {
        try {
          const response = await fetch(action.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...action.payload,
              contactId: context.contactId,
              transactionId: context.transactionId,
            }),
          });

          if (!response.ok) {
            return {
              success: false,
              actionType: 'webhook',
              error: `Webhook returned ${response.status}: ${response.statusText}`,
            };
          }

          return { success: true, actionType: 'webhook', result: { status: response.status } };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown fetch error';
          return { success: false, actionType: 'webhook', error: message };
        }
      }

      case 'wait': {
        const ms = parseDuration(action.duration);
        const resumeAt = new Date(Date.now() + ms).toISOString();
        return { success: true, actionType: 'wait', paused: true, resumeAt };
      }

      case 'create_follow_up': {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + action.daysFromNow);

        const { data, error } = await context.supabase
          .from('tasks')
          .insert({
            title: `Follow up with contact`,
            type: action.taskType,
            priority: 'medium',
            status: 'pending',
            contact_id: context.contactId,
            transaction_id: context.transactionId,
            due_date: dueDate.toISOString(),
            is_automated: true,
          })
          .select()
          .single();

        if (error) return { success: false, actionType: 'create_follow_up', error: error.message };
        return { success: true, actionType: 'create_follow_up', result: data ?? undefined };
      }

      default:
        return { success: false, actionType: 'unknown', error: `Unknown action type` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, actionType: action.type, error: message };
  }
}

// ─── Execution Step Logging ───────────────────────────────────────

function createStepLog(
  stepIndex: number,
  actionType: string,
  status: ExecutionStepLog['status'],
  startedAt: string,
  extras?: Partial<ExecutionStepLog>,
): ExecutionStepLog {
  const now = new Date().toISOString();
  const startMs = new Date(startedAt).getTime();
  const durationMs = Date.now() - startMs;

  return {
    stepIndex,
    actionType,
    status,
    startedAt,
    completedAt: status === 'started' ? undefined : now,
    durationMs: status === 'started' ? undefined : durationMs,
    retryAttempt: 0,
    ...extras,
  };
}

// ─── Workflow Runner ──────────────────────────────────────────────

export async function runWorkflow(
  workflow: Workflow,
  event: WorkflowEvent,
  context: WorkflowContext,
  startIndex = 0,
  options?: RunWorkflowOptions,
): Promise<WorkflowRunResult> {
  const runId = crypto.randomUUID();
  const results: ActionResult[] = [];
  const executionLog: ExecutionStepLog[] = [];

  // Step 1: Check trigger matches
  if (startIndex === 0 && !evaluateTrigger(workflow.trigger, event)) {
    return {
      workflowId: workflow.id,
      runId,
      status: 'completed',
      actionsExecuted: 0,
      results: [],
      executionLog: [],
      error: 'Trigger did not match event',
    };
  }

  // Step 2: Evaluate conditions (only on initial run, not on resume)
  if (startIndex === 0 && !evaluateConditions(workflow.conditions, context)) {
    return {
      workflowId: workflow.id,
      runId,
      status: 'completed',
      actionsExecuted: 0,
      results: [],
      executionLog: [],
      error: 'Conditions not met',
    };
  }

  // Step 3: Execute actions sequentially
  for (let i = startIndex; i < workflow.actions.length; i++) {
    const action = workflow.actions[i]!;
    const stepStartedAt = new Date().toISOString();

    // Log step started
    const startLog = createStepLog(i, action.type, 'started', stepStartedAt, {
      variableSnapshot: context.variables ? { ...context.variables } : undefined,
    });
    executionLog.push(startLog);
    options?.onStepLog?.(startLog);

    const result = await executeAction(action, context);

    // If action is 'wait', pause execution
    if (result.paused) {
      const pauseLog = createStepLog(i, action.type, 'completed', stepStartedAt, {
        result: { paused: true, resumeAt: result.resumeAt },
      });
      // Replace the started entry with completed
      executionLog[executionLog.length - 1] = pauseLog;
      options?.onStepLog?.(pauseLog);

      results.push(result);

      // Record the workflow_run in DB with paused state
      try {
        await context.supabase
          .from('workflow_runs')
          .insert({
            id: runId,
            workflow_id: workflow.id,
            contact_id: context.contactId,
            transaction_id: context.transactionId,
            status: 'paused',
            current_action_index: i + 1,
            started_at: new Date().toISOString(),
            paused_at: new Date().toISOString(),
            resume_at: result.resumeAt,
            execution_log: executionLog,
            variable_context: context.variables ?? {},
          })
          .select()
          .single();
      } catch {
        // If recording fails, we still return the paused state
      }

      return {
        workflowId: workflow.id,
        runId,
        status: 'paused',
        actionsExecuted: results.length,
        results,
        executionLog,
      };
    }

    // If action failed, attempt recovery if enabled
    if (!result.success) {
      if (options?.enableRetry) {
        const policy = getErrorPolicy(
          action.type,
          options.actionErrorPolicies?.[action.type],
        );

        const recoveryResult: RecoveryResult = await recoverFromError(
          action,
          result,
          context,
          policy,
          {
            stepIndex: i,
            runId,
            workflowId: workflow.id,
            onRetryAttempt: (attempt, delay) => {
              options.onRetryAttempt?.(i, attempt, delay);
              const retryLog = createStepLog(i, action.type, 'retrying', stepStartedAt, {
                retryAttempt: attempt + 1,
              });
              executionLog.push(retryLog);
              options.onStepLog?.(retryLog);
            },
          },
        );

        if (recoveryResult.success) {
          // Recovery succeeded — log and continue
          const recoveredLog = createStepLog(i, action.type, recoveryResult.warning ? 'warning' : 'completed', stepStartedAt, {
            retryAttempt: recoveryResult.retryAttempts,
            warning: recoveryResult.warning,
            result: recoveryResult.actionResult.result,
          });
          executionLog[executionLog.length - 1] = recoveredLog;
          options?.onStepLog?.(recoveredLog);

          results.push({
            ...recoveryResult.actionResult,
            retryAttempts: recoveryResult.retryAttempts,
            recoveryStrategy: recoveryResult.strategyApplied,
            warning: recoveryResult.warning,
          });
          continue;
        }

        // Recovery failed — log failure and stop
        const failLog = createStepLog(i, action.type, 'failed', stepStartedAt, {
          retryAttempt: recoveryResult.retryAttempts,
          error: recoveryResult.actionResult.error,
        });
        executionLog[executionLog.length - 1] = failLog;
        options?.onStepLog?.(failLog);

        results.push({
          ...recoveryResult.actionResult,
          retryAttempts: recoveryResult.retryAttempts,
          recoveryStrategy: recoveryResult.strategyApplied,
        });

        // Notify agent of critical failure
        await notifyWorkflowError(context, workflow.id, runId, result.error ?? 'Unknown error');

        // Record failure
        try {
          await context.supabase
            .from('workflow_runs')
            .insert({
              id: runId,
              workflow_id: workflow.id,
              contact_id: context.contactId,
              transaction_id: context.transactionId,
              status: 'failed',
              current_action_index: i,
              error: result.error,
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              execution_log: executionLog,
              variable_context: context.variables ?? {},
            })
            .select()
            .single();
        } catch {
          // Ignore recording failures
        }

        return {
          workflowId: workflow.id,
          runId,
          status: 'failed',
          actionsExecuted: results.length,
          results,
          executionLog,
          error: result.error,
        };
      }

      // No retry enabled — original behaviour: fail immediately
      const failLog = createStepLog(i, action.type, 'failed', stepStartedAt, {
        error: result.error,
      });
      executionLog[executionLog.length - 1] = failLog;
      options?.onStepLog?.(failLog);

      results.push(result);

      // Record failure
      try {
        await context.supabase
          .from('workflow_runs')
          .insert({
            id: runId,
            workflow_id: workflow.id,
            contact_id: context.contactId,
            transaction_id: context.transactionId,
            status: 'failed',
            current_action_index: i,
            error: result.error,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            execution_log: executionLog,
          })
          .select()
          .single();
      } catch {
        // Ignore recording failures
      }

      return {
        workflowId: workflow.id,
        runId,
        status: 'failed',
        actionsExecuted: results.length,
        results,
        executionLog,
        error: result.error,
      };
    }

    // Action succeeded
    const successLog = createStepLog(i, action.type, 'completed', stepStartedAt, {
      result: result.result,
      variableSnapshot: context.variables ? { ...context.variables } : undefined,
    });
    executionLog[executionLog.length - 1] = successLog;
    options?.onStepLog?.(successLog);

    results.push(result);
  }

  // All actions completed
  try {
    await context.supabase
      .from('workflow_runs')
      .insert({
        id: runId,
        workflow_id: workflow.id,
        contact_id: context.contactId,
        transaction_id: context.transactionId,
        status: 'completed',
        current_action_index: workflow.actions.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        execution_log: executionLog,
        variable_context: context.variables ?? {},
      })
      .select()
      .single();
  } catch {
    // Ignore recording failures
  }

  return {
    workflowId: workflow.id,
    runId,
    status: 'completed',
    actionsExecuted: results.length,
    results,
    executionLog,
  };
}

// ─── Pause / Resume / Schedule Resume ────────────────────────────

/**
 * Pause a running workflow execution. Updates the DB record to 'paused' status.
 */
export async function pauseExecution(
  executionId: string,
  context: WorkflowContext,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await context.supabase
      .from('workflow_runs')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
      })
      .eq('id', executionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Resume a paused workflow execution. Updates the DB record to 'running' status
 * so the scheduler can pick it up.
 */
export async function resumeExecution(
  executionId: string,
  context: WorkflowContext,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await context.supabase
      .from('workflow_runs')
      .update({
        status: 'running',
        paused_at: null,
        resume_at: null,
      })
      .eq('id', executionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Schedule a paused execution to resume at a specific date/time.
 */
export async function scheduleResume(
  executionId: string,
  resumeAt: Date,
  context: WorkflowContext,
): Promise<{ success: boolean; error?: string }> {
  if (resumeAt.getTime() <= Date.now()) {
    return { success: false, error: 'resumeAt must be in the future' };
  }

  try {
    const { error } = await context.supabase
      .from('workflow_runs')
      .update({
        status: 'paused',
        resume_at: resumeAt.toISOString(),
      })
      .eq('id', executionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}
