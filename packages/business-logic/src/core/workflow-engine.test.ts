import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateTrigger,
  evaluateCondition,
  evaluateConditions,
  executeAction,
  runWorkflow,
  parseDuration,
  pauseExecution,
  resumeExecution,
  scheduleResume,
} from './workflow-engine';
import type {
  WorkflowEvent,
  WorkflowContext,
  SupabaseClient,
  RunWorkflowOptions,
} from './workflow-engine';
import type {
  WorkflowTrigger,
  WorkflowCondition,
  WorkflowAction,
  Workflow,
  CompoundCondition,
  ConditionNode,
} from '@realflow/shared';
import {
  evaluateFieldCondition,
  evaluateConditionNode,
  evaluateConditionNodes,
} from './workflow-condition-evaluator';
import {
  classifyError,
  calculateRetryDelay,
  getErrorPolicy,
  recoverFromError,
} from './workflow-error-recovery';

// ─── Mock Helpers ─────────────────────────────────────────────────

function createMockSupabase(overrides?: Partial<Record<string, unknown>>): SupabaseClient {
  const defaultResult = { data: { id: 'mock-id' }, error: null };

  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(overrides?.insertResult ?? defaultResult),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(overrides?.updateResult ?? { data: null, error: null }),
      }),
    }),
  };
}

function createMockContext(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    contactId: 'contact-1',
    transactionId: 'txn-1',
    entityData: {},
    supabase: createMockSupabase(),
    ...overrides,
  };
}

function createMockWorkflow(overrides?: Partial<Workflow>): Workflow {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    trigger: { type: 'new_lead' },
    conditions: [],
    actions: [{ type: 'notify_agent', message: 'Test notification' }],
    isActive: true,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── parseDuration ────────────────────────────────────────────────

describe('parseDuration', () => {
  it('parses minutes correctly', () => {
    expect(parseDuration('30m')).toBe(30 * 60 * 1000);
    expect(parseDuration('1m')).toBe(60 * 1000);
  });

  it('parses hours correctly', () => {
    expect(parseDuration('24h')).toBe(24 * 60 * 60 * 1000);
    expect(parseDuration('1h')).toBe(60 * 60 * 1000);
  });

  it('parses days correctly', () => {
    expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDuration('1d')).toBe(24 * 60 * 60 * 1000);
    expect(parseDuration('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('throws for invalid format', () => {
    expect(() => parseDuration('abc')).toThrow('Invalid duration format');
    expect(() => parseDuration('7x')).toThrow('Invalid duration format');
    expect(() => parseDuration('')).toThrow('Invalid duration format');
    expect(() => parseDuration('d7')).toThrow('Invalid duration format');
  });
});

// ─── evaluateTrigger ──────────────────────────────────────────────

describe('evaluateTrigger', () => {
  // stage_change
  describe('stage_change trigger', () => {
    const trigger: WorkflowTrigger = { type: 'stage_change', to: 'under-contract' };

    it('matches when event type and "to" match', () => {
      const event: WorkflowEvent = {
        type: 'stage_change',
        data: { from: 'offer-made', to: 'under-contract' },
      };
      expect(evaluateTrigger(trigger, event)).toBe(true);
    });

    it('does not match when "to" differs', () => {
      const event: WorkflowEvent = {
        type: 'stage_change',
        data: { from: 'offer-made', to: 'settled' },
      };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });

    it('does not match non-stage_change events', () => {
      const event: WorkflowEvent = {
        type: 'new_lead',
        data: { to: 'under-contract' },
      };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });

    it('matches with optional "from" when present and correct', () => {
      const triggerWithFrom: WorkflowTrigger = {
        type: 'stage_change',
        from: 'offer-made',
        to: 'under-contract',
      };
      const event: WorkflowEvent = {
        type: 'stage_change',
        data: { from: 'offer-made', to: 'under-contract' },
      };
      expect(evaluateTrigger(triggerWithFrom, event)).toBe(true);
    });

    it('does not match when "from" is specified but differs', () => {
      const triggerWithFrom: WorkflowTrigger = {
        type: 'stage_change',
        from: 'active-search',
        to: 'under-contract',
      };
      const event: WorkflowEvent = {
        type: 'stage_change',
        data: { from: 'offer-made', to: 'under-contract' },
      };
      expect(evaluateTrigger(triggerWithFrom, event)).toBe(false);
    });
  });

  // new_lead
  describe('new_lead trigger', () => {
    it('matches any new_lead event without source filter', () => {
      const trigger: WorkflowTrigger = { type: 'new_lead' };
      const event: WorkflowEvent = { type: 'new_lead', data: { source: 'domain' } };
      expect(evaluateTrigger(trigger, event)).toBe(true);
    });

    it('matches when source matches', () => {
      const trigger: WorkflowTrigger = { type: 'new_lead', source: 'domain' };
      const event: WorkflowEvent = { type: 'new_lead', data: { source: 'domain' } };
      expect(evaluateTrigger(trigger, event)).toBe(true);
    });

    it('does not match when source differs', () => {
      const trigger: WorkflowTrigger = { type: 'new_lead', source: 'domain' };
      const event: WorkflowEvent = { type: 'new_lead', data: { source: 'rea' } };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });

    it('does not match non-new_lead events', () => {
      const trigger: WorkflowTrigger = { type: 'new_lead' };
      const event: WorkflowEvent = { type: 'field_change', data: { field: 'status' } };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });
  });

  // field_change
  describe('field_change trigger', () => {
    it('matches when field name matches', () => {
      const trigger: WorkflowTrigger = { type: 'field_change', field: 'clientBriefSignedOff' };
      const event: WorkflowEvent = {
        type: 'field_change',
        data: { field: 'clientBriefSignedOff' },
      };
      expect(evaluateTrigger(trigger, event)).toBe(true);
    });

    it('does not match when field name differs', () => {
      const trigger: WorkflowTrigger = { type: 'field_change', field: 'clientBriefSignedOff' };
      const event: WorkflowEvent = { type: 'field_change', data: { field: 'status' } };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });
  });

  // form_submitted
  describe('form_submitted trigger', () => {
    it('matches when formId matches', () => {
      const trigger: WorkflowTrigger = { type: 'form_submitted', formId: 'contact-form-1' };
      const event: WorkflowEvent = { type: 'form_submitted', data: { formId: 'contact-form-1' } };
      expect(evaluateTrigger(trigger, event)).toBe(true);
    });

    it('does not match when formId differs', () => {
      const trigger: WorkflowTrigger = { type: 'form_submitted', formId: 'contact-form-1' };
      const event: WorkflowEvent = { type: 'form_submitted', data: { formId: 'other-form' } };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });
  });

  // Scheduler-based triggers
  describe('scheduler-based triggers', () => {
    it('time_based always returns false', () => {
      const trigger: WorkflowTrigger = { type: 'time_based', schedule: '0 9 * * *' };
      const event: WorkflowEvent = { type: 'new_lead', data: {} };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });

    it('no_activity always returns false', () => {
      const trigger: WorkflowTrigger = { type: 'no_activity', days: 2 };
      const event: WorkflowEvent = { type: 'new_lead', data: {} };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });

    it('date_approaching always returns false', () => {
      const trigger: WorkflowTrigger = {
        type: 'date_approaching',
        field: 'settlementDate',
        daysBefore: 7,
      };
      const event: WorkflowEvent = { type: 'new_lead', data: {} };
      expect(evaluateTrigger(trigger, event)).toBe(false);
    });
  });
});

// ─── evaluateCondition ────────────────────────────────────────────

describe('evaluateCondition', () => {
  const ctx = createMockContext;

  it('equals: matches when values are equal', () => {
    const condition: WorkflowCondition = { field: 'status', operator: 'equals', value: 'active' };
    const context = ctx({ entityData: { status: 'active' } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('equals: fails when values differ', () => {
    const condition: WorkflowCondition = { field: 'status', operator: 'equals', value: 'active' };
    const context = ctx({ entityData: { status: 'inactive' } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  it('not_equals: matches when values differ', () => {
    const condition: WorkflowCondition = {
      field: 'status',
      operator: 'not_equals',
      value: 'deleted',
    };
    const context = ctx({ entityData: { status: 'active' } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('not_equals: fails when values are equal', () => {
    const condition: WorkflowCondition = {
      field: 'status',
      operator: 'not_equals',
      value: 'active',
    };
    const context = ctx({ entityData: { status: 'active' } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  it('contains: matches when string contains value', () => {
    const condition: WorkflowCondition = { field: 'notes', operator: 'contains', value: 'urgent' };
    const context = ctx({ entityData: { notes: 'This is urgent - call back' } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('contains: fails when string does not contain value', () => {
    const condition: WorkflowCondition = { field: 'notes', operator: 'contains', value: 'urgent' };
    const context = ctx({ entityData: { notes: 'Regular follow up' } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  it('greater_than: matches when value is greater', () => {
    const condition: WorkflowCondition = {
      field: 'matchScore',
      operator: 'greater_than',
      value: 79,
    };
    const context = ctx({ entityData: { matchScore: 85 } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('greater_than: fails when value is equal', () => {
    const condition: WorkflowCondition = {
      field: 'matchScore',
      operator: 'greater_than',
      value: 85,
    };
    const context = ctx({ entityData: { matchScore: 85 } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  it('greater_than: fails when value is less', () => {
    const condition: WorkflowCondition = {
      field: 'matchScore',
      operator: 'greater_than',
      value: 90,
    };
    const context = ctx({ entityData: { matchScore: 85 } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  it('less_than: matches when value is less', () => {
    const condition: WorkflowCondition = { field: 'budget', operator: 'less_than', value: 1000000 };
    const context = ctx({ entityData: { budget: 500000 } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('less_than: fails when value is greater', () => {
    const condition: WorkflowCondition = { field: 'budget', operator: 'less_than', value: 500000 };
    const context = ctx({ entityData: { budget: 1000000 } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  it('is_empty: matches for null', () => {
    const condition: WorkflowCondition = { field: 'email', operator: 'is_empty' };
    const context = ctx({ entityData: { email: null } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('is_empty: matches for undefined (missing field)', () => {
    const condition: WorkflowCondition = { field: 'email', operator: 'is_empty' };
    const context = ctx({ entityData: {} });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('is_empty: matches for empty string', () => {
    const condition: WorkflowCondition = { field: 'email', operator: 'is_empty' };
    const context = ctx({ entityData: { email: '' } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('is_empty: fails for non-empty value', () => {
    const condition: WorkflowCondition = { field: 'email', operator: 'is_empty' };
    const context = ctx({ entityData: { email: 'user@example.com' } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  it('is_not_empty: matches for non-empty value', () => {
    const condition: WorkflowCondition = { field: 'email', operator: 'is_not_empty' };
    const context = ctx({ entityData: { email: 'user@example.com' } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('is_not_empty: fails for null', () => {
    const condition: WorkflowCondition = { field: 'email', operator: 'is_not_empty' };
    const context = ctx({ entityData: { email: null } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  // Dot notation tests
  it('handles dot-notation fields (nested access)', () => {
    const condition: WorkflowCondition = {
      field: 'buyer_profile.budget_max',
      operator: 'greater_than',
      value: 500000,
    };
    const context = ctx({
      entityData: {
        buyer_profile: { budget_max: 750000 },
      },
    });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('handles deeply nested dot-notation fields', () => {
    const condition: WorkflowCondition = { field: 'a.b.c', operator: 'equals', value: 'deep' };
    const context = ctx({
      entityData: { a: { b: { c: 'deep' } } },
    });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('returns undefined (is_empty) for non-existent nested path', () => {
    const condition: WorkflowCondition = {
      field: 'buyer_profile.budget_max',
      operator: 'is_empty',
    };
    const context = ctx({ entityData: {} });
    expect(evaluateCondition(condition, context)).toBe(true);
  });
});

// ─── evaluateConditions ───────────────────────────────────────────

describe('evaluateConditions', () => {
  it('returns true when all conditions pass', () => {
    const conditions: WorkflowCondition[] = [
      { field: 'status', operator: 'equals', value: 'active' },
      { field: 'score', operator: 'greater_than', value: 50 },
    ];
    const context = createMockContext({ entityData: { status: 'active', score: 75 } });
    expect(evaluateConditions(conditions, context)).toBe(true);
  });

  it('returns false when any condition fails', () => {
    const conditions: WorkflowCondition[] = [
      { field: 'status', operator: 'equals', value: 'active' },
      { field: 'score', operator: 'greater_than', value: 80 },
    ];
    const context = createMockContext({ entityData: { status: 'active', score: 75 } });
    expect(evaluateConditions(conditions, context)).toBe(false);
  });

  it('returns true when conditions array is empty', () => {
    const context = createMockContext({ entityData: {} });
    expect(evaluateConditions([], context)).toBe(true);
  });
});

// ─── executeAction ────────────────────────────────────────────────

describe('executeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create_task: inserts a task and returns success', async () => {
    const action: WorkflowAction = {
      type: 'create_task',
      taskTitle: 'Call client',
      taskType: 'call',
      dueDaysFromNow: 1,
    };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('create_task');
    expect(context.supabase.from).toHaveBeenCalledWith('tasks');
  });

  it('create_task: returns error on DB failure', async () => {
    const action: WorkflowAction = {
      type: 'create_task',
      taskTitle: 'Call client',
      taskType: 'call',
      dueDaysFromNow: 0,
    };
    const supabase = createMockSupabase({
      insertResult: { data: null, error: { message: 'Insert failed' } },
    });
    const context = createMockContext({ supabase });
    const result = await executeAction(action, context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insert failed');
  });

  it('assign_contact: updates contact assignment', async () => {
    const action: WorkflowAction = {
      type: 'assign_contact',
      agentId: '00000000-0000-0000-0000-000000000002',
    };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('assign_contact');
    expect(context.supabase.from).toHaveBeenCalledWith('contacts');
  });

  it('assign_contact: fails when no contactId', async () => {
    const action: WorkflowAction = {
      type: 'assign_contact',
      agentId: '00000000-0000-0000-0000-000000000002',
    };
    const context = createMockContext({ contactId: undefined });
    const result = await executeAction(action, context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No contact ID in context');
  });

  it('update_field: updates field on entity', async () => {
    const action: WorkflowAction = {
      type: 'update_field',
      field: 'status',
      value: 'qualified',
    };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('update_field');
  });

  it('update_field: fails when no entity ID', async () => {
    const action: WorkflowAction = {
      type: 'update_field',
      field: 'status',
      value: 'qualified',
    };
    const context = createMockContext({ contactId: undefined, transactionId: undefined });
    const result = await executeAction(action, context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No entity ID in context');
  });

  it('add_tag: appends tag to contact tags', async () => {
    const action: WorkflowAction = { type: 'add_tag', tag: 'vip' };
    const context = createMockContext({ entityData: { tags: ['existing'] } });
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('add_tag');
    expect(result.result).toEqual({ tags: ['existing', 'vip'] });
  });

  it('add_tag: handles empty tags array', async () => {
    const action: WorkflowAction = { type: 'add_tag', tag: 'new-tag' };
    const context = createMockContext({ entityData: {} });
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ tags: ['new-tag'] });
  });

  it('add_tag: deduplicates tags', async () => {
    const action: WorkflowAction = { type: 'add_tag', tag: 'existing' };
    const context = createMockContext({ entityData: { tags: ['existing'] } });
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ tags: ['existing'] });
  });

  it('notify_agent: inserts internal note', async () => {
    const action: WorkflowAction = { type: 'notify_agent', message: 'New lead arrived' };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('notify_agent');
    expect(context.supabase.from).toHaveBeenCalledWith('conversation_messages');
  });

  it('send_email: queues email in outbox', async () => {
    const action: WorkflowAction = { type: 'send_email', templateId: 'welcome-email' };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('send_email');
    expect(context.supabase.from).toHaveBeenCalledWith('outbox');
  });

  it('send_sms: queues SMS in outbox', async () => {
    const action: WorkflowAction = { type: 'send_sms', templateId: 'sms-template' };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('send_sms');
    expect(context.supabase.from).toHaveBeenCalledWith('outbox');
  });

  it('post_social: schedules a social post', async () => {
    const action: WorkflowAction = {
      type: 'post_social',
      platforms: ['facebook', 'instagram'],
      templateId: 'listing-post',
    };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('post_social');
    expect(context.supabase.from).toHaveBeenCalledWith('social_posts');
  });

  it('webhook: makes HTTP POST', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    vi.stubGlobal('fetch', mockFetch);

    const action: WorkflowAction = {
      type: 'webhook',
      url: 'https://example.com/hook',
      payload: { event: 'test' },
    };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('webhook');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    vi.unstubAllGlobals();
  });

  it('webhook: returns failure on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', mockFetch);

    const action: WorkflowAction = {
      type: 'webhook',
      url: 'https://example.com/hook',
      payload: {},
    };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');

    vi.unstubAllGlobals();
  });

  it('wait: returns paused result with resumeAt', async () => {
    const action: WorkflowAction = { type: 'wait', duration: '7d' };
    const context = createMockContext();
    const before = Date.now();
    const result = await executeAction(action, context);
    const after = Date.now();

    expect(result.success).toBe(true);
    expect(result.paused).toBe(true);
    expect(result.actionType).toBe('wait');
    expect(result.resumeAt).toBeDefined();

    const resumeMs = new Date(result.resumeAt!).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(resumeMs).toBeGreaterThanOrEqual(before + sevenDays);
    expect(resumeMs).toBeLessThanOrEqual(after + sevenDays);
  });

  it('create_follow_up: inserts follow-up task', async () => {
    const action: WorkflowAction = {
      type: 'create_follow_up',
      daysFromNow: 30,
      taskType: 'follow-up',
    };
    const context = createMockContext();
    const result = await executeAction(action, context);

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('create_follow_up');
    expect(context.supabase.from).toHaveBeenCalledWith('tasks');
  });
});

// ─── runWorkflow ──────────────────────────────────────────────────

describe('runWorkflow', () => {
  it('executes all actions when trigger and conditions match', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      conditions: [],
      actions: [
        { type: 'notify_agent', message: 'New lead!' },
        { type: 'create_task', taskTitle: 'Call lead', taskType: 'call', dueDaysFromNow: 0 },
      ],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext();
    const result = await runWorkflow(workflow, event, context);

    expect(result.status).toBe('completed');
    expect(result.actionsExecuted).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.success).toBe(true);
    expect(result.results[1]!.success).toBe(true);
  });

  it('does not execute when trigger does not match', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'stage_change', to: 'settled' },
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext();
    const result = await runWorkflow(workflow, event, context);

    expect(result.actionsExecuted).toBe(0);
    expect(result.error).toBe('Trigger did not match event');
  });

  it('does not execute when conditions fail', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      conditions: [{ field: 'status', operator: 'equals', value: 'vip' }],
      actions: [{ type: 'notify_agent', message: 'Should not fire' }],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext({ entityData: { status: 'normal' } });
    const result = await runWorkflow(workflow, event, context);

    expect(result.actionsExecuted).toBe(0);
    expect(result.error).toBe('Conditions not met');
  });

  it('executes without conditions (empty conditions array)', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      conditions: [],
      actions: [{ type: 'notify_agent', message: 'No conditions check' }],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext();
    const result = await runWorkflow(workflow, event, context);

    expect(result.status).toBe('completed');
    expect(result.actionsExecuted).toBe(1);
  });

  it('pauses on wait action', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'stage_change', to: 'settled-nurture' },
      actions: [
        { type: 'send_email', templateId: 'congratulations' },
        { type: 'wait', duration: '7d' },
        { type: 'send_email', templateId: 'review-request' },
      ],
    });

    const event: WorkflowEvent = { type: 'stage_change', data: { to: 'settled-nurture' } };
    const context = createMockContext();
    const result = await runWorkflow(workflow, event, context);

    expect(result.status).toBe('paused');
    expect(result.actionsExecuted).toBe(2); // send_email + wait
    expect(result.results[1]!.paused).toBe(true);
    expect(result.results[1]!.resumeAt).toBeDefined();
  });

  it('stops and fails on action error', async () => {
    const supabase = createMockSupabase({
      insertResult: { data: null, error: { message: 'DB error' } },
    });

    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      actions: [
        { type: 'create_task', taskTitle: 'Task 1', taskType: 'call', dueDaysFromNow: 0 },
        { type: 'notify_agent', message: 'Should not execute' },
      ],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext({ supabase });
    const result = await runWorkflow(workflow, event, context);

    expect(result.status).toBe('failed');
    expect(result.actionsExecuted).toBe(1);
    expect(result.error).toBe('DB error');
  });

  it('resumes from a specific action index', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'stage_change', to: 'settled-nurture' },
      actions: [
        { type: 'send_email', templateId: 'congratulations' },
        { type: 'wait', duration: '7d' },
        { type: 'send_email', templateId: 'review-request' },
      ],
    });

    // Resume from index 2 (after the wait)
    const event: WorkflowEvent = { type: 'stage_change', data: { to: 'settled-nurture' } };
    const context = createMockContext();
    const result = await runWorkflow(workflow, event, context, 2);

    expect(result.status).toBe('completed');
    expect(result.actionsExecuted).toBe(1); // Only the last email
    expect(result.results[0]!.actionType).toBe('send_email');
  });
});

// ════════════════════════════════════════════════════════════════════
// NEW TESTS: Condition Evaluator (AND/OR/NOT, date, domain-specific)
// ════════════════════════════════════════════════════════════════════

describe('evaluateFieldCondition (enhanced operators)', () => {
  const ctx = createMockContext;

  // ─── starts_with ──────────────────────────────────────────────

  it('starts_with: matches when string starts with value', () => {
    const condition: WorkflowCondition = { field: 'name', operator: 'starts_with', value: 'John' };
    const context = ctx({ entityData: { name: 'John Smith' } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('starts_with: fails when string does not start with value', () => {
    const condition: WorkflowCondition = { field: 'name', operator: 'starts_with', value: 'Jane' };
    const context = ctx({ entityData: { name: 'John Smith' } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  // ─── Date operators ───────────────────────────────────────────

  it('before: matches when field date is before comparison', () => {
    const condition: WorkflowCondition = {
      field: 'createdAt',
      operator: 'before',
      value: '2026-06-01T00:00:00.000Z',
    };
    const context = ctx({ entityData: { createdAt: '2026-01-15T00:00:00.000Z' } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('before: fails when field date is after comparison', () => {
    const condition: WorkflowCondition = {
      field: 'createdAt',
      operator: 'before',
      value: '2026-01-01T00:00:00.000Z',
    };
    const context = ctx({ entityData: { createdAt: '2026-06-15T00:00:00.000Z' } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('after: matches when field date is after comparison', () => {
    const condition: WorkflowCondition = {
      field: 'createdAt',
      operator: 'after',
      value: '2026-01-01T00:00:00.000Z',
    };
    const context = ctx({ entityData: { createdAt: '2026-06-15T00:00:00.000Z' } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('after: fails when field date is before comparison', () => {
    const condition: WorkflowCondition = {
      field: 'createdAt',
      operator: 'after',
      value: '2026-12-01T00:00:00.000Z',
    };
    const context = ctx({ entityData: { createdAt: '2026-06-15T00:00:00.000Z' } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('within_days: matches when date is within range', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const condition: WorkflowCondition = {
      field: 'lastContact',
      operator: 'within_days',
      value: 5,
    };
    const context = ctx({ entityData: { lastContact: twoDaysAgo.toISOString() } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('within_days: fails when date is outside range', () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const condition: WorkflowCondition = {
      field: 'lastContact',
      operator: 'within_days',
      value: 5,
    };
    const context = ctx({ entityData: { lastContact: tenDaysAgo.toISOString() } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('before: returns false for invalid date', () => {
    const condition: WorkflowCondition = {
      field: 'createdAt',
      operator: 'before',
      value: '2026-06-01T00:00:00.000Z',
    };
    const context = ctx({ entityData: { createdAt: 'not-a-date' } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  // ─── Contact-specific operators ───────────────────────────────

  it('has_tag: matches when tags array contains the value', () => {
    const condition: WorkflowCondition = { field: 'tags', operator: 'has_tag', value: 'vip' };
    const context = ctx({ entityData: { tags: ['vip', 'buyer'] } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('has_tag: fails when tags array does not contain the value', () => {
    const condition: WorkflowCondition = { field: 'tags', operator: 'has_tag', value: 'seller' };
    const context = ctx({ entityData: { tags: ['vip', 'buyer'] } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('has_tag: fails when field is not an array', () => {
    const condition: WorkflowCondition = { field: 'tags', operator: 'has_tag', value: 'vip' };
    const context = ctx({ entityData: { tags: 'vip' } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('in_stage: matches when value is a string and matches', () => {
    const condition: WorkflowCondition = {
      field: 'stage',
      operator: 'in_stage',
      value: 'active-search',
    };
    const context = ctx({ entityData: { stage: 'active-search' } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('in_stage: matches when value is an array containing the stage', () => {
    const condition: WorkflowCondition = {
      field: 'stage',
      operator: 'in_stage',
      value: ['active-search', 'offer-negotiate'],
    };
    const context = ctx({ entityData: { stage: 'offer-negotiate' } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('in_stage: fails when stage is not in array', () => {
    const condition: WorkflowCondition = {
      field: 'stage',
      operator: 'in_stage',
      value: ['active-search', 'offer-negotiate'],
    };
    const context = ctx({ entityData: { stage: 'settled' } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('lead_score_above: matches when score is above threshold', () => {
    const condition: WorkflowCondition = {
      field: 'leadScore',
      operator: 'lead_score_above',
      value: 70,
    };
    const context = ctx({ entityData: { leadScore: 85 } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('lead_score_above: fails when score is below threshold', () => {
    const condition: WorkflowCondition = {
      field: 'leadScore',
      operator: 'lead_score_above',
      value: 90,
    };
    const context = ctx({ entityData: { leadScore: 85 } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  // ─── Property-specific operators ──────────────────────────────

  it('price_range: matches when price is within range', () => {
    const condition: WorkflowCondition = {
      field: 'price',
      operator: 'price_range',
      value: { min: 500000, max: 1500000 },
    };
    const context = ctx({ entityData: { price: 800000 } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('price_range: fails when price is below range', () => {
    const condition: WorkflowCondition = {
      field: 'price',
      operator: 'price_range',
      value: { min: 500000, max: 1500000 },
    };
    const context = ctx({ entityData: { price: 300000 } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('price_range: fails when price is above range', () => {
    const condition: WorkflowCondition = {
      field: 'price',
      operator: 'price_range',
      value: { min: 500000, max: 1500000 },
    };
    const context = ctx({ entityData: { price: 2000000 } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('suburb_match: matches single suburb (case insensitive)', () => {
    const condition: WorkflowCondition = {
      field: 'suburb',
      operator: 'suburb_match',
      value: 'Bondi',
    };
    const context = ctx({ entityData: { suburb: 'bondi' } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('suburb_match: matches from suburb array', () => {
    const condition: WorkflowCondition = {
      field: 'suburb',
      operator: 'suburb_match',
      value: ['Bondi', 'Coogee', 'Manly'],
    };
    const context = ctx({ entityData: { suburb: 'Coogee' } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('suburb_match: fails when suburb not in array', () => {
    const condition: WorkflowCondition = {
      field: 'suburb',
      operator: 'suburb_match',
      value: ['Bondi', 'Coogee'],
    };
    const context = ctx({ entityData: { suburb: 'Parramatta' } });
    expect(evaluateFieldCondition(condition, context)).toBe(false);
  });

  it('days_on_market: matches when days exceed threshold', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const condition: WorkflowCondition = {
      field: 'listedDate',
      operator: 'days_on_market',
      value: 20,
    };
    const context = ctx({ entityData: { listedDate: thirtyDaysAgo.toISOString() } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });

  it('days_on_market: matches within min/max range', () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const condition: WorkflowCondition = {
      field: 'listedDate',
      operator: 'days_on_market',
      value: { min: 10, max: 30 },
    };
    const context = ctx({ entityData: { listedDate: twentyDaysAgo.toISOString() } });
    expect(evaluateFieldCondition(condition, context)).toBe(true);
  });
});

// ─── Compound Conditions (AND / OR / NOT) ────────────────────────

describe('evaluateConditionNode (compound logic)', () => {
  const ctx = createMockContext;

  it('AND: passes when all child conditions are true', () => {
    const compound: CompoundCondition = {
      logic: 'AND',
      conditions: [
        { field: 'status', operator: 'equals', value: 'active' },
        { field: 'score', operator: 'greater_than', value: 50 },
      ],
    };
    const context = ctx({ entityData: { status: 'active', score: 75 } });
    expect(evaluateConditionNode(compound, context)).toBe(true);
  });

  it('AND: fails when any child condition is false', () => {
    const compound: CompoundCondition = {
      logic: 'AND',
      conditions: [
        { field: 'status', operator: 'equals', value: 'active' },
        { field: 'score', operator: 'greater_than', value: 80 },
      ],
    };
    const context = ctx({ entityData: { status: 'active', score: 75 } });
    expect(evaluateConditionNode(compound, context)).toBe(false);
  });

  it('OR: passes when at least one child condition is true', () => {
    const compound: CompoundCondition = {
      logic: 'OR',
      conditions: [
        { field: 'status', operator: 'equals', value: 'inactive' },
        { field: 'score', operator: 'greater_than', value: 50 },
      ],
    };
    const context = ctx({ entityData: { status: 'active', score: 75 } });
    expect(evaluateConditionNode(compound, context)).toBe(true);
  });

  it('OR: fails when all child conditions are false', () => {
    const compound: CompoundCondition = {
      logic: 'OR',
      conditions: [
        { field: 'status', operator: 'equals', value: 'inactive' },
        { field: 'score', operator: 'greater_than', value: 90 },
      ],
    };
    const context = ctx({ entityData: { status: 'active', score: 75 } });
    expect(evaluateConditionNode(compound, context)).toBe(false);
  });

  it('NOT: negates a true condition to false', () => {
    const compound: CompoundCondition = {
      logic: 'NOT',
      condition: { field: 'status', operator: 'equals', value: 'active' },
    };
    const context = ctx({ entityData: { status: 'active' } });
    expect(evaluateConditionNode(compound, context)).toBe(false);
  });

  it('NOT: negates a false condition to true', () => {
    const compound: CompoundCondition = {
      logic: 'NOT',
      condition: { field: 'status', operator: 'equals', value: 'inactive' },
    };
    const context = ctx({ entityData: { status: 'active' } });
    expect(evaluateConditionNode(compound, context)).toBe(true);
  });

  it('nested: AND containing OR containing NOT', () => {
    const compound: CompoundCondition = {
      logic: 'AND',
      conditions: [
        { field: 'status', operator: 'equals', value: 'active' },
        {
          logic: 'OR',
          conditions: [
            { field: 'score', operator: 'greater_than', value: 90 },
            {
              logic: 'NOT',
              condition: { field: 'tags', operator: 'has_tag', value: 'disqualified' },
            },
          ],
        },
      ],
    };
    const context = ctx({
      entityData: { status: 'active', score: 50, tags: ['buyer'] },
    });
    // status=active (true) AND (score>90 (false) OR NOT has_tag disqualified (true)) => true
    expect(evaluateConditionNode(compound, context)).toBe(true);
  });

  it('evaluateConditionNodes: evaluates mixed simple and compound conditions', () => {
    const conditions: ConditionNode[] = [
      { field: 'status', operator: 'equals', value: 'active' },
      {
        logic: 'OR',
        conditions: [
          { field: 'source', operator: 'equals', value: 'domain' },
          { field: 'source', operator: 'equals', value: 'rea' },
        ],
      },
    ];
    const context = ctx({ entityData: { status: 'active', source: 'rea' } });
    expect(evaluateConditionNodes(conditions, context)).toBe(true);
  });

  it('evaluateConditionNodes: returns true for empty array', () => {
    const context = ctx({ entityData: {} });
    expect(evaluateConditionNodes([], context)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// NEW TESTS: Pause / Resume
// ════════════════════════════════════════════════════════════════════

describe('pauseExecution', () => {
  it('calls supabase update with paused status', async () => {
    const context = createMockContext();
    const result = await pauseExecution('run-1', context);

    expect(result.success).toBe(true);
    expect(context.supabase.from).toHaveBeenCalledWith('workflow_runs');
  });

  it('returns error when supabase update fails', async () => {
    const supabase = createMockSupabase({
      updateResult: { data: null, error: { message: 'Update failed' } },
    });
    const context = createMockContext({ supabase });
    const result = await pauseExecution('run-1', context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Update failed');
  });
});

describe('resumeExecution', () => {
  it('calls supabase update with running status', async () => {
    const context = createMockContext();
    const result = await resumeExecution('run-1', context);

    expect(result.success).toBe(true);
    expect(context.supabase.from).toHaveBeenCalledWith('workflow_runs');
  });

  it('returns error when supabase update fails', async () => {
    const supabase = createMockSupabase({
      updateResult: { data: null, error: { message: 'Update failed' } },
    });
    const context = createMockContext({ supabase });
    const result = await resumeExecution('run-1', context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Update failed');
  });
});

describe('scheduleResume', () => {
  it('sets resume_at in the future', async () => {
    const context = createMockContext();
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const result = await scheduleResume('run-1', futureDate, context);

    expect(result.success).toBe(true);
    expect(context.supabase.from).toHaveBeenCalledWith('workflow_runs');
  });

  it('rejects resume_at in the past', async () => {
    const context = createMockContext();
    const pastDate = new Date(Date.now() - 1000);
    const result = await scheduleResume('run-1', pastDate, context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('resumeAt must be in the future');
  });
});

// ════════════════════════════════════════════════════════════════════
// NEW TESTS: Retry with Exponential Backoff
// ════════════════════════════════════════════════════════════════════

describe('calculateRetryDelay', () => {
  it('immediate: always returns 0', () => {
    expect(calculateRetryDelay('immediate', 0, 1000, 300000)).toBe(0);
    expect(calculateRetryDelay('immediate', 5, 1000, 300000)).toBe(0);
  });

  it('linear: scales linearly with attempt', () => {
    expect(calculateRetryDelay('linear', 0, 1000, 300000)).toBe(1000);
    expect(calculateRetryDelay('linear', 1, 1000, 300000)).toBe(2000);
    expect(calculateRetryDelay('linear', 2, 1000, 300000)).toBe(3000);
  });

  it('exponential: doubles each attempt', () => {
    expect(calculateRetryDelay('exponential', 0, 1000, 300000)).toBe(1000);
    expect(calculateRetryDelay('exponential', 1, 1000, 300000)).toBe(2000);
    expect(calculateRetryDelay('exponential', 2, 1000, 300000)).toBe(4000);
    expect(calculateRetryDelay('exponential', 3, 1000, 300000)).toBe(8000);
  });

  it('caps delay at maxDelayMs', () => {
    expect(calculateRetryDelay('exponential', 10, 1000, 5000)).toBe(5000);
    expect(calculateRetryDelay('linear', 100, 1000, 5000)).toBe(5000);
  });
});

// ════════════════════════════════════════════════════════════════════
// NEW TESTS: Error Classification & Recovery
// ════════════════════════════════════════════════════════════════════

describe('classifyError', () => {
  it('classifies timeout errors as transient', () => {
    expect(classifyError('Request timeout')).toBe('transient');
    expect(classifyError('ETIMEDOUT')).toBe('transient');
  });

  it('classifies connection errors as transient', () => {
    expect(classifyError('ECONNRESET')).toBe('transient');
    expect(classifyError('ECONNREFUSED')).toBe('transient');
  });

  it('classifies rate limit errors as transient', () => {
    expect(classifyError('429 Too Many Requests')).toBe('transient');
    expect(classifyError('Rate limit exceeded')).toBe('transient');
  });

  it('classifies 503 as transient', () => {
    expect(classifyError('503 Service Unavailable')).toBe('transient');
  });

  it('classifies not found errors as permanent', () => {
    expect(classifyError('Resource not found')).toBe('permanent');
    expect(classifyError('404 Not Found')).toBe('permanent');
  });

  it('classifies unauthorized errors as permanent', () => {
    expect(classifyError('Unauthorized access')).toBe('permanent');
    expect(classifyError('401 Unauthorized')).toBe('permanent');
  });

  it('classifies forbidden errors as permanent', () => {
    expect(classifyError('403 Forbidden')).toBe('permanent');
  });

  it('classifies context missing errors as permanent', () => {
    expect(classifyError('No contact ID in context')).toBe('permanent');
    expect(classifyError('No entity ID in context')).toBe('permanent');
  });

  it('defaults to transient for unknown errors', () => {
    expect(classifyError('Something unexpected happened')).toBe('transient');
  });
});

describe('getErrorPolicy', () => {
  it('returns default policy for known action types', () => {
    const policy = getErrorPolicy('send_email');
    expect(policy.classification).toBe('transient');
    expect(policy.recoveryStrategy).toBe('retry');
    expect(policy.retryConfig).toBeDefined();
    expect(policy.retryConfig!.maxRetries).toBe(3);
  });

  it('returns default policy for assign_contact (permanent/fail)', () => {
    const policy = getErrorPolicy('assign_contact');
    expect(policy.classification).toBe('permanent');
    expect(policy.recoveryStrategy).toBe('fail');
  });

  it('returns continue_with_warning for notify_agent', () => {
    const policy = getErrorPolicy('notify_agent');
    expect(policy.recoveryStrategy).toBe('continue_with_warning');
  });

  it('applies overrides when provided', () => {
    const policy = getErrorPolicy('send_email', { recoveryStrategy: 'skip' });
    expect(policy.recoveryStrategy).toBe('skip');
    // classification should still be from defaults
    expect(policy.classification).toBe('transient');
  });

  it('returns fallback policy for unknown action types', () => {
    const policy = getErrorPolicy('unknown_action');
    expect(policy.classification).toBe('transient');
    expect(policy.recoveryStrategy).toBe('retry');
  });
});

describe('recoverFromError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skip strategy: returns success so workflow continues', async () => {
    const action: WorkflowAction = { type: 'notify_agent', message: 'test' };
    const failedResult = { success: false, actionType: 'notify_agent', error: 'DB error' };
    const context = createMockContext();

    const result = await recoverFromError(
      action,
      failedResult,
      context,
      { classification: 'transient', recoveryStrategy: 'skip' },
      { stepIndex: 0, runId: 'run-1', workflowId: 'wf-1' },
    );

    expect(result.success).toBe(true);
    expect(result.strategyApplied).toBe('skip');
    expect(result.warning).toContain('skipped');
  });

  it('continue_with_warning strategy: returns success with warning', async () => {
    const action: WorkflowAction = { type: 'notify_agent', message: 'test' };
    const failedResult = { success: false, actionType: 'notify_agent', error: 'DB error' };
    const context = createMockContext();

    const result = await recoverFromError(
      action,
      failedResult,
      context,
      { classification: 'transient', recoveryStrategy: 'continue_with_warning' },
      { stepIndex: 0, runId: 'run-1', workflowId: 'wf-1' },
    );

    expect(result.success).toBe(true);
    expect(result.strategyApplied).toBe('continue_with_warning');
    expect(result.warning).toContain('failed but workflow continues');
  });

  it('permanent fail strategy: dead-letters immediately', async () => {
    const action: WorkflowAction = {
      type: 'assign_contact',
      agentId: '00000000-0000-0000-0000-000000000001',
    };
    const failedResult = {
      success: false,
      actionType: 'assign_contact',
      error: 'No contact ID in context',
    };
    const context = createMockContext();

    const result = await recoverFromError(
      action,
      failedResult,
      context,
      { classification: 'permanent', recoveryStrategy: 'fail' },
      { stepIndex: 0, runId: 'run-1', workflowId: 'wf-1' },
    );

    expect(result.success).toBe(false);
    expect(result.strategyApplied).toBe('fail');
    expect(result.deadLettered).toBe(true);
    expect(result.retryAttempts).toBe(0);
  });

  it('retry strategy: retries and succeeds on second attempt', async () => {
    let callCount = 0;
    const supabase: SupabaseClient = {
      from: vi.fn().mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 1) {
                return Promise.resolve({ data: null, error: { message: 'Temporary error' } });
              }
              return Promise.resolve({ data: { id: 'mock-id' }, error: null });
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })),
    };

    const action: WorkflowAction = {
      type: 'create_task',
      taskTitle: 'Test',
      taskType: 'call',
      dueDaysFromNow: 0,
    };
    const failedResult = { success: false, actionType: 'create_task', error: 'Temporary error' };
    const context = createMockContext({ supabase });

    const onRetryAttempt = vi.fn();

    const result = await recoverFromError(
      action,
      failedResult,
      context,
      {
        classification: 'transient',
        recoveryStrategy: 'retry',
        retryConfig: { maxRetries: 3, strategy: 'immediate', baseDelayMs: 0, maxDelayMs: 0 },
      },
      {
        stepIndex: 0,
        runId: 'run-1',
        workflowId: 'wf-1',
        onRetryAttempt,
      },
    );

    expect(result.success).toBe(true);
    expect(result.strategyApplied).toBe('retry');
    expect(result.retryAttempts).toBeGreaterThanOrEqual(1);
  });

  it('fallback strategy: executes fallback action when primary fails', async () => {
    const action: WorkflowAction = { type: 'send_email', templateId: 'welcome' };
    const failedResult = { success: false, actionType: 'send_email', error: 'SMTP down' };
    const context = createMockContext();

    const result = await recoverFromError(
      action,
      failedResult,
      context,
      {
        classification: 'transient',
        recoveryStrategy: 'fallback',
        fallbackAction: { type: 'notify_agent', message: 'Email failed - manual follow up needed' },
      },
      { stepIndex: 0, runId: 'run-1', workflowId: 'wf-1' },
    );

    expect(result.success).toBe(true);
    expect(result.strategyApplied).toBe('fallback');
    expect(result.warning).toContain('fallback succeeded');
  });
});

// ════════════════════════════════════════════════════════════════════
// NEW TESTS: Execution History Logging
// ════════════════════════════════════════════════════════════════════

describe('execution history logging', () => {
  it('includes execution log in completed workflow result', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      conditions: [],
      actions: [
        { type: 'notify_agent', message: 'New lead!' },
        { type: 'add_tag', tag: 'new' },
      ],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext({ entityData: { tags: [] } });
    const result = await runWorkflow(workflow, event, context);

    expect(result.executionLog).toBeDefined();
    expect(result.executionLog).toHaveLength(2);
    expect(result.executionLog[0]!.stepIndex).toBe(0);
    expect(result.executionLog[0]!.actionType).toBe('notify_agent');
    expect(result.executionLog[0]!.status).toBe('completed');
    expect(result.executionLog[0]!.startedAt).toBeDefined();
    expect(result.executionLog[0]!.completedAt).toBeDefined();
    expect(result.executionLog[0]!.durationMs).toBeDefined();
    expect(result.executionLog[1]!.stepIndex).toBe(1);
    expect(result.executionLog[1]!.actionType).toBe('add_tag');
    expect(result.executionLog[1]!.status).toBe('completed');
  });

  it('logs failed step in execution log', async () => {
    const supabase = createMockSupabase({
      insertResult: { data: null, error: { message: 'DB error' } },
    });

    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      actions: [{ type: 'create_task', taskTitle: 'Task', taskType: 'call', dueDaysFromNow: 0 }],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext({ supabase });
    const result = await runWorkflow(workflow, event, context);

    expect(result.executionLog).toHaveLength(1);
    expect(result.executionLog[0]!.status).toBe('failed');
    expect(result.executionLog[0]!.error).toBe('DB error');
  });

  it('includes execution log in paused workflow result', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'stage_change', to: 'settled-nurture' },
      actions: [
        { type: 'send_email', templateId: 'congratulations' },
        { type: 'wait', duration: '7d' },
        { type: 'send_email', templateId: 'review-request' },
      ],
    });

    const event: WorkflowEvent = { type: 'stage_change', data: { to: 'settled-nurture' } };
    const context = createMockContext();
    const result = await runWorkflow(workflow, event, context);

    expect(result.status).toBe('paused');
    expect(result.executionLog).toHaveLength(2);
    expect(result.executionLog[0]!.actionType).toBe('send_email');
    expect(result.executionLog[0]!.status).toBe('completed');
    expect(result.executionLog[1]!.actionType).toBe('wait');
    expect(result.executionLog[1]!.status).toBe('completed');
  });

  it('calls onStepLog callback for each step', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      conditions: [],
      actions: [
        { type: 'notify_agent', message: 'Step 1' },
        { type: 'add_tag', tag: 'logged' },
      ],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext({ entityData: { tags: [] } });
    const onStepLog = vi.fn();

    await runWorkflow(workflow, event, context, 0, { onStepLog });

    // Each step emits a started + completed log (started is replaced, so 2 steps = 4 calls)
    expect(onStepLog).toHaveBeenCalled();
    // At minimum we should have gotten the started + completed for each step
    expect(onStepLog.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('tracks variable context snapshots when variables are set', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      conditions: [],
      actions: [{ type: 'notify_agent', message: 'Step 1' }],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext({ variables: { step: 'initial' } });
    const result = await runWorkflow(workflow, event, context);

    expect(result.executionLog[0]!.variableSnapshot).toEqual({ step: 'initial' });
  });
});

// ════════════════════════════════════════════════════════════════════
// NEW TESTS: Retry integration with runWorkflow
// ════════════════════════════════════════════════════════════════════

describe('runWorkflow with retry enabled', () => {
  it('retries a failed action and continues when recovery succeeds (continue_with_warning)', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      conditions: [],
      actions: [
        { type: 'notify_agent', message: 'This will fail then recover' },
        { type: 'add_tag', tag: 'processed' },
      ],
    });

    // notify_agent will fail, but its default policy is continue_with_warning
    const supabase = createMockSupabase({
      insertResult: { data: null, error: { message: 'Temporary failure' } },
    });
    // Override to make add_tag succeed
    let callCount = 0;
    supabase.from = vi.fn().mockImplementation(() => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({ data: null, error: { message: 'Temporary failure' } });
            }
            return Promise.resolve({ data: { id: 'mock-id' }, error: null });
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }));

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext({ supabase, entityData: { tags: [] } });

    const options: RunWorkflowOptions = {
      enableRetry: true,
      actionErrorPolicies: {
        notify_agent: { recoveryStrategy: 'continue_with_warning' },
      },
    };

    const result = await runWorkflow(workflow, event, context, 0, options);

    // The workflow should complete because notify_agent uses continue_with_warning
    expect(result.status).toBe('completed');
    expect(result.actionsExecuted).toBe(2);
    expect(result.results[0]!.warning).toContain('failed but workflow continues');
  });

  it('empty executionLog when trigger does not match', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'stage_change', to: 'settled' },
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext();
    const result = await runWorkflow(workflow, event, context);

    expect(result.executionLog).toEqual([]);
  });

  it('empty executionLog when conditions not met', async () => {
    const workflow = createMockWorkflow({
      trigger: { type: 'new_lead' },
      conditions: [{ field: 'status', operator: 'equals', value: 'vip' }],
    });

    const event: WorkflowEvent = { type: 'new_lead', data: {} };
    const context = createMockContext({ entityData: { status: 'normal' } });
    const result = await runWorkflow(workflow, event, context);

    expect(result.executionLog).toEqual([]);
  });
});
