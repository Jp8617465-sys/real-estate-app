import { describe, it, expect } from 'vitest';
import { DueDiligenceEngine } from './due-diligence-engine';

// ─── generateChecklist ───────────────────────────────────────────────

describe('DueDiligenceEngine.generateChecklist', () => {
  it('QLD + house: returns all non-strata items', () => {
    const checklist = DueDiligenceEngine.generateChecklist('QLD', 'house');
    expect(checklist).not.toBeNull();
    // 24 total QLD items minus 2 strata-only items (body corp records, strata inspection)
    expect(checklist!.items).toHaveLength(22);
    expect(checklist!.state).toBe('QLD');
    expect(checklist!.propertyType).toBe('house');

    // Should NOT include strata-only items
    const names = checklist!.items.map(i => i.name);
    expect(names).not.toContain('Body corporate records obtained');
    expect(names).not.toContain('Strata inspection report');

    // Should include QLD-specific items
    expect(names).toContain('Seller disclosure statement reviewed');
    expect(names).toContain('Pool safety certificate verified');
  });

  it('QLD + unit: returns all items including strata-specific', () => {
    const checklist = DueDiligenceEngine.generateChecklist('QLD', 'unit');
    expect(checklist).not.toBeNull();
    // All 24 QLD items apply to units
    expect(checklist!.items).toHaveLength(24);

    const names = checklist!.items.map(i => i.name);
    expect(names).toContain('Body corporate records obtained');
    expect(names).toContain('Strata inspection report');
  });

  it('QLD + land: excludes building and pest inspection items', () => {
    const checklist = DueDiligenceEngine.generateChecklist('QLD', 'land');
    expect(checklist).not.toBeNull();
    // 24 total minus 2 excludeFrom land (building, pest) minus 2 applicableTo strata-only
    expect(checklist!.items).toHaveLength(20);

    const names = checklist!.items.map(i => i.name);
    expect(names).not.toContain('Building inspection completed');
    expect(names).not.toContain('Pest/termite inspection completed');
    expect(names).not.toContain('Body corporate records obtained');
    expect(names).not.toContain('Strata inspection report');
  });

  it('NSW returns different items than QLD (s66W certificate, no seller disclosure)', () => {
    const nswChecklist = DueDiligenceEngine.generateChecklist('NSW', 'house');
    const qldChecklist = DueDiligenceEngine.generateChecklist('QLD', 'house');
    expect(nswChecklist).not.toBeNull();
    expect(qldChecklist).not.toBeNull();

    const nswNames = nswChecklist!.items.map(i => i.name);
    const qldNames = qldChecklist!.items.map(i => i.name);

    // NSW has s66W certificate, QLD does not
    expect(nswNames).toContain('s66W certificate exchange');
    expect(qldNames).not.toContain('s66W certificate exchange');

    // QLD has seller disclosure statement, NSW does not
    expect(qldNames).toContain('Seller disclosure statement reviewed');
    expect(nswNames).not.toContain('Seller disclosure statement reviewed');
  });

  it('VIC returns Section 32 vendor statement review item', () => {
    const checklist = DueDiligenceEngine.generateChecklist('VIC', 'house');
    expect(checklist).not.toBeNull();

    const names = checklist!.items.map(i => i.name);
    expect(names).toContain('Section 32 vendor statement reviewed');
  });

  it('unsupported state returns null', () => {
    expect(DueDiligenceEngine.generateChecklist('WA', 'house')).toBeNull();
    expect(DueDiligenceEngine.generateChecklist('SA', 'unit')).toBeNull();
    expect(DueDiligenceEngine.generateChecklist('INVALID', 'house')).toBeNull();
  });

  it('items are sorted by sortOrder', () => {
    const checklist = DueDiligenceEngine.generateChecklist('QLD', 'house');
    expect(checklist).not.toBeNull();

    for (let i = 0; i < checklist!.items.length; i++) {
      expect(checklist!.items[i]!.sortOrder).toBe(i);
    }
  });

  it('handles case-insensitive state codes', () => {
    const lower = DueDiligenceEngine.generateChecklist('qld', 'house');
    const upper = DueDiligenceEngine.generateChecklist('QLD', 'house');
    const mixed = DueDiligenceEngine.generateChecklist('Qld', 'house');

    expect(lower).not.toBeNull();
    expect(upper).not.toBeNull();
    expect(mixed).not.toBeNull();
    expect(lower!.items).toHaveLength(upper!.items.length);
    expect(mixed!.items).toHaveLength(upper!.items.length);
  });
});

// ─── calculateCompletion ─────────────────────────────────────────────

describe('DueDiligenceEngine.calculateCompletion', () => {
  it('all not_started returns 0%', () => {
    expect(DueDiligenceEngine.calculateCompletion([
      'not_started', 'not_started', 'not_started',
    ])).toBe(0);
  });

  it('all completed returns 100%', () => {
    expect(DueDiligenceEngine.calculateCompletion([
      'completed', 'completed', 'completed',
    ])).toBe(100);
  });

  it('mix of statuses calculates correctly', () => {
    // 2 out of 4 completed = 50%
    expect(DueDiligenceEngine.calculateCompletion([
      'completed', 'completed', 'not_started', 'in_progress',
    ])).toBe(50);
  });

  it('not_applicable counts as complete', () => {
    // 1 completed + 1 not_applicable = 2/3 = 67%
    expect(DueDiligenceEngine.calculateCompletion([
      'completed', 'not_applicable', 'not_started',
    ])).toBe(67);
  });

  it('empty array returns 0%', () => {
    expect(DueDiligenceEngine.calculateCompletion([])).toBe(0);
  });
});

// ─── hasBlockingIssues ───────────────────────────────────────────────

describe('DueDiligenceEngine.hasBlockingIssues', () => {
  it('returns true when blocking item has issue_found', () => {
    expect(DueDiligenceEngine.hasBlockingIssues([
      { isBlocking: true, status: 'issue_found' },
      { isBlocking: false, status: 'completed' },
    ])).toBe(true);
  });

  it('returns false when non-blocking item has issue_found', () => {
    expect(DueDiligenceEngine.hasBlockingIssues([
      { isBlocking: false, status: 'issue_found' },
      { isBlocking: true, status: 'completed' },
    ])).toBe(false);
  });

  it('returns false when all items are completed', () => {
    expect(DueDiligenceEngine.hasBlockingIssues([
      { isBlocking: true, status: 'completed' },
      { isBlocking: true, status: 'completed' },
      { isBlocking: false, status: 'completed' },
    ])).toBe(false);
  });
});

// ─── getSupportedStates ──────────────────────────────────────────────

describe('DueDiligenceEngine.getSupportedStates', () => {
  it('returns QLD, NSW, and VIC', () => {
    const states = DueDiligenceEngine.getSupportedStates();
    expect(states).toContain('QLD');
    expect(states).toContain('NSW');
    expect(states).toContain('VIC');
    expect(states).toHaveLength(3);
  });
});

// ─── getStatusSummary ────────────────────────────────────────────────

describe('DueDiligenceEngine.getStatusSummary', () => {
  it('counts statuses correctly', () => {
    const summary = DueDiligenceEngine.getStatusSummary([
      { status: 'not_started' },
      { status: 'not_started' },
      { status: 'in_progress' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'issue_found' },
    ]);

    expect(summary).toEqual({
      not_started: 2,
      in_progress: 1,
      completed: 3,
      issue_found: 1,
    });
  });

  it('returns empty object for empty input', () => {
    expect(DueDiligenceEngine.getStatusSummary([])).toEqual({});
  });
});
