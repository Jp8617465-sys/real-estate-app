import { describe, it, expect } from 'vitest';
import {
  WorkflowTriggerSchema,
  WorkflowActionSchema,
  WorkflowConditionSchema,
  WorkflowSchema,
  WorkflowRunStatusSchema,
  WorkflowRunSchema,
} from './workflow';

const uuid = () => '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();

// ─── WorkflowTriggerSchema ─────────────────────────────────────────

describe('WorkflowTriggerSchema', () => {
  it('accepts stage_change trigger', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'stage_change', to: 'qualified-lead' });
    expect(result.type).toBe('stage_change');
  });

  it('accepts stage_change with optional from', () => {
    const result = WorkflowTriggerSchema.parse({
      type: 'stage_change',
      from: 'new-enquiry',
      to: 'qualified-lead',
    });
    expect(result.type).toBe('stage_change');
  });

  it('accepts new_lead trigger', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'new_lead' });
    expect(result.type).toBe('new_lead');
  });

  it('accepts new_lead trigger with source', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'new_lead', source: 'domain' });
    expect(result.type).toBe('new_lead');
  });

  it('accepts time_based trigger', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'time_based', schedule: '0 9 * * 1' });
    expect(result.type).toBe('time_based');
  });

  it('accepts field_change trigger', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'field_change', field: 'email' });
    expect(result.type).toBe('field_change');
  });

  it('accepts no_activity trigger', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'no_activity', days: 14 });
    expect(result.type).toBe('no_activity');
  });

  it('accepts date_approaching trigger', () => {
    const result = WorkflowTriggerSchema.parse({
      type: 'date_approaching',
      field: 'settlementDate',
      daysBefore: 7,
    });
    expect(result.type).toBe('date_approaching');
  });

  it('accepts form_submitted trigger', () => {
    const result = WorkflowTriggerSchema.parse({ type: 'form_submitted', formId: 'form-123' });
    expect(result.type).toBe('form_submitted');
  });

  it('rejects unknown trigger type', () => {
    expect(() =>
      WorkflowTriggerSchema.parse({ type: 'unknown' }),
    ).toThrow();
  });
});

// ─── WorkflowActionSchema ──────────────────────────────────────────

describe('WorkflowActionSchema', () => {
  it('accepts send_email action', () => {
    const result = WorkflowActionSchema.parse({ type: 'send_email', templateId: 'tpl-1' });
    expect(result.type).toBe('send_email');
  });

  it('accepts send_sms action', () => {
    const result = WorkflowActionSchema.parse({ type: 'send_sms', templateId: 'tpl-2' });
    expect(result.type).toBe('send_sms');
  });

  it('accepts create_task action', () => {
    const result = WorkflowActionSchema.parse({
      type: 'create_task',
      taskTitle: 'Follow up',
      taskType: 'call',
      dueDaysFromNow: 3,
    });
    expect(result.type).toBe('create_task');
  });

  it('accepts assign_contact action', () => {
    const result = WorkflowActionSchema.parse({
      type: 'assign_contact',
      agentId: uuid(),
    });
    expect(result.type).toBe('assign_contact');
  });

  it('accepts update_field action', () => {
    const result = WorkflowActionSchema.parse({
      type: 'update_field',
      field: 'tags',
      value: ['hot-lead'],
    });
    expect(result.type).toBe('update_field');
  });

  it('accepts add_tag action', () => {
    const result = WorkflowActionSchema.parse({ type: 'add_tag', tag: 'vip' });
    expect(result.type).toBe('add_tag');
  });

  it('accepts notify_agent action', () => {
    const result = WorkflowActionSchema.parse({
      type: 'notify_agent',
      message: 'New hot lead!',
    });
    expect(result.type).toBe('notify_agent');
  });

  it('accepts post_social action', () => {
    const result = WorkflowActionSchema.parse({
      type: 'post_social',
      platforms: ['facebook', 'instagram'],
      templateId: 'social-tpl-1',
    });
    expect(result.type).toBe('post_social');
  });

  it('accepts webhook action', () => {
    const result = WorkflowActionSchema.parse({
      type: 'webhook',
      url: 'https://hooks.example.com/notify',
      payload: { event: 'stage_change' },
    });
    expect(result.type).toBe('webhook');
  });

  it('accepts wait action', () => {
    const result = WorkflowActionSchema.parse({ type: 'wait', duration: '2h' });
    expect(result.type).toBe('wait');
  });

  it('accepts create_follow_up action', () => {
    const result = WorkflowActionSchema.parse({
      type: 'create_follow_up',
      daysFromNow: 7,
      taskType: 'call',
    });
    expect(result.type).toBe('create_follow_up');
  });

  it('rejects unknown action type', () => {
    expect(() =>
      WorkflowActionSchema.parse({ type: 'unknown' }),
    ).toThrow();
  });
});

// ─── WorkflowConditionSchema ───────────────────────────────────────

describe('WorkflowConditionSchema', () => {
  it('accepts valid condition', () => {
    const result = WorkflowConditionSchema.parse({
      field: 'leadScore',
      operator: 'greater_than',
      value: 75,
    });
    expect(result.operator).toBe('greater_than');
  });

  it('accepts all valid operators', () => {
    const operators = [
      'equals', 'not_equals', 'contains',
      'greater_than', 'less_than', 'is_empty', 'is_not_empty',
    ];
    for (const operator of operators) {
      const result = WorkflowConditionSchema.parse({ field: 'test', operator });
      expect(result.operator).toBe(operator);
    }
  });

  it('rejects invalid operator', () => {
    expect(() =>
      WorkflowConditionSchema.parse({ field: 'test', operator: 'matches' }),
    ).toThrow();
  });
});

// ─── WorkflowSchema ───────────────────────────────────────────────

describe('WorkflowSchema', () => {
  const validWorkflow = {
    id: uuid(),
    name: 'New Lead Auto-Assign',
    trigger: { type: 'new_lead' as const },
    conditions: [],
    actions: [{ type: 'assign_contact' as const, agentId: uuid() }],
    createdBy: uuid(),
    createdAt: now(),
    updatedAt: now(),
  };

  it('accepts a valid workflow', () => {
    const result = WorkflowSchema.parse(validWorkflow);
    expect(result.isActive).toBe(true);
    expect(result.name).toBe('New Lead Auto-Assign');
  });

  it('rejects empty name', () => {
    expect(() =>
      WorkflowSchema.parse({ ...validWorkflow, name: '' }),
    ).toThrow();
  });
});

// ─── WorkflowRunSchema ─────────────────────────────────────────────

describe('WorkflowRunSchema', () => {
  it('accepts a valid run', () => {
    const result = WorkflowRunSchema.parse({
      id: uuid(),
      workflowId: uuid(),
      status: 'running',
      currentActionIndex: 0,
      startedAt: now(),
    });
    expect(result.status).toBe('running');
  });

  it('accepts all run statuses', () => {
    for (const status of ['running', 'completed', 'failed', 'cancelled']) {
      expect(WorkflowRunStatusSchema.parse(status)).toBe(status);
    }
  });

  it('accepts optional contactId and transactionId', () => {
    const result = WorkflowRunSchema.parse({
      id: uuid(),
      workflowId: uuid(),
      contactId: uuid(),
      transactionId: uuid(),
      status: 'completed',
      currentActionIndex: 2,
      startedAt: now(),
      completedAt: now(),
    });
    expect(result.contactId).toBeDefined();
  });

  it('accepts optional error for failed runs', () => {
    const result = WorkflowRunSchema.parse({
      id: uuid(),
      workflowId: uuid(),
      status: 'failed',
      currentActionIndex: 1,
      error: 'Email template not found',
      startedAt: now(),
    });
    expect(result.error).toBe('Email template not found');
  });
});
