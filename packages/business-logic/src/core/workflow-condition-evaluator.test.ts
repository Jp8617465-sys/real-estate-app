import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evaluateFieldCondition,
  evaluateConditionNode,
  evaluateConditionNodes,
} from './workflow-condition-evaluator';
import type { WorkflowContext } from './workflow-engine';
import type { WorkflowCondition, CompoundCondition } from '@realflow/shared';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeContext(entityData: Record<string, unknown>): WorkflowContext {
  return {
    entityData,
    supabase: {} as WorkflowContext['supabase'],
  };
}

function makeCondition(
  field: string,
  operator: WorkflowCondition['operator'],
  value?: unknown,
): WorkflowCondition {
  return { field, operator, value } as WorkflowCondition;
}

// ─── evaluateFieldCondition — equals / not_equals ────────────────────────────

describe('evaluateFieldCondition — equals / not_equals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when field equals the condition value', () => {
    const ctx = makeContext({ status: 'active' });
    const condition = makeCondition('status', 'equals', 'active');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false when field does not equal the condition value', () => {
    const ctx = makeContext({ status: 'inactive' });
    const condition = makeCondition('status', 'equals', 'active');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns true for not_equals when field differs', () => {
    const ctx = makeContext({ status: 'inactive' });
    const condition = makeCondition('status', 'not_equals', 'active');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false for not_equals when field matches', () => {
    const ctx = makeContext({ status: 'active' });
    const condition = makeCondition('status', 'not_equals', 'active');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });
});

// ─── evaluateFieldCondition — contains / starts_with ─────────────────────────

describe('evaluateFieldCondition — contains / starts_with', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when field string contains the value substring', () => {
    const ctx = makeContext({ notes: 'Looking for a family home in Sydney' });
    const condition = makeCondition('notes', 'contains', 'Sydney');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false when field does not contain the value', () => {
    const ctx = makeContext({ notes: 'Looking for a home in Melbourne' });
    const condition = makeCondition('notes', 'contains', 'Sydney');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns true when field starts with the value', () => {
    const ctx = makeContext({ email: 'agent@realflow.com.au' });
    const condition = makeCondition('email', 'starts_with', 'agent@');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false when field does not start with the value', () => {
    const ctx = makeContext({ email: 'buyer@gmail.com' });
    const condition = makeCondition('email', 'starts_with', 'agent@');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });
});

// ─── evaluateFieldCondition — greater_than / less_than ───────────────────────

describe('evaluateFieldCondition — greater_than / less_than', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when numeric field is greater than condition value', () => {
    const ctx = makeContext({ leadScore: 75 });
    const condition = makeCondition('leadScore', 'greater_than', 50);
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false when numeric field equals condition value (not strictly greater)', () => {
    const ctx = makeContext({ leadScore: 50 });
    const condition = makeCondition('leadScore', 'greater_than', 50);
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns true when numeric field is less than condition value', () => {
    const ctx = makeContext({ leadScore: 30 });
    const condition = makeCondition('leadScore', 'less_than', 50);
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false when numeric field equals condition value (not strictly less)', () => {
    const ctx = makeContext({ leadScore: 50 });
    const condition = makeCondition('leadScore', 'less_than', 50);
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('coerces string numbers to numeric for comparison', () => {
    const ctx = makeContext({ budget: '1500000' });
    const condition = makeCondition('budget', 'greater_than', 1000000);
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });
});

// ─── evaluateFieldCondition — is_empty / is_not_empty ────────────────────────

describe('evaluateFieldCondition — is_empty / is_not_empty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for is_empty when field is null', () => {
    const ctx = makeContext({ notes: null });
    const condition = makeCondition('notes', 'is_empty');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns true for is_empty when field is undefined', () => {
    const ctx = makeContext({});
    const condition = makeCondition('missingField', 'is_empty');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns true for is_empty when field is empty string', () => {
    const ctx = makeContext({ notes: '' });
    const condition = makeCondition('notes', 'is_empty');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns true for is_not_empty when field has a value', () => {
    const ctx = makeContext({ notes: 'Has content' });
    const condition = makeCondition('notes', 'is_not_empty');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false for is_not_empty when field is null', () => {
    const ctx = makeContext({ notes: null });
    const condition = makeCondition('notes', 'is_not_empty');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });
});

// ─── evaluateFieldCondition — date operators ──────────────────────────────────

describe('evaluateFieldCondition — before / after / within_days', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for "before" when field date is earlier than condition date', () => {
    const ctx = makeContext({ createdAt: '2024-01-01T00:00:00.000Z' });
    const condition = makeCondition('createdAt', 'before', '2025-01-01T00:00:00.000Z');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false for "before" when field date is later than condition date', () => {
    const ctx = makeContext({ createdAt: '2026-01-01T00:00:00.000Z' });
    const condition = makeCondition('createdAt', 'before', '2025-01-01T00:00:00.000Z');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns true for "after" when field date is later than condition date', () => {
    const ctx = makeContext({ createdAt: '2026-01-01T00:00:00.000Z' });
    const condition = makeCondition('createdAt', 'after', '2025-01-01T00:00:00.000Z');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false for "before" when either date is invalid', () => {
    const ctx = makeContext({ createdAt: 'not-a-date' });
    const condition = makeCondition('createdAt', 'before', '2025-01-01T00:00:00.000Z');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns true for "within_days" when field date is within the specified window', () => {
    // Date 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = makeContext({ lastContactedAt: twoDaysAgo });
    const condition = makeCondition('lastContactedAt', 'within_days', 7);
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false for "within_days" when field date is outside the window', () => {
    // Date 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = makeContext({ lastContactedAt: thirtyDaysAgo });
    const condition = makeCondition('lastContactedAt', 'within_days', 7);
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });
});

// ─── evaluateFieldCondition — contact-specific operators ─────────────────────

describe('evaluateFieldCondition — has_tag / in_stage / lead_score_above', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for has_tag when array contains the tag', () => {
    const ctx = makeContext({ tags: ['hot-lead', 'auction', 'ready-to-buy'] });
    const condition = makeCondition('tags', 'has_tag', 'hot-lead');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false for has_tag when array does not contain the tag', () => {
    const ctx = makeContext({ tags: ['auction'] });
    const condition = makeCondition('tags', 'has_tag', 'cold-lead');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns false for has_tag when field is not an array', () => {
    const ctx = makeContext({ tags: 'hot-lead' });
    const condition = makeCondition('tags', 'has_tag', 'hot-lead');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns true for in_stage when field matches a string stage', () => {
    const ctx = makeContext({ stage: 'property_search' });
    const condition = makeCondition('stage', 'in_stage', 'property_search');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns true for in_stage when field is included in an array of stages', () => {
    const ctx = makeContext({ stage: 'offer_submitted' });
    const condition = makeCondition('stage', 'in_stage', ['offer_submitted', 'due_diligence']);
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns true for lead_score_above when score exceeds threshold', () => {
    const ctx = makeContext({ leadScore: 85 });
    const condition = makeCondition('leadScore', 'lead_score_above', 70);
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });
});

// ─── evaluateFieldCondition — property-specific operators ────────────────────

describe('evaluateFieldCondition — price_range / suburb_match / days_on_market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for price_range when price is within min and max', () => {
    const ctx = makeContext({ price: 1200000 });
    const condition = makeCondition('price', 'price_range', { min: 1000000, max: 1500000 });
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns false for price_range when price is below min', () => {
    const ctx = makeContext({ price: 900000 });
    const condition = makeCondition('price', 'price_range', { min: 1000000, max: 1500000 });
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns false for price_range when price is above max', () => {
    const ctx = makeContext({ price: 2000000 });
    const condition = makeCondition('price', 'price_range', { min: 1000000, max: 1500000 });
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns true for suburb_match with a matching string (case-insensitive)', () => {
    const ctx = makeContext({ suburb: 'Surry Hills' });
    const condition = makeCondition('suburb', 'suburb_match', 'surry hills');
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns true for suburb_match when suburb is in the allowed array', () => {
    const ctx = makeContext({ suburb: 'Glebe' });
    const condition = makeCondition('suburb', 'suburb_match', ['Newtown', 'Glebe', 'Annandale']);
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns true for days_on_market when listed date is within the range', () => {
    // Listed 20 days ago
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = makeContext({ listedAt: twentyDaysAgo });
    const condition = makeCondition('listedAt', 'days_on_market', { min: 10, max: 30 });
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });
});

// ─── evaluateFieldCondition — nested dot-path field access ───────────────────

describe('evaluateFieldCondition — nested field access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a nested field via dot notation', () => {
    const ctx = makeContext({ contact: { leadScore: 88 } });
    const condition = makeCondition('contact.leadScore', 'greater_than', 80);
    expect(evaluateFieldCondition(condition, ctx)).toBe(true);
  });

  it('returns undefined (falsy) for a deeply nested missing path', () => {
    const ctx = makeContext({ contact: {} });
    const condition = makeCondition('contact.address.suburb', 'equals', 'Newtown');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });

  it('returns false for an unknown operator rather than throwing', () => {
    const ctx = makeContext({ status: 'active' });
    const condition = makeCondition('status', 'unknown_op' as never, 'active');
    expect(evaluateFieldCondition(condition, ctx)).toBe(false);
  });
});

// ─── evaluateConditionNode — AND / OR / NOT ───────────────────────────────────

describe('evaluateConditionNode — compound AND/OR/NOT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AND returns true when all child conditions are true', () => {
    const ctx = makeContext({ leadScore: 90, stage: 'offer_submitted' });
    const node: CompoundCondition = {
      logic: 'AND',
      conditions: [
        makeCondition('leadScore', 'greater_than', 70),
        makeCondition('stage', 'equals', 'offer_submitted'),
      ],
    };
    expect(evaluateConditionNode(node, ctx)).toBe(true);
  });

  it('AND returns false when at least one child condition is false', () => {
    const ctx = makeContext({ leadScore: 40, stage: 'offer_submitted' });
    const node: CompoundCondition = {
      logic: 'AND',
      conditions: [
        makeCondition('leadScore', 'greater_than', 70),
        makeCondition('stage', 'equals', 'offer_submitted'),
      ],
    };
    expect(evaluateConditionNode(node, ctx)).toBe(false);
  });

  it('OR returns true when at least one child condition is true', () => {
    const ctx = makeContext({ leadScore: 40, stage: 'offer_submitted' });
    const node: CompoundCondition = {
      logic: 'OR',
      conditions: [
        makeCondition('leadScore', 'greater_than', 70), // false
        makeCondition('stage', 'equals', 'offer_submitted'), // true
      ],
    };
    expect(evaluateConditionNode(node, ctx)).toBe(true);
  });

  it('OR returns false when all child conditions are false', () => {
    const ctx = makeContext({ leadScore: 40, stage: 'initial_enquiry' });
    const node: CompoundCondition = {
      logic: 'OR',
      conditions: [
        makeCondition('leadScore', 'greater_than', 70),
        makeCondition('stage', 'equals', 'offer_submitted'),
      ],
    };
    expect(evaluateConditionNode(node, ctx)).toBe(false);
  });

  it('NOT inverts a true child condition to false', () => {
    const ctx = makeContext({ status: 'active' });
    const node: CompoundCondition = {
      logic: 'NOT',
      condition: makeCondition('status', 'equals', 'active'),
    };
    expect(evaluateConditionNode(node, ctx)).toBe(false);
  });

  it('NOT inverts a false child condition to true', () => {
    const ctx = makeContext({ status: 'inactive' });
    const node: CompoundCondition = {
      logic: 'NOT',
      condition: makeCondition('status', 'equals', 'active'),
    };
    expect(evaluateConditionNode(node, ctx)).toBe(true);
  });
});

// ─── evaluateConditionNode — nested compound ──────────────────────────────────

describe('evaluateConditionNode — nested compound conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evaluates nested AND inside OR correctly', () => {
    // (leadScore > 70 AND stage == "offer_submitted") OR tags has "vip"
    const ctx = makeContext({ leadScore: 80, stage: 'offer_submitted', tags: ['regular'] });
    const node: CompoundCondition = {
      logic: 'OR',
      conditions: [
        {
          logic: 'AND',
          conditions: [
            makeCondition('leadScore', 'greater_than', 70),
            makeCondition('stage', 'equals', 'offer_submitted'),
          ],
        },
        makeCondition('tags', 'has_tag', 'vip'),
      ],
    };
    expect(evaluateConditionNode(node, ctx)).toBe(true);
  });

  it('evaluates NOT wrapping an AND compound', () => {
    // NOT (leadScore > 70 AND stage == "offer_submitted") → false when both true
    const ctx = makeContext({ leadScore: 80, stage: 'offer_submitted' });
    const node: CompoundCondition = {
      logic: 'NOT',
      condition: {
        logic: 'AND',
        conditions: [
          makeCondition('leadScore', 'greater_than', 70),
          makeCondition('stage', 'equals', 'offer_submitted'),
        ],
      },
    };
    expect(evaluateConditionNode(node, ctx)).toBe(false);
  });
});

// ─── evaluateConditionNodes — array AND semantics ─────────────────────────────

describe('evaluateConditionNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for an empty conditions array', () => {
    const ctx = makeContext({});
    expect(evaluateConditionNodes([], ctx)).toBe(true);
  });

  it('returns true when all conditions in the array pass', () => {
    const ctx = makeContext({ leadScore: 90, stage: 'active' });
    const conditions = [
      makeCondition('leadScore', 'greater_than', 70),
      makeCondition('stage', 'equals', 'active'),
    ];
    expect(evaluateConditionNodes(conditions, ctx)).toBe(true);
  });

  it('returns false when any condition in the array fails', () => {
    const ctx = makeContext({ leadScore: 50, stage: 'active' });
    const conditions = [
      makeCondition('leadScore', 'greater_than', 70),
      makeCondition('stage', 'equals', 'active'),
    ];
    expect(evaluateConditionNodes(conditions, ctx)).toBe(false);
  });
});
