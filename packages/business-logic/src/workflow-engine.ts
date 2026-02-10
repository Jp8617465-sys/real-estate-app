import type {
  Workflow,
  WorkflowTrigger,
  WorkflowAction,
  WorkflowCondition,
} from '@realflow/shared';

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
}

export interface ActionResult {
  success: boolean;
  actionType: string;
  result?: Record<string, unknown>;
  error?: string;
  paused?: boolean;
  resumeAt?: string;
}

export interface WorkflowRunResult {
  workflowId: string;
  runId: string;
  status: 'completed' | 'failed' | 'paused';
  actionsExecuted: number;
  results: ActionResult[];
  error?: string;
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

// ─── Workflow Runner ──────────────────────────────────────────────

export async function runWorkflow(
  workflow: Workflow,
  event: WorkflowEvent,
  context: WorkflowContext,
  startIndex = 0,
): Promise<WorkflowRunResult> {
  const runId = crypto.randomUUID();
  const results: ActionResult[] = [];

  // Step 1: Check trigger matches
  if (startIndex === 0 && !evaluateTrigger(workflow.trigger, event)) {
    return {
      workflowId: workflow.id,
      runId,
      status: 'completed',
      actionsExecuted: 0,
      results: [],
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
      error: 'Conditions not met',
    };
  }

  // Step 3: Execute actions sequentially
  for (let i = startIndex; i < workflow.actions.length; i++) {
    const action = workflow.actions[i]!;
    const result = await executeAction(action, context);
    results.push(result);

    // If action is 'wait', pause execution
    if (result.paused) {
      // Record the workflow_run in DB with paused state
      try {
        await context.supabase
          .from('workflow_runs')
          .insert({
            id: runId,
            workflow_id: workflow.id,
            contact_id: context.contactId,
            transaction_id: context.transactionId,
            status: 'running',
            current_action_index: i + 1,
            started_at: new Date().toISOString(),
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
      };
    }

    // If action failed, stop execution
    if (!result.success) {
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
        error: result.error,
      };
    }
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
  };
}
