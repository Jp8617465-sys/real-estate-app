import { describe, it, expect } from 'vitest';
import { DuplicateDetector } from './duplicate-detection';
import type { Contact } from '@realflow/shared';

// ─── Helpers ───────────────────────────────────────────────────────

type ExistingContact = Pick<Contact, 'id' | 'phone' | 'email' | 'firstName' | 'lastName' | 'secondaryPhone'>;

function makeExisting(overrides: Partial<ExistingContact> & { id: string }): ExistingContact {
  return {
    phone: '0412345678',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Smith',
    secondaryPhone: undefined,
    ...overrides,
  };
}

// ─── normalizePhone ────────────────────────────────────────────────

describe('DuplicateDetector.normalizePhone', () => {
  it('returns 10-digit number starting with 0 for standard AU mobile', () => {
    expect(DuplicateDetector.normalizePhone('0412345678')).toBe('0412345678');
  });

  it('normalizes +61 prefix to 0', () => {
    expect(DuplicateDetector.normalizePhone('+61412345678')).toBe('0412345678');
  });

  it('normalizes 61 prefix without + to 0', () => {
    expect(DuplicateDetector.normalizePhone('61412345678')).toBe('0412345678');
  });

  it('strips spaces from formatted numbers', () => {
    expect(DuplicateDetector.normalizePhone('04 1234 5678')).toBe('0412345678');
  });

  it('strips dashes from formatted numbers', () => {
    expect(DuplicateDetector.normalizePhone('0412-345-678')).toBe('0412345678');
  });

  it('strips parentheses and spaces', () => {
    expect(DuplicateDetector.normalizePhone('(04) 1234 5678')).toBe('0412345678');
  });

  it('handles +61 with spaces', () => {
    expect(DuplicateDetector.normalizePhone('+61 412 345 678')).toBe('0412345678');
  });

  it('handles landline numbers starting with 02/03/07/08', () => {
    expect(DuplicateDetector.normalizePhone('0299990000')).toBe('0299990000');
  });

  it('handles landline with +61 prefix', () => {
    expect(DuplicateDetector.normalizePhone('+61299990000')).toBe('0299990000');
  });

  it('returns raw digits for non-standard length', () => {
    expect(DuplicateDetector.normalizePhone('123')).toBe('123');
  });
});

// ─── normalizeEmail ────────────────────────────────────────────────

describe('DuplicateDetector.normalizeEmail', () => {
  it('converts to lowercase', () => {
    expect(DuplicateDetector.normalizeEmail('John@Example.COM')).toBe('john@example.com');
  });

  it('trims whitespace', () => {
    expect(DuplicateDetector.normalizeEmail('  john@example.com  ')).toBe('john@example.com');
  });

  it('handles already normalized email', () => {
    expect(DuplicateDetector.normalizeEmail('john@example.com')).toBe('john@example.com');
  });
});

// ─── findDuplicates ────────────────────────────────────────────────

describe('DuplicateDetector.findDuplicates', () => {
  it('returns empty array when no existing contacts', () => {
    const result = DuplicateDetector.findDuplicates(
      { phone: '0412345678', email: 'john@example.com' },
      [],
    );
    expect(result).toEqual([]);
  });

  it('returns empty array when no matches', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0400000000', email: 'other@example.com', firstName: 'Jane', lastName: 'Doe' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { phone: '0412345678', email: 'john@example.com', firstName: 'John', lastName: 'Smith' },
      existing,
    );
    expect(result).toEqual([]);
  });

  it('detects phone match with score 50', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0412345678', email: 'other@example.com', firstName: 'Jane', lastName: 'Doe' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { phone: '0412345678' },
      existing,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBe(50);
    expect(result[0]!.matchedOn).toContain('phone');
  });

  it('detects phone match even with different formatting', () => {
    const existing = [
      makeExisting({ id: '1', phone: '+61412345678' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { phone: '04 1234 5678' },
      existing,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.matchedOn).toContain('phone');
  });

  it('detects secondary phone match with score 40', () => {
    const existing = [
      makeExisting({
        id: '1',
        phone: '0400000000',
        email: 'other@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        secondaryPhone: '0412345678',
      }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { phone: '0412345678' },
      existing,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBe(40);
    expect(result[0]!.matchedOn).toContain('secondary-phone');
  });

  it('detects email match with score 45', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0400000000', email: 'john@example.com', firstName: 'Jane', lastName: 'Doe' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { email: 'john@example.com' },
      existing,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBe(45);
    expect(result[0]!.matchedOn).toContain('email');
  });

  it('normalizes email for comparison (case-insensitive)', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0400000000', email: 'John@Example.COM', firstName: 'Jane', lastName: 'Doe' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { email: 'john@example.com' },
      existing,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.matchedOn).toContain('email');
  });

  it('detects name match with score 20', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0400000000', email: 'other@example.com', firstName: 'John', lastName: 'Smith' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { firstName: 'John', lastName: 'Smith' },
      existing,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBe(20);
    expect(result[0]!.matchedOn).toContain('name');
  });

  it('matches names case-insensitively', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0400000000', email: 'other@example.com', firstName: 'JOHN', lastName: 'SMITH' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { firstName: 'john', lastName: 'smith' },
      existing,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.matchedOn).toContain('name');
  });

  it('requires both first and last name for name match', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0400000000', email: 'other@example.com', firstName: 'John', lastName: 'Smith' }),
    ];
    // Only first name provided
    const result = DuplicateDetector.findDuplicates(
      { firstName: 'John' },
      existing,
    );
    expect(result).toEqual([]);
  });

  it('combines phone + email + name for highest score', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0412345678', email: 'john@example.com', firstName: 'John', lastName: 'Smith' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { phone: '0412345678', email: 'john@example.com', firstName: 'John', lastName: 'Smith' },
      existing,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBe(100); // 50 + 45 + 20 = 115, clamped to 100
    expect(result[0]!.matchedOn).toContain('phone');
    expect(result[0]!.matchedOn).toContain('email');
    expect(result[0]!.matchedOn).toContain('name');
  });

  it('sorts results by score descending', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0400000000', email: 'john@example.com', firstName: 'Jane', lastName: 'Doe' }),
      makeExisting({ id: '2', phone: '0412345678', email: 'other@example.com', firstName: 'Jane', lastName: 'Doe' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { phone: '0412345678', email: 'john@example.com' },
      existing,
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.score).toBeGreaterThanOrEqual(result[1]!.score);
  });

  it('caps combined score at 100', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0412345678', email: 'john@example.com', firstName: 'John', lastName: 'Smith', secondaryPhone: '0412345678' }),
    ];
    // phone (50) + secondary (40 - same number so also matches) + email (45) + name (20) = 155
    // but should be capped at 100
    const result = DuplicateDetector.findDuplicates(
      { phone: '0412345678', email: 'john@example.com', firstName: 'John', lastName: 'Smith' },
      existing,
    );
    expect(result[0]!.score).toBe(100);
  });

  it('handles multiple existing contacts with different match levels', () => {
    const existing = [
      makeExisting({ id: '1', phone: '0412345678', email: 'john@example.com', firstName: 'John', lastName: 'Smith' }),
      makeExisting({ id: '2', phone: '0400000000', email: 'john@example.com', firstName: 'Jane', lastName: 'Doe' }),
      makeExisting({ id: '3', phone: '0400000000', email: 'other@example.com', firstName: 'John', lastName: 'Smith' }),
    ];
    const result = DuplicateDetector.findDuplicates(
      { phone: '0412345678', email: 'john@example.com', firstName: 'John', lastName: 'Smith' },
      existing,
    );
    expect(result).toHaveLength(3);
    // First should be the full match (phone+email+name), capped at 100
    expect(result[0]!.contactId).toBe('1');
    expect(result[0]!.score).toBe(100);
  });
});

// ─── hasHighConfidenceDuplicate ────────────────────────────────────

describe('DuplicateDetector.hasHighConfidenceDuplicate', () => {
  it('returns false for empty matches', () => {
    expect(DuplicateDetector.hasHighConfidenceDuplicate([])).toBe(false);
  });

  it('returns true when a match meets default threshold of 80', () => {
    expect(
      DuplicateDetector.hasHighConfidenceDuplicate([
        { contactId: '1', score: 80, matchedOn: ['phone', 'name'] },
      ]),
    ).toBe(true);
  });

  it('returns false when all matches are below threshold', () => {
    expect(
      DuplicateDetector.hasHighConfidenceDuplicate([
        { contactId: '1', score: 50, matchedOn: ['phone'] },
        { contactId: '2', score: 45, matchedOn: ['email'] },
      ]),
    ).toBe(false);
  });

  it('accepts custom threshold', () => {
    expect(
      DuplicateDetector.hasHighConfidenceDuplicate(
        [{ contactId: '1', score: 50, matchedOn: ['phone'] }],
        50,
      ),
    ).toBe(true);
  });

  it('returns true when at least one match meets threshold', () => {
    expect(
      DuplicateDetector.hasHighConfidenceDuplicate([
        { contactId: '1', score: 20, matchedOn: ['name'] },
        { contactId: '2', score: 95, matchedOn: ['phone', 'email'] },
      ]),
    ).toBe(true);
  });
});
