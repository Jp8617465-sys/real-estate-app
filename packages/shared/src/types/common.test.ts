import { describe, it, expect } from 'vitest';
import {
  AddressSchema,
  PropertyTypeSchema,
  LeadSourceSchema,
  CommunicationPreferenceSchema,
  SaleTypeSchema,
  ListingStatusSchema,
  PaginationSchema,
  SortDirectionSchema,
} from './common';

// ─── AddressSchema ─────────────────────────────────────────────────

describe('AddressSchema', () => {
  const validAddress = {
    streetNumber: '42',
    streetName: 'Wallaby Way',
    suburb: 'Sydney',
    state: 'NSW' as const,
    postcode: '2000',
  };

  it('accepts a valid Australian address', () => {
    const result = AddressSchema.parse(validAddress);
    expect(result.country).toBe('AU');
    expect(result.streetNumber).toBe('42');
  });

  it('accepts optional unitNumber', () => {
    const result = AddressSchema.parse({ ...validAddress, unitNumber: '5A' });
    expect(result.unitNumber).toBe('5A');
  });

  it('defaults country to AU', () => {
    const result = AddressSchema.parse(validAddress);
    expect(result.country).toBe('AU');
  });

  it('rejects invalid postcode (non-4-digit)', () => {
    expect(() =>
      AddressSchema.parse({ ...validAddress, postcode: '200' }),
    ).toThrow();
    expect(() =>
      AddressSchema.parse({ ...validAddress, postcode: '20000' }),
    ).toThrow();
    expect(() =>
      AddressSchema.parse({ ...validAddress, postcode: 'ABCD' }),
    ).toThrow();
  });

  it('rejects invalid state', () => {
    expect(() =>
      AddressSchema.parse({ ...validAddress, state: 'XX' }),
    ).toThrow();
  });

  it('accepts all valid Australian states', () => {
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;
    for (const state of states) {
      const result = AddressSchema.parse({ ...validAddress, state });
      expect(result.state).toBe(state);
    }
  });

  it('rejects missing required fields', () => {
    expect(() => AddressSchema.parse({})).toThrow();
    expect(() =>
      AddressSchema.parse({ streetNumber: '1' }),
    ).toThrow();
  });
});

// ─── PropertyTypeSchema ────────────────────────────────────────────

describe('PropertyTypeSchema', () => {
  const validTypes = [
    'house', 'unit', 'townhouse', 'villa', 'land', 'rural',
    'apartment', 'duplex', 'studio', 'acreage', 'retirement', 'commercial',
  ];

  it('accepts all valid property types', () => {
    for (const type of validTypes) {
      expect(PropertyTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid property type', () => {
    expect(() => PropertyTypeSchema.parse('castle')).toThrow();
    expect(() => PropertyTypeSchema.parse('')).toThrow();
  });
});

// ─── LeadSourceSchema ──────────────────────────────────────────────

describe('LeadSourceSchema', () => {
  const validSources = [
    'domain', 'rea', 'instagram', 'facebook', 'linkedin',
    'referral', 'walk-in', 'cold-call', 'website', 'open-home',
    'signboard', 'print', 'other',
  ];

  it('accepts all valid lead sources', () => {
    for (const source of validSources) {
      expect(LeadSourceSchema.parse(source)).toBe(source);
    }
  });

  it('rejects invalid lead source', () => {
    expect(() => LeadSourceSchema.parse('twitter')).toThrow();
  });
});

// ─── CommunicationPreferenceSchema ─────────────────────────────────

describe('CommunicationPreferenceSchema', () => {
  it('accepts valid preferences', () => {
    for (const pref of ['email', 'phone', 'sms', 'any']) {
      expect(CommunicationPreferenceSchema.parse(pref)).toBe(pref);
    }
  });

  it('rejects invalid preference', () => {
    expect(() => CommunicationPreferenceSchema.parse('whatsapp')).toThrow();
  });
});

// ─── SaleTypeSchema ────────────────────────────────────────────────

describe('SaleTypeSchema', () => {
  it('accepts valid sale types', () => {
    const types = ['private-treaty', 'auction', 'expression-of-interest', 'tender'];
    for (const type of types) {
      expect(SaleTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid sale type', () => {
    expect(() => SaleTypeSchema.parse('swap')).toThrow();
  });
});

// ─── ListingStatusSchema ───────────────────────────────────────────

describe('ListingStatusSchema', () => {
  it('accepts valid listing statuses', () => {
    const statuses = ['pre-market', 'active', 'under-offer', 'sold', 'withdrawn', 'leased'];
    for (const status of statuses) {
      expect(ListingStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects invalid status', () => {
    expect(() => ListingStatusSchema.parse('archived')).toThrow();
  });
});

// ─── PaginationSchema ──────────────────────────────────────────────

describe('PaginationSchema', () => {
  it('uses defaults when no values provided', () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('accepts custom page and limit', () => {
    const result = PaginationSchema.parse({ page: 3, limit: 50 });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects non-positive page', () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
    expect(() => PaginationSchema.parse({ page: -1 })).toThrow();
  });

  it('rejects limit over 100', () => {
    expect(() => PaginationSchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects non-integer values', () => {
    expect(() => PaginationSchema.parse({ page: 1.5 })).toThrow();
  });
});

// ─── SortDirectionSchema ───────────────────────────────────────────

describe('SortDirectionSchema', () => {
  it('accepts asc and desc', () => {
    expect(SortDirectionSchema.parse('asc')).toBe('asc');
    expect(SortDirectionSchema.parse('desc')).toBe('desc');
  });

  it('rejects invalid sort direction', () => {
    expect(() => SortDirectionSchema.parse('ascending')).toThrow();
  });
});
