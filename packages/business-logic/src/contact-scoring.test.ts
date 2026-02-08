import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContactScoring } from './contact-scoring';
import type { Contact, Activity } from '@realflow/shared';

// ─── Helpers ───────────────────────────────────────────────────────

const uuid = () => '00000000-0000-0000-0000-000000000001';

// Base contact has phone which gives +5 (hasPhone weight).
// Tests account for this baseline.
const PHONE_BASELINE = 5;

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: uuid(),
    types: ['buyer'],
    firstName: 'John',
    lastName: 'Smith',
    phone: '0412345678',
    source: 'domain',
    assignedAgentId: uuid(),
    tags: [],
    communicationPreference: 'any',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: uuid(),
    contactId: uuid(),
    type: 'call',
    title: 'Test activity',
    createdBy: uuid(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── calculateScore ────────────────────────────────────────────────

describe('ContactScoring.calculateScore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scores phone presence at 5 points', () => {
    const contact = makeContact();
    const score = ContactScoring.calculateScore(contact, []);
    expect(score).toBe(PHONE_BASELINE); // phone(5)
  });

  it('adds 5 points for having email on top of phone', () => {
    const contact = makeContact({ email: 'john@example.com' });
    const score = ContactScoring.calculateScore(contact, []);
    expect(score).toBe(PHONE_BASELINE + 5); // phone(5) + email(5)
  });

  it('adds 20 points for pre-approval', () => {
    const contact = makeContact({
      email: 'john@example.com',
      buyerProfile: {
        budgetMin: 500000,
        budgetMax: 800000,
        preApproved: true,
        propertyTypes: ['house'],
        bedrooms: { min: 3 },
        bathrooms: { min: 2 },
        carSpaces: { min: 1 },
        suburbs: ['Paddington'],
        mustHaves: [],
        dealBreakers: [],
      },
    });
    const score = ContactScoring.calculateScore(contact, []);
    expect(score).toBe(30); // phone(5) + email(5) + preApproval(20)
  });

  it('scores inspection activities at 15 points each', () => {
    const contact = makeContact();
    const activities = [
      makeActivity({ type: 'inspection', createdAt: daysAgo(5) }),
    ];
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(PHONE_BASELINE + 15); // phone(5) + inspection(15)
  });

  it('scores open-home activities at 15 points', () => {
    const contact = makeContact();
    const activities = [
      makeActivity({ type: 'open-home', createdAt: daysAgo(2) }),
    ];
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(PHONE_BASELINE + 15);
  });

  it('scores email activities at 3 points each', () => {
    const contact = makeContact();
    const activities = [
      makeActivity({ type: 'email-sent', createdAt: daysAgo(1) }),
      makeActivity({ type: 'email-received', createdAt: daysAgo(2) }),
    ];
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(PHONE_BASELINE + 6); // phone(5) + 3 + 3
  });

  it('scores call activities at 5 points each', () => {
    const contact = makeContact();
    const activities = [
      makeActivity({ type: 'call', createdAt: daysAgo(3) }),
    ];
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(PHONE_BASELINE + 5); // phone(5) + call(5)
  });

  it('scores generic activities at 10 points (recentActivity weight)', () => {
    const contact = makeContact();
    const activities = [
      makeActivity({ type: 'meeting', createdAt: daysAgo(5) }),
    ];
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(PHONE_BASELINE + 10); // phone(5) + meeting(10)
  });

  it('ignores activities older than 30 days', () => {
    const contact = makeContact();
    const activities = [
      makeActivity({ type: 'inspection', createdAt: daysAgo(31) }),
    ];
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(PHONE_BASELINE); // only phone baseline
  });

  it('includes activities exactly 30 days old', () => {
    const contact = makeContact();
    const activities = [
      makeActivity({ type: 'call', createdAt: daysAgo(30) }),
    ];
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(PHONE_BASELINE + 5); // phone(5) + call(5)
  });

  it('applies recency penalty based on lastContactDate', () => {
    const contact = makeContact({ lastContactDate: daysAgo(10) });
    // phone(5) + 10 days * -2 = 5 - 20 = -15, clamped to 0
    const score = ContactScoring.calculateScore(contact, []);
    expect(score).toBe(0);
  });

  it('combines profile, activity, and recency scoring', () => {
    const contact = makeContact({
      email: 'john@example.com',
      phone: '0412345678',
      lastContactDate: daysAgo(3),
      buyerProfile: {
        budgetMin: 500000,
        budgetMax: 800000,
        preApproved: true,
        propertyTypes: ['house'],
        bedrooms: { min: 3 },
        bathrooms: { min: 2 },
        carSpaces: { min: 1 },
        suburbs: ['Paddington'],
        mustHaves: [],
        dealBreakers: [],
      },
    });
    const activities = [
      makeActivity({ type: 'inspection', createdAt: daysAgo(2) }),
      makeActivity({ type: 'call', createdAt: daysAgo(1) }),
    ];
    // phone(5) + email(5) + preApproval(20) + inspection(15) + call(5) + lastContact(3 * -2 = -6) = 44
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(44);
  });

  it('clamps score to max 100', () => {
    const contact = makeContact({
      email: 'john@example.com',
      phone: '0412345678',
      buyerProfile: {
        budgetMin: 500000,
        budgetMax: 800000,
        preApproved: true,
        propertyTypes: ['house'],
        bedrooms: { min: 3 },
        bathrooms: { min: 2 },
        carSpaces: { min: 1 },
        suburbs: ['Paddington'],
        mustHaves: [],
        dealBreakers: [],
      },
    });
    // Lots of high-scoring activities to exceed 100
    const activities = Array.from({ length: 10 }, (_, i) =>
      makeActivity({ type: 'inspection', createdAt: daysAgo(i + 1) }),
    );
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(100);
  });

  it('clamps score to min 0', () => {
    const contact = makeContact({ lastContactDate: daysAgo(100) });
    // phone(5) + 100 * -2 = 5 - 200 = -195, clamped to 0
    const score = ContactScoring.calculateScore(contact, []);
    expect(score).toBe(0);
  });

  it('accepts custom weight overrides', () => {
    const contact = makeContact({ email: 'john@example.com' });
    const score = ContactScoring.calculateScore(contact, [], {
      hasEmail: 50,
    });
    expect(score).toBe(55); // email(50) + phone(5)
  });

  it('returns rounded integer', () => {
    const contact = makeContact();
    const score = ContactScoring.calculateScore(contact, []);
    expect(Number.isInteger(score)).toBe(true);
  });

  it('handles contact with no phone (empty string treated as falsy)', () => {
    const contact = makeContact({ phone: '' });
    const score = ContactScoring.calculateScore(contact, []);
    expect(score).toBe(0);
  });

  it('handles multiple activity types in combination', () => {
    const contact = makeContact();
    const activities = [
      makeActivity({ type: 'inspection', createdAt: daysAgo(1) }),
      makeActivity({ type: 'email-sent', createdAt: daysAgo(2) }),
      makeActivity({ type: 'call', createdAt: daysAgo(3) }),
      makeActivity({ type: 'meeting', createdAt: daysAgo(4) }),
    ];
    // phone(5) + inspection(15) + email(3) + call(5) + meeting(10) = 38
    const score = ContactScoring.calculateScore(contact, activities);
    expect(score).toBe(38);
  });
});

// ─── getWarmthLabel ────────────────────────────────────────────────

describe('ContactScoring.getWarmthLabel', () => {
  it('returns hot for score >= 75', () => {
    expect(ContactScoring.getWarmthLabel(75)).toBe('hot');
    expect(ContactScoring.getWarmthLabel(100)).toBe('hot');
    expect(ContactScoring.getWarmthLabel(99)).toBe('hot');
  });

  it('returns warm for score >= 50 and < 75', () => {
    expect(ContactScoring.getWarmthLabel(50)).toBe('warm');
    expect(ContactScoring.getWarmthLabel(74)).toBe('warm');
  });

  it('returns cool for score >= 25 and < 50', () => {
    expect(ContactScoring.getWarmthLabel(25)).toBe('cool');
    expect(ContactScoring.getWarmthLabel(49)).toBe('cool');
  });

  it('returns cold for score < 25', () => {
    expect(ContactScoring.getWarmthLabel(0)).toBe('cold');
    expect(ContactScoring.getWarmthLabel(24)).toBe('cold');
  });

  it('handles boundary values precisely', () => {
    expect(ContactScoring.getWarmthLabel(24)).toBe('cold');
    expect(ContactScoring.getWarmthLabel(25)).toBe('cool');
    expect(ContactScoring.getWarmthLabel(49)).toBe('cool');
    expect(ContactScoring.getWarmthLabel(50)).toBe('warm');
    expect(ContactScoring.getWarmthLabel(74)).toBe('warm');
    expect(ContactScoring.getWarmthLabel(75)).toBe('hot');
  });
});
