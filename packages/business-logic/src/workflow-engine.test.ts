import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateTrigger,
  evaluateCondition,
  evaluateConditions,
  executeAction,
  runWorkflow,
  parseDuration,
} from './workflow-engine';
import type { WorkflowEvent, WorkflowContext, SupabaseClient } from './workflow-engine';
import type { WorkflowTrigger, WorkflowCondition, WorkflowAction, Workflow } from '@realflow/shared';

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
    actions: [
      { type: 'notify_agent', message: 'Test notification' },
    ],
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
      const triggerWithFrom: WorkflowTrigger = { type: 'stage_change', from: 'offer-made', to: 'under-contract' };
      const event: WorkflowEvent = {
        type: 'stage_change',
        data: { from: 'offer-made', to: 'under-contract' },
      };
      expect(evaluateTrigger(triggerWithFrom, event)).toBe(true);
    });

    it('does not match when "from" is specified but differs', () => {
      const triggerWithFrom: WorkflowTrigger = { type: 'stage_change', from: 'active-search', to: 'under-contract' };
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
      const event: WorkflowEvent = { type: 'field_change', data: { field: 'clientBriefSignedOff' } };
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
      const trigger: WorkflowTrigger = { type: 'date_approaching', field: 'settlementDate', daysBefore: 7 };
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
    const condition: WorkflowCondition = { field: 'status', operator: 'not_equals', value: 'deleted' };
    const context = ctx({ entityData: { status: 'active' } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('not_equals: fails when values are equal', () => {
    const condition: WorkflowCondition = { field: 'status', operator: 'not_equals', value: 'active' };
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
    const condition: WorkflowCondition = { field: 'matchScore', operator: 'greater_than', value: 79 };
    const context = ctx({ entityData: { matchScore: 85 } });
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('greater_than: fails when value is equal', () => {
    const condition: WorkflowCondition = { field: 'matchScore', operator: 'greater_than', value: 85 };
    const context = ctx({ entityData: { matchScore: 85 } });
    expect(evaluateCondition(condition, context)).toBe(false);
  });

  it('greater_than: fails when value is less', () => {
    const condition: WorkflowCondition = { field: 'matchScore', operator: 'greater_than', value: 90 };
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
    const condition: WorkflowCondition = { field: 'buyer_profile.budget_max', operator: 'greater_than', value: 500000 };
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
    const condition: WorkflowCondition = { field: 'buyer_profile.budget_max', operator: 'is_empty' };
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
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/hook', expect.objectContaining({
      method: 'POST',
    }));

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
