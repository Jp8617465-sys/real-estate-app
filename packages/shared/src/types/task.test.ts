import { describe, it, expect } from 'vitest';
import {
  TaskPrioritySchema,
  TaskStatusSchema,
  TaskTypeSchema,
  TaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
} from './task';

const uuid = () => '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();

// ─── TaskPrioritySchema ────────────────────────────────────────────

describe('TaskPrioritySchema', () => {
  it('accepts all valid priorities', () => {
    for (const p of ['low', 'medium', 'high', 'urgent']) {
      expect(TaskPrioritySchema.parse(p)).toBe(p);
    }
  });

  it('rejects invalid priority', () => {
    expect(() => TaskPrioritySchema.parse('critical')).toThrow();
  });
});

// ─── TaskStatusSchema ──────────────────────────────────────────────

describe('TaskStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const s of ['pending', 'in-progress', 'completed', 'cancelled']) {
      expect(TaskStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects invalid status', () => {
    expect(() => TaskStatusSchema.parse('done')).toThrow();
  });
});

// ─── TaskTypeSchema ────────────────────────────────────────────────

describe('TaskTypeSchema', () => {
  const validTypes = [
    'call', 'email', 'sms', 'meeting', 'inspection',
    'follow-up', 'document-review', 'appraisal',
    'listing-preparation', 'marketing', 'open-home',
    'auction-prep', 'settlement-task', 'general',
  ];

  it('accepts all valid task types', () => {
    for (const type of validTypes) {
      expect(TaskTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid type', () => {
    expect(() => TaskTypeSchema.parse('handshake')).toThrow();
  });
});

// ─── TaskSchema ────────────────────────────────────────────────────

describe('TaskSchema', () => {
  const validTask = {
    id: uuid(),
    title: 'Follow up with John',
    type: 'follow-up' as const,
    assignedTo: uuid(),
    dueDate: now(),
    createdBy: uuid(),
    createdAt: now(),
    updatedAt: now(),
  };

  it('accepts a valid task with defaults', () => {
    const result = TaskSchema.parse(validTask);
    expect(result.priority).toBe('medium');
    expect(result.status).toBe('pending');
    expect(result.isAutomated).toBe(false);
  });

  it('accepts optional relationship fields', () => {
    const result = TaskSchema.parse({
      ...validTask,
      contactId: uuid(),
      propertyId: uuid(),
      transactionId: uuid(),
    });
    expect(result.contactId).toBeDefined();
  });

  it('accepts optional scheduling fields', () => {
    const result = TaskSchema.parse({
      ...validTask,
      completedAt: now(),
      reminderAt: now(),
    });
    expect(result.completedAt).toBeDefined();
    expect(result.reminderAt).toBeDefined();
  });

  it('accepts workflow linkage', () => {
    const result = TaskSchema.parse({
      ...validTask,
      workflowId: uuid(),
      isAutomated: true,
    });
    expect(result.workflowId).toBeDefined();
    expect(result.isAutomated).toBe(true);
  });

  it('rejects empty title', () => {
    expect(() =>
      TaskSchema.parse({ ...validTask, title: '' }),
    ).toThrow();
  });
});

// ─── CreateTaskSchema ──────────────────────────────────────────────

describe('CreateTaskSchema', () => {
  it('omits id, createdAt, updatedAt, completedAt', () => {
    const result = CreateTaskSchema.parse({
      title: 'New task',
      type: 'call',
      assignedTo: uuid(),
      dueDate: now(),
      createdBy: uuid(),
    });
    expect(result.title).toBe('New task');
    expect((result as Record<string, unknown>).id).toBeUndefined();
  });
});

// ─── UpdateTaskSchema ──────────────────────────────────────────────

describe('UpdateTaskSchema', () => {
  it('accepts partial updates', () => {
    const result = UpdateTaskSchema.parse({ priority: 'urgent' });
    expect(result.priority).toBe('urgent');
  });

  it('accepts an empty object', () => {
    const result = UpdateTaskSchema.parse({});
    expect(result).toEqual({});
  });
});
