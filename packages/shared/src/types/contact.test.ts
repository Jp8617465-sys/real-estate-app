import { describe, it, expect } from 'vitest';
import {
  ContactTypeSchema,
  BuyerProfileSchema,
  SellerProfileSchema,
  SocialProfilesSchema,
  ContactSchema,
  CreateContactSchema,
  UpdateContactSchema,
  ContactSearchSchema,
} from './contact';

// ─── Helpers ───────────────────────────────────────────────────────

const uuid = () => '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();

const validBuyerProfile = {
  budgetMin: 500000,
  budgetMax: 800000,
  preApproved: true,
  propertyTypes: ['house' as const, 'townhouse' as const],
  bedrooms: { min: 3 },
  bathrooms: { min: 2 },
  carSpaces: { min: 1 },
  suburbs: ['Paddington', 'Woollahra'],
  mustHaves: ['garden'],
  dealBreakers: ['busy road'],
};

const validContact = {
  id: uuid(),
  types: ['buyer' as const],
  firstName: 'John',
  lastName: 'Smith',
  phone: '0412345678',
  source: 'domain' as const,
  assignedAgentId: uuid(),
  tags: ['vip'],
  communicationPreference: 'email' as const,
  createdAt: now(),
  updatedAt: now(),
};

// ─── ContactTypeSchema ─────────────────────────────────────────────

describe('ContactTypeSchema', () => {
  const validTypes = [
    'buyer', 'seller', 'investor', 'landlord',
    'tenant', 'referral-source', 'past-client',
  ];

  it('accepts all valid contact types', () => {
    for (const type of validTypes) {
      expect(ContactTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid contact type', () => {
    expect(() => ContactTypeSchema.parse('prospect')).toThrow();
  });
});

// ─── BuyerProfileSchema ────────────────────────────────────────────

describe('BuyerProfileSchema', () => {
  it('accepts a valid buyer profile', () => {
    const result = BuyerProfileSchema.parse(validBuyerProfile);
    expect(result.budgetMin).toBe(500000);
    expect(result.preApproved).toBe(true);
  });

  it('defaults preApproved to false', () => {
    const profile = { ...validBuyerProfile };
    delete (profile as Record<string, unknown>).preApproved;
    const result = BuyerProfileSchema.parse(profile);
    expect(result.preApproved).toBe(false);
  });

  it('accepts optional pre-approval fields', () => {
    const result = BuyerProfileSchema.parse({
      ...validBuyerProfile,
      preApprovalAmount: 750000,
      preApprovalExpiry: now(),
    });
    expect(result.preApprovalAmount).toBe(750000);
  });

  it('rejects negative budget', () => {
    expect(() =>
      BuyerProfileSchema.parse({ ...validBuyerProfile, budgetMin: -1 }),
    ).toThrow();
  });

  it('accepts bedroom max as optional', () => {
    const result = BuyerProfileSchema.parse(validBuyerProfile);
    expect(result.bedrooms.max).toBeUndefined();
  });
});

// ─── SellerProfileSchema ───────────────────────────────────────────

describe('SellerProfileSchema', () => {
  const validSellerProfile = {
    propertyIds: [uuid()],
    motivationLevel: 4 as const,
    timeframe: '3-6 months',
  };

  it('accepts a valid seller profile', () => {
    const result = SellerProfileSchema.parse(validSellerProfile);
    expect(result.motivationLevel).toBe(4);
  });

  it('accepts motivation levels 1-5', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const result = SellerProfileSchema.parse({
        ...validSellerProfile,
        motivationLevel: level,
      });
      expect(result.motivationLevel).toBe(level);
    }
  });

  it('rejects invalid motivation level', () => {
    expect(() =>
      SellerProfileSchema.parse({ ...validSellerProfile, motivationLevel: 6 }),
    ).toThrow();
    expect(() =>
      SellerProfileSchema.parse({ ...validSellerProfile, motivationLevel: 0 }),
    ).toThrow();
  });

  it('accepts optional reason', () => {
    const result = SellerProfileSchema.parse({
      ...validSellerProfile,
      reason: 'Downsizing',
    });
    expect(result.reason).toBe('Downsizing');
  });
});

// ─── SocialProfilesSchema ──────────────────────────────────────────

describe('SocialProfilesSchema', () => {
  it('accepts all optional fields', () => {
    const result = SocialProfilesSchema.parse({});
    expect(result.instagram).toBeUndefined();
  });

  it('accepts social profile handles', () => {
    const result = SocialProfilesSchema.parse({
      instagram: '@realflow',
      facebook: 'realflow.au',
      linkedin: 'in/realflow',
    });
    expect(result.instagram).toBe('@realflow');
  });
});

// ─── ContactSchema ─────────────────────────────────────────────────

describe('ContactSchema', () => {
  it('accepts a minimal valid contact', () => {
    const result = ContactSchema.parse(validContact);
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Smith');
  });

  it('accepts a contact with buyer profile', () => {
    const result = ContactSchema.parse({
      ...validContact,
      buyerProfile: validBuyerProfile,
    });
    expect(result.buyerProfile?.budgetMax).toBe(800000);
  });

  it('accepts optional email', () => {
    const result = ContactSchema.parse({
      ...validContact,
      email: 'john@example.com',
    });
    expect(result.email).toBe('john@example.com');
  });

  it('rejects invalid email format', () => {
    expect(() =>
      ContactSchema.parse({ ...validContact, email: 'not-an-email' }),
    ).toThrow();
  });

  it('rejects empty firstName', () => {
    expect(() =>
      ContactSchema.parse({ ...validContact, firstName: '' }),
    ).toThrow();
  });

  it('rejects empty types array', () => {
    expect(() =>
      ContactSchema.parse({ ...validContact, types: [] }),
    ).toThrow();
  });

  it('rejects phone shorter than 8 characters', () => {
    expect(() =>
      ContactSchema.parse({ ...validContact, phone: '1234567' }),
    ).toThrow();
  });

  it('defaults communicationPreference to any', () => {
    const { communicationPreference, ...rest } = validContact;
    const result = ContactSchema.parse(rest);
    expect(result.communicationPreference).toBe('any');
  });

  it('accepts lastContactDate and nextFollowUp as datetimes', () => {
    const result = ContactSchema.parse({
      ...validContact,
      lastContactDate: now(),
      nextFollowUp: now(),
    });
    expect(result.lastContactDate).toBeDefined();
    expect(result.nextFollowUp).toBeDefined();
  });
});

// ─── CreateContactSchema ───────────────────────────────────────────

describe('CreateContactSchema', () => {
  it('omits id, createdAt, updatedAt, lastContactDate', () => {
    const result = CreateContactSchema.parse({
      types: ['buyer'],
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '0400000000',
      source: 'referral',
      assignedAgentId: uuid(),
      communicationPreference: 'phone',
    });
    expect(result.firstName).toBe('Jane');
    expect((result as Record<string, unknown>).id).toBeUndefined();
  });

  it('makes tags optional', () => {
    const result = CreateContactSchema.parse({
      types: ['buyer'],
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '0400000000',
      source: 'referral',
      assignedAgentId: uuid(),
      communicationPreference: 'phone',
    });
    expect(result.tags).toBeUndefined();
  });
});

// ─── UpdateContactSchema ───────────────────────────────────────────

describe('UpdateContactSchema', () => {
  it('accepts partial updates', () => {
    const result = UpdateContactSchema.parse({ firstName: 'Updated' });
    expect(result.firstName).toBe('Updated');
  });

  it('accepts an empty object', () => {
    const result = UpdateContactSchema.parse({});
    expect(result).toEqual({});
  });
});

// ─── ContactSearchSchema ───────────────────────────────────────────

describe('ContactSearchSchema', () => {
  it('accepts an empty search (all optional)', () => {
    const result = ContactSearchSchema.parse({});
    expect(result.query).toBeUndefined();
  });

  it('accepts a text query', () => {
    const result = ContactSearchSchema.parse({ query: 'John' });
    expect(result.query).toBe('John');
  });

  it('accepts multiple filter criteria', () => {
    const result = ContactSearchSchema.parse({
      types: ['buyer', 'investor'],
      sources: ['domain', 'rea'],
      tags: ['vip'],
      assignedAgentId: uuid(),
      suburbs: ['Paddington'],
      budgetMin: 500000,
      budgetMax: 1000000,
    });
    expect(result.types).toHaveLength(2);
    expect(result.suburbs).toEqual(['Paddington']);
  });
});
