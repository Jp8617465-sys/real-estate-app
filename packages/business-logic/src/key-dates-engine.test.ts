import { describe, it, expect } from 'vitest';
import { KeyDatesEngine } from './key-dates-engine';
import type { ContractDetails } from './key-dates-engine';

// ─── Helpers ───────────────────────────────────────────────────────

// 2026-03-16 is a Monday — good base for business-day tests
const EXCHANGE = new Date('2026-03-16');
const SETTLEMENT = new Date('2026-06-15');

function makeContract(overrides: Partial<ContractDetails> = {}): ContractDetails {
  return {
    exchangeDate: EXCHANGE,
    settlementDate: SETTLEMENT,
    ...overrides,
  };
}

// ─── generateKeyDates ────────────────────────────────────────────

describe('KeyDatesEngine.generateKeyDates', () => {
  it('returns 7 key dates for a standard contract (NSW)', () => {
    const dates = KeyDatesEngine.generateKeyDates(makeContract(), 'NSW');
    expect(dates).toHaveLength(7);
  });

  it('dates are sorted chronologically', () => {
    const dates = KeyDatesEngine.generateKeyDates(makeContract(), 'NSW');
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]!.date.getTime()).toBeGreaterThanOrEqual(dates[i - 1]!.date.getTime());
    }
  });

  it('cooling-off uses state default when not specified', () => {
    const dates = KeyDatesEngine.generateKeyDates(makeContract(), 'NSW');
    const coolingOff = dates.find(d => d.label === 'Cooling-off period expires');
    expect(coolingOff).toBeDefined();
    // NSW default = 5 business days from Monday 2026-03-16
    // Tue(1), Wed(2), Thu(3), Fri(4), Mon(5) → 2026-03-23 (Monday)
    expect(coolingOff!.date).toEqual(new Date('2026-03-23'));
  });

  it('WA has no cooling-off (0 days, no cooling-off date generated)', () => {
    const dates = KeyDatesEngine.generateKeyDates(makeContract(), 'WA');
    const coolingOff = dates.find(d => d.label === 'Cooling-off period expires');
    expect(coolingOff).toBeUndefined();
    // 6 dates instead of 7 (no cooling-off)
    expect(dates).toHaveLength(6);
  });

  it('custom days override defaults', () => {
    const dates = KeyDatesEngine.generateKeyDates(
      makeContract({
        coolingOffDays: 10,
        financeApprovalDays: 28,
        buildingPestDays: 7,
        depositDueDays: 3,
      }),
      'NSW'
    );

    const coolingOff = dates.find(d => d.label === 'Cooling-off period expires');
    // 10 business days from Monday 2026-03-16:
    // Tue(1), Wed(2), Thu(3), Fri(4), Mon(5), Tue(6), Wed(7), Thu(8), Fri(9), Mon(10)
    // → 2026-03-30 (Monday)
    expect(coolingOff!.date).toEqual(new Date('2026-03-30'));

    const finance = dates.find(d => d.label === 'Finance approval deadline');
    // 28 calendar days from 2026-03-16 → 2026-04-13
    expect(finance!.date).toEqual(new Date('2026-04-13'));

    const bp = dates.find(d => d.label === 'Building & pest inspection due');
    // 7 calendar days from 2026-03-16 → 2026-03-23
    expect(bp!.date).toEqual(new Date('2026-03-23'));

    const deposit = dates.find(d => d.label === 'Deposit due');
    // 3 calendar days from 2026-03-16 → 2026-03-19
    expect(deposit!.date).toEqual(new Date('2026-03-19'));
  });
});

// ─── getDefaultCoolingOff ────────────────────────────────────────

describe('KeyDatesEngine.getDefaultCoolingOff', () => {
  it('QLD = 5', () => {
    expect(KeyDatesEngine.getDefaultCoolingOff('QLD')).toBe(5);
  });

  it('NSW = 5', () => {
    expect(KeyDatesEngine.getDefaultCoolingOff('NSW')).toBe(5);
  });

  it('VIC = 3', () => {
    expect(KeyDatesEngine.getDefaultCoolingOff('VIC')).toBe(3);
  });

  it('WA = 0', () => {
    expect(KeyDatesEngine.getDefaultCoolingOff('WA')).toBe(0);
  });

  it('unknown state = 0', () => {
    expect(KeyDatesEngine.getDefaultCoolingOff('XX')).toBe(0);
  });
});

// ─── getDateStatus ───────────────────────────────────────────────

describe('KeyDatesEngine.getDateStatus', () => {
  const today = new Date('2026-03-15');

  it('past date = overdue', () => {
    expect(KeyDatesEngine.getDateStatus(new Date('2026-03-10'), today)).toBe('overdue');
  });

  it('2 days from now = due_soon', () => {
    expect(KeyDatesEngine.getDateStatus(new Date('2026-03-17'), today)).toBe('due_soon');
  });

  it('10 days from now = upcoming', () => {
    expect(KeyDatesEngine.getDateStatus(new Date('2026-03-25'), today)).toBe('upcoming');
  });
});

// ─── shouldSendReminder ──────────────────────────────────────────

describe('KeyDatesEngine.shouldSendReminder', () => {
  it('7 days before with [7,3,1] returns 7', () => {
    const target = new Date('2026-03-22');
    const today = new Date('2026-03-15');
    expect(KeyDatesEngine.shouldSendReminder(target, [7, 3, 1], today)).toBe(7);
  });

  it('5 days before with [7,3,1] returns null', () => {
    const target = new Date('2026-03-20');
    const today = new Date('2026-03-15');
    expect(KeyDatesEngine.shouldSendReminder(target, [7, 3, 1], today)).toBeNull();
  });

  it('1 day before with [7,3,1] returns 1', () => {
    const target = new Date('2026-03-16');
    const today = new Date('2026-03-15');
    expect(KeyDatesEngine.shouldSendReminder(target, [7, 3, 1], today)).toBe(1);
  });
});

// ─── addDays / addBusinessDays ───────────────────────────────────

describe('KeyDatesEngine.addDays', () => {
  it('adds days correctly', () => {
    expect(KeyDatesEngine.addDays(new Date('2026-03-15'), 5)).toEqual(new Date('2026-03-20'));
  });
});

describe('KeyDatesEngine.addBusinessDays', () => {
  it('skips weekends (Friday + 2 business days = Tuesday)', () => {
    // 2026-03-20 is a Friday
    const result = KeyDatesEngine.addBusinessDays(new Date('2026-03-20'), 2);
    // Sat(skip), Sun(skip), Mon(1), Tue(2) → 2026-03-24 (Tuesday)
    expect(result).toEqual(new Date('2026-03-24'));
  });
});
