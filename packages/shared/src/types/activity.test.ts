import { describe, it, expect } from 'vitest';
import {
  ActivityTypeSchema,
  ActivitySchema,
  CreateActivitySchema,
  NoteSchema,
  CreateNoteSchema,
} from './activity';

const uuid = () => '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();

// ─── ActivityTypeSchema ────────────────────────────────────────────

describe('ActivityTypeSchema', () => {
  const validTypes = [
    'call', 'email-sent', 'email-received', 'sms-sent', 'sms-received',
    'meeting', 'inspection', 'open-home', 'property-sent', 'note-added',
    'stage-change', 'task-completed', 'document-uploaded',
    'offer-submitted', 'contract-exchanged', 'settlement-completed',
    'social-dm-sent', 'social-dm-received', 'system',
  ];

  it('accepts all valid activity types', () => {
    for (const type of validTypes) {
      expect(ActivityTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid activity type', () => {
    expect(() => ActivityTypeSchema.parse('fax')).toThrow();
  });
});

// ─── ActivitySchema ────────────────────────────────────────────────

describe('ActivitySchema', () => {
  const validActivity = {
    id: uuid(),
    contactId: uuid(),
    type: 'call' as const,
    title: 'Follow-up call',
    createdBy: uuid(),
    createdAt: now(),
  };

  it('accepts a minimal valid activity', () => {
    const result = ActivitySchema.parse(validActivity);
    expect(result.type).toBe('call');
    expect(result.title).toBe('Follow-up call');
  });

  it('accepts optional relationships', () => {
    const result = ActivitySchema.parse({
      ...validActivity,
      transactionId: uuid(),
      propertyId: uuid(),
    });
    expect(result.transactionId).toBeDefined();
    expect(result.propertyId).toBeDefined();
  });

  it('accepts optional description and metadata', () => {
    const result = ActivitySchema.parse({
      ...validActivity,
      description: 'Discussed budget and timeline',
      metadata: { duration: 300, outcome: 'positive' },
    });
    expect(result.description).toBe('Discussed budget and timeline');
    expect(result.metadata).toEqual({ duration: 300, outcome: 'positive' });
  });
});

// ─── CreateActivitySchema ──────────────────────────────────────────

describe('CreateActivitySchema', () => {
  it('omits id and createdAt', () => {
    const result = CreateActivitySchema.parse({
      contactId: uuid(),
      type: 'email-sent',
      title: 'Sent property list',
      createdBy: uuid(),
    });
    expect(result.type).toBe('email-sent');
    expect((result as Record<string, unknown>).id).toBeUndefined();
    expect((result as Record<string, unknown>).createdAt).toBeUndefined();
  });
});

// ─── NoteSchema ────────────────────────────────────────────────────

describe('NoteSchema', () => {
  const validNote = {
    id: uuid(),
    contactId: uuid(),
    content: 'Buyer interested in 3-bedroom properties in Paddington.',
    createdBy: uuid(),
    createdAt: now(),
    updatedAt: now(),
  };

  it('accepts a valid note', () => {
    const result = NoteSchema.parse(validNote);
    expect(result.isPinned).toBe(false);
  });

  it('accepts pinned notes', () => {
    const result = NoteSchema.parse({ ...validNote, isPinned: true });
    expect(result.isPinned).toBe(true);
  });

  it('rejects empty content', () => {
    expect(() =>
      NoteSchema.parse({ ...validNote, content: '' }),
    ).toThrow();
  });

  it('accepts optional property and transaction IDs', () => {
    const result = NoteSchema.parse({
      ...validNote,
      propertyId: uuid(),
      transactionId: uuid(),
    });
    expect(result.propertyId).toBeDefined();
    expect(result.transactionId).toBeDefined();
  });
});

// ─── CreateNoteSchema ──────────────────────────────────────────────

describe('CreateNoteSchema', () => {
  it('omits id, createdAt, updatedAt', () => {
    const result = CreateNoteSchema.parse({
      contactId: uuid(),
      content: 'Follow up next week',
      createdBy: uuid(),
    });
    expect(result.content).toBe('Follow up next week');
    expect((result as Record<string, unknown>).id).toBeUndefined();
  });
});
