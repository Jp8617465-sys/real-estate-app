import { describe, it, expect } from 'vitest';
import { toDbSchema, fromDbSchema, type ClientBriefDbRow } from './client-brief-transformer';
import type { ClientBrief } from '@realflow/shared';

// ─── Test Data Factories ───────────────────────────────────────────

/**
 * Creates a full ClientBrief with all optional fields populated.
 */
function makeFullClientBrief(overrides?: Partial<ClientBrief>): ClientBrief {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    contactId: '223e4567-e89b-12d3-a456-426614174001',
    transactionId: '323e4567-e89b-12d3-a456-426614174002',

    purchaseType: 'owner_occupier',
    enquiryType: 'home_buyer',

    budget: {
      min: 500000,
      max: 800000,
      absoluteMax: 900000,
      stampDutyBudgeted: true,
    },

    finance: {
      preApproved: true,
      preApprovalAmount: 750000,
      preApprovalExpiry: '2026-06-30T00:00:00Z',
      lender: 'Commonwealth Bank',
      brokerName: 'Jane Broker',
      brokerPhone: '0412345678',
      brokerEmail: 'jane@broker.com.au',
      depositAvailable: 150000,
      firstHomeBuyer: false,
    },

    requirements: {
      propertyTypes: ['house', 'townhouse'],
      bedrooms: {
        min: 3,
        ideal: 4,
      },
      bathrooms: {
        min: 2,
        ideal: 3,
      },
      carSpaces: {
        min: 1,
        ideal: 2,
      },
      landSize: {
        min: 400,
        max: 600,
      },
      buildingAge: {
        min: 0,
        max: 15,
      },
      suburbs: [
        { suburb: 'Paddington', state: 'NSW', postcode: '2021', rank: 1, notes: 'Preferred area' },
        { suburb: 'Bondi', state: 'NSW', postcode: '2026', rank: 2 },
      ],
      maxCommute: {
        destination: 'Sydney CBD',
        maxMinutes: 30,
        mode: 'transit',
      },
      schoolZones: ['Paddington Public School', 'Sydney Grammar'],
      mustHaves: ['North-facing backyard', 'Off-street parking', 'Walk to shops'],
      niceToHaves: ['Pool', 'Study nook', 'Outdoor entertaining area'],
      dealBreakers: ['Busy road', 'No outdoor space', 'Ground floor apartment'],
      investorCriteria: {
        targetYield: 4.5,
        growthPriority: 'balanced',
        acceptTenanted: true,
        newBuildPreference: false,
      },
    },

    timeline: {
      urgency: '1_3_months',
      mustSettleBefore: '2026-09-30T00:00:00Z',
      idealSettlement: 'Early September 2026',
    },

    communication: {
      preferredMethod: 'email',
      updateFrequency: 'twice_weekly',
      bestTimeToCall: 'Weekday evenings after 6pm',
      partnerName: 'Sarah Smith',
      partnerPhone: '0498765432',
      partnerEmail: 'sarah@example.com',
    },

    solicitor: {
      firmName: 'Smith & Co Legal',
      contactName: 'Michael Smith',
      phone: '0287654321',
      email: 'michael@smithlegal.com.au',
    },

    briefVersion: 1,
    clientSignedOff: false,
    signedOffAt: undefined,

    createdBy: '423e4567-e89b-12d3-a456-426614174003',
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-02-10T10:00:00Z',

    ...overrides,
  };
}

/**
 * Creates a minimal ClientBrief with only required fields.
 */
function makeMinimalClientBrief(): ClientBrief {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    contactId: '223e4567-e89b-12d3-a456-426614174001',

    purchaseType: 'owner_occupier',
    enquiryType: 'home_buyer',

    budget: {
      min: 500000,
      max: 800000,
      stampDutyBudgeted: false,
    },

    finance: {
      preApproved: false,
      firstHomeBuyer: false,
    },

    requirements: {
      propertyTypes: ['house'],
      bedrooms: { min: 3 },
      bathrooms: { min: 2 },
      carSpaces: { min: 1 },
      suburbs: [{ suburb: 'Paddington', state: 'NSW', postcode: '2021' }],
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    },

    timeline: {
      urgency: 'no_rush',
    },

    communication: {},

    briefVersion: 1,
    clientSignedOff: false,

    createdBy: '423e4567-e89b-12d3-a456-426614174003',
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-02-10T10:00:00Z',
  };
}

/**
 * Creates a partial ClientBrief with some optional fields populated.
 */
function makePartialClientBrief(): ClientBrief {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    contactId: '223e4567-e89b-12d3-a456-426614174001',
    transactionId: '323e4567-e89b-12d3-a456-426614174002',

    purchaseType: 'investor',
    enquiryType: 'investor',

    budget: {
      min: 400000,
      max: 600000,
      absoluteMax: 650000,
      stampDutyBudgeted: true,
    },

    finance: {
      preApproved: true,
      preApprovalAmount: 550000,
      lender: 'Westpac',
      firstHomeBuyer: false,
    },

    requirements: {
      propertyTypes: ['apartment', 'unit'],
      bedrooms: { min: 2, ideal: 3 },
      bathrooms: { min: 1 },
      carSpaces: { min: 1 },
      landSize: { min: 0 }, // Apartment, no land
      suburbs: [{ suburb: 'Parramatta', state: 'NSW', postcode: '2150', rank: 1 }],
      schoolZones: ['Parramatta High School'],
      mustHaves: ['Close to station', 'Modern kitchen'],
      niceToHaves: ['Balcony', 'Security building'],
      dealBreakers: ['Ground floor'],
      investorCriteria: {
        targetYield: 5.0,
        growthPriority: 'yield',
        acceptTenanted: true,
        newBuildPreference: true,
      },
    },

    timeline: {
      urgency: 'asap',
      mustSettleBefore: '2026-04-30T00:00:00Z',
    },

    communication: {
      preferredMethod: 'phone',
      bestTimeToCall: 'Business hours',
    },

    briefVersion: 1,
    clientSignedOff: true,
    signedOffAt: '2026-02-11T15:30:00Z',

    createdBy: '423e4567-e89b-12d3-a456-426614174003',
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-02-11T15:30:00Z',
  };
}

// ─── Legacy Mock (for backward compatibility) ─────────────────────

const mockClientBrief: ClientBrief = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  contactId: '123e4567-e89b-12d3-a456-426614174001',
  transactionId: '123e4567-e89b-12d3-a456-426614174002',

  purchaseType: 'owner_occupier',
  enquiryType: 'home_buyer',

  budget: {
    min: 500000,
    max: 750000,
    absoluteMax: 800000,
    stampDutyBudgeted: true,
  },

  finance: {
    preApproved: true,
    preApprovalAmount: 750000,
    preApprovalExpiry: '2026-06-30T00:00:00Z',
    lender: 'Commonwealth Bank',
    brokerName: 'John Smith',
    brokerPhone: '0412345678',
    brokerEmail: 'john@broker.com',
    depositAvailable: 150000,
    firstHomeBuyer: true,
  },

  requirements: {
    propertyTypes: ['house', 'townhouse'],
    bedrooms: {
      min: 3,
      ideal: 4,
    },
    bathrooms: {
      min: 2,
      ideal: 2,
    },
    carSpaces: {
      min: 2,
      ideal: 3,
    },
    landSize: {
      min: 400,
      max: 800,
    },
    buildingAge: {
      min: 0,
      max: 15,
    },
    suburbs: [
      {
        suburb: 'Newtown',
        state: 'NSW',
        postcode: '2042',
        rank: 1,
        notes: 'Close to work',
      },
      {
        suburb: 'Marrickville',
        state: 'NSW',
        postcode: '2204',
        rank: 2,
      },
    ],
    maxCommute: {
      destination: 'Sydney CBD',
      maxMinutes: 45,
      mode: 'transit',
    },
    schoolZones: ['Newtown Public School', 'Newtown High School'],
    mustHaves: ['Air conditioning', 'Garage', 'North-facing backyard'],
    niceToHaves: ['Pool', 'Study room'],
    dealBreakers: ['Busy road', 'No parking'],
    investorCriteria: undefined,
  },

  timeline: {
    urgency: '3_6_months',
    mustSettleBefore: '2026-12-31T00:00:00Z',
    idealSettlement: 'Before Christmas',
  },

  communication: {
    preferredMethod: 'email',
    updateFrequency: 'weekly',
    bestTimeToCall: 'Weekday evenings',
    partnerName: 'Jane Doe',
    partnerPhone: '0423456789',
    partnerEmail: 'jane@example.com',
  },

  solicitor: {
    firmName: 'Smith & Partners Law',
    contactName: 'Sarah Smith',
    phone: '0298765432',
    email: 'sarah@smithlaw.com.au',
  },

  briefVersion: 1,
  clientSignedOff: false,
  signedOffAt: undefined,

  createdBy: '123e4567-e89b-12d3-a456-426614174003',
  createdAt: '2026-01-15T10:30:00Z',
  updatedAt: '2026-01-15T10:30:00Z',
};

// ─── Round-Trip Tests (Most Critical) ──────────────────────────────

describe('ClientBriefTransformer - Round-Trip', () => {
  it('preserves all data through full round-trip with full brief', () => {
    const original = makeFullClientBrief();
    const dbRow = toDbSchema(original);
    const restored = fromDbSchema(dbRow);

    expect(restored).toEqual(original);
  });

  it('preserves all data through full round-trip with minimal brief', () => {
    const original = makeMinimalClientBrief();
    const dbRow = toDbSchema(original);
    const restored = fromDbSchema(dbRow);

    expect(restored).toEqual(original);
  });

  it('preserves all data through full round-trip with partial brief', () => {
    const original = makePartialClientBrief();
    const dbRow = toDbSchema(original);
    const restored = fromDbSchema(dbRow);

    expect(restored).toEqual(original);
  });

  it('handles undefined optional fields correctly', () => {
    const original = makeMinimalClientBrief();
    const dbRow = toDbSchema(original);
    const restored = fromDbSchema(dbRow);

    // Verify undefined fields remain undefined
    expect(restored.transactionId).toBeUndefined();
    expect(restored.solicitor).toBeUndefined();
    expect(restored.requirements.landSize).toBeUndefined();
    expect(restored.requirements.buildingAge).toBeUndefined();
    expect(restored.requirements.maxCommute).toBeUndefined();
    expect(restored.requirements.investorCriteria).toBeUndefined();
  });

  it('handles signed-off brief correctly', () => {
    const original = makeFullClientBrief({
      clientSignedOff: true,
      signedOffAt: '2026-02-11T15:30:00Z',
    });
    const dbRow = toDbSchema(original);
    const restored = fromDbSchema(dbRow);

    expect(restored.clientSignedOff).toBe(true);
    expect(restored.signedOffAt).toBe('2026-02-11T15:30:00Z');
  });
});

describe('toDbSchema', () => {
  it('should flatten nested ClientBrief to database row format', () => {
      const dbRow = toDbSchema(mockClientBrief);

      // Identity
      expect(dbRow.id).toBe(mockClientBrief.id);
      expect(dbRow.contact_id).toBe(mockClientBrief.contactId);
      expect(dbRow.transaction_id).toBe(mockClientBrief.transactionId);

      // Budget
      expect(dbRow.budget_min).toBe(500000);
      expect(dbRow.budget_max).toBe(750000);
      expect(dbRow.budget_absolute_max).toBe(800000);
      expect(dbRow.stamp_duty_budgeted).toBe(true);

      // Finance
      expect(dbRow.pre_approved).toBe(true);
      expect(dbRow.pre_approval_amount).toBe(750000);
      expect(dbRow.pre_approval_expiry).toBe('2026-06-30T00:00:00Z');
      expect(dbRow.lender).toBe('Commonwealth Bank');
      expect(dbRow.first_home_buyer).toBe(true);

      // Requirements - Property details
      expect(dbRow.property_types).toEqual(['house', 'townhouse']);
      expect(dbRow.bedrooms_min).toBe(3);
      expect(dbRow.bedrooms_ideal).toBe(4);
      expect(dbRow.bathrooms_min).toBe(2);
      expect(dbRow.car_spaces_min).toBe(2);
      expect(dbRow.land_size_min).toBe(400);
      expect(dbRow.land_size_max).toBe(800);
      expect(dbRow.building_age_min).toBe(0);
      expect(dbRow.building_age_max).toBe(15);

      // Requirements - Location (JSONB)
      expect(dbRow.suburbs).toHaveLength(2);
      expect(dbRow.suburbs[0].suburb).toBe('Newtown');
      expect(dbRow.max_commute).toEqual({
        destination: 'Sydney CBD',
        maxMinutes: 45,
        mode: 'transit',
      });
      expect(dbRow.school_zones).toEqual(['Newtown Public School', 'Newtown High School']);

      // Requirements - Preferences
      expect(dbRow.must_haves).toHaveLength(3);
      expect(dbRow.nice_to_haves).toHaveLength(2);
      expect(dbRow.deal_breakers).toHaveLength(2);

      // Timeline
      expect(dbRow.urgency).toBe('3_6_months');
      expect(dbRow.must_settle_before).toBe('2026-12-31T00:00:00Z');
      expect(dbRow.ideal_settlement).toBe('Before Christmas');

      // Communication
      expect(dbRow.preferred_contact_method).toBe('email');
      expect(dbRow.update_frequency).toBe('weekly');
      expect(dbRow.best_time_to_call).toBe('Weekday evenings');
      expect(dbRow.partner_name).toBe('Jane Doe');

      // Solicitor (flattened)
      expect(dbRow.solicitor_firm).toBe('Smith & Partners Law');
      expect(dbRow.solicitor_contact).toBe('Sarah Smith');
      expect(dbRow.solicitor_phone).toBe('0298765432');
      expect(dbRow.solicitor_email).toBe('sarah@smithlaw.com.au');

      // Metadata
      expect(dbRow.brief_version).toBe(1);
      expect(dbRow.client_signed_off).toBe(false);
      expect(dbRow.signed_off_at).toBe(null);
      expect(dbRow.is_deleted).toBe(false);
      expect(dbRow.deleted_at).toBe(null);
    });

    it('should handle optional fields correctly', () => {
      const minimalBrief: ClientBrief = {
        ...mockClientBrief,
        transactionId: undefined,
        budget: {
          min: 500000,
          max: 750000,
          stampDutyBudgeted: false,
        },
        requirements: {
          ...mockClientBrief.requirements,
          landSize: undefined,
          buildingAge: undefined,
          maxCommute: undefined,
          schoolZones: undefined,
          investorCriteria: undefined,
        },
        solicitor: undefined,
        signedOffAt: undefined,
      };

      const dbRow = toDbSchema(minimalBrief);

      expect(dbRow.transaction_id).toBe(null);
      expect(dbRow.budget_absolute_max).toBe(null);
      expect(dbRow.land_size_min).toBe(null);
      expect(dbRow.land_size_max).toBe(null);
      expect(dbRow.building_age_min).toBe(null);
      expect(dbRow.building_age_max).toBe(null);
      expect(dbRow.max_commute).toBe(null);
      expect(dbRow.school_zones).toBe(null);
      expect(dbRow.investor_criteria).toBe(null);
      expect(dbRow.solicitor_firm).toBe(null);
      expect(dbRow.solicitor_contact).toBe(null);
      expect(dbRow.solicitor_phone).toBe(null);
      expect(dbRow.solicitor_email).toBe(null);
      expect(dbRow.signed_off_at).toBe(null);
    });

    it('should handle investor criteria', () => {
      const investorBrief: ClientBrief = {
        ...mockClientBrief,
        purchaseType: 'investor',
        enquiryType: 'investor',
        requirements: {
          ...mockClientBrief.requirements,
          investorCriteria: {
            targetYield: 5.5,
            growthPriority: 'balanced',
            acceptTenanted: true,
            newBuildPreference: false,
          },
        },
      };

      const dbRow = toDbSchema(investorBrief);

      expect(dbRow.investor_criteria).toEqual({
        targetYield: 5.5,
        growthPriority: 'balanced',
        acceptTenanted: true,
        newBuildPreference: false,
      });
    });
  });

describe('fromDbSchema', () => {
  it('should reconstruct nested ClientBrief from database row', () => {
      const dbRow: ClientBriefDbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        contact_id: '123e4567-e89b-12d3-a456-426614174001',
        transaction_id: '123e4567-e89b-12d3-a456-426614174002',

        purchase_type: 'owner_occupier',
        enquiry_type: 'home_buyer',

        budget_min: 500000,
        budget_max: 750000,
        budget_absolute_max: 800000,
        stamp_duty_budgeted: true,

        pre_approved: true,
        pre_approval_amount: 750000,
        pre_approval_expiry: '2026-06-30T00:00:00Z',
        lender: 'Commonwealth Bank',
        broker_name: 'John Smith',
        broker_phone: '0412345678',
        broker_email: 'john@broker.com',
        deposit_available: 150000,
        first_home_buyer: true,

        property_types: ['house', 'townhouse'],
        bedrooms_min: 3,
        bedrooms_ideal: 4,
        bathrooms_min: 2,
        bathrooms_ideal: 2,
        car_spaces_min: 2,
        car_spaces_ideal: 3,
        land_size_min: 400,
        land_size_max: 800,
        building_age_min: 0,
        building_age_max: 15,

        suburbs: [
          {
            suburb: 'Newtown',
            state: 'NSW',
            postcode: '2042',
            rank: 1,
            notes: 'Close to work',
          },
        ],
        max_commute: {
          destination: 'Sydney CBD',
          maxMinutes: 45,
          mode: 'transit',
        },
        school_zones: ['Newtown Public School'],

        must_haves: ['Air conditioning'],
        nice_to_haves: ['Pool'],
        deal_breakers: ['Busy road'],
        investor_criteria: null,

        urgency: '3_6_months',
        must_settle_before: '2026-12-31T00:00:00Z',
        ideal_settlement: 'Before Christmas',

        preferred_contact_method: 'email',
        update_frequency: 'weekly',
        best_time_to_call: 'Weekday evenings',
        partner_name: 'Jane Doe',
        partner_phone: '0423456789',
        partner_email: 'jane@example.com',

        solicitor_firm: 'Smith & Partners Law',
        solicitor_contact: 'Sarah Smith',
        solicitor_phone: '0298765432',
        solicitor_email: 'sarah@smithlaw.com.au',

        brief_version: 1,
        client_signed_off: false,
        signed_off_at: null,

        is_deleted: false,
        deleted_at: null,

        created_by: '123e4567-e89b-12d3-a456-426614174003',
        created_at: '2026-01-15T10:30:00Z',
        updated_at: '2026-01-15T10:30:00Z',
      };

      const brief = fromDbSchema(dbRow);

      // Identity
      expect(brief.id).toBe(dbRow.id);
      expect(brief.contactId).toBe(dbRow.contact_id);
      expect(brief.transactionId).toBe(dbRow.transaction_id);

      // Budget (nested)
      expect(brief.budget.min).toBe(500000);
      expect(brief.budget.max).toBe(750000);
      expect(brief.budget.absoluteMax).toBe(800000);
      expect(brief.budget.stampDutyBudgeted).toBe(true);

      // Finance (nested)
      expect(brief.finance.preApproved).toBe(true);
      expect(brief.finance.preApprovalAmount).toBe(750000);
      expect(brief.finance.lender).toBe('Commonwealth Bank');
      expect(brief.finance.firstHomeBuyer).toBe(true);

      // Requirements (nested)
      expect(brief.requirements.propertyTypes).toEqual(['house', 'townhouse']);
      expect(brief.requirements.bedrooms.min).toBe(3);
      expect(brief.requirements.bedrooms.ideal).toBe(4);
      expect(brief.requirements.bathrooms.min).toBe(2);
      expect(brief.requirements.carSpaces.min).toBe(2);
      expect(brief.requirements.landSize).toEqual({ min: 400, max: 800 });
      expect(brief.requirements.buildingAge).toEqual({ min: 0, max: 15 });
      expect(brief.requirements.suburbs).toHaveLength(1);
      expect(brief.requirements.maxCommute).toEqual({
        destination: 'Sydney CBD',
        maxMinutes: 45,
        mode: 'transit',
      });

      // Timeline (nested)
      expect(brief.timeline.urgency).toBe('3_6_months');
      expect(brief.timeline.mustSettleBefore).toBe('2026-12-31T00:00:00Z');

      // Communication (nested)
      expect(brief.communication.preferredMethod).toBe('email');
      expect(brief.communication.updateFrequency).toBe('weekly');
      expect(brief.communication.partnerName).toBe('Jane Doe');

      // Solicitor (nested)
      expect(brief.solicitor).toBeDefined();
      expect(brief.solicitor?.firmName).toBe('Smith & Partners Law');
      expect(brief.solicitor?.contactName).toBe('Sarah Smith');

      // Metadata
      expect(brief.briefVersion).toBe(1);
      expect(brief.clientSignedOff).toBe(false);
      expect(brief.signedOffAt).toBeUndefined();
    });

    it('should handle null optional fields correctly', () => {
      const dbRow: ClientBriefDbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        contact_id: '123e4567-e89b-12d3-a456-426614174001',
        transaction_id: null,

        purchase_type: 'owner_occupier',
        enquiry_type: 'home_buyer',

        budget_min: 500000,
        budget_max: 750000,
        budget_absolute_max: null,
        stamp_duty_budgeted: false,

        pre_approved: false,
        pre_approval_amount: null,
        pre_approval_expiry: null,
        lender: null,
        broker_name: null,
        broker_phone: null,
        broker_email: null,
        deposit_available: null,
        first_home_buyer: false,

        property_types: ['house'],
        bedrooms_min: 3,
        bedrooms_ideal: null,
        bathrooms_min: 2,
        bathrooms_ideal: null,
        car_spaces_min: 1,
        car_spaces_ideal: null,
        land_size_min: null,
        land_size_max: null,
        building_age_min: null,
        building_age_max: null,

        suburbs: [],
        max_commute: null,
        school_zones: null,

        must_haves: [],
        nice_to_haves: [],
        deal_breakers: [],
        investor_criteria: null,

        urgency: 'no_rush',
        must_settle_before: null,
        ideal_settlement: null,

        preferred_contact_method: null,
        update_frequency: null,
        best_time_to_call: null,
        partner_name: null,
        partner_phone: null,
        partner_email: null,

        solicitor_firm: null,
        solicitor_contact: null,
        solicitor_phone: null,
        solicitor_email: null,

        brief_version: 1,
        client_signed_off: false,
        signed_off_at: null,

        is_deleted: false,
        deleted_at: null,

        created_by: '123e4567-e89b-12d3-a456-426614174003',
        created_at: '2026-01-15T10:30:00Z',
        updated_at: '2026-01-15T10:30:00Z',
      };

      const brief = fromDbSchema(dbRow);

      expect(brief.transactionId).toBeUndefined();
      expect(brief.budget.absoluteMax).toBeUndefined();
      expect(brief.finance.preApprovalAmount).toBeUndefined();
      expect(brief.requirements.bedrooms.ideal).toBeUndefined();
      expect(brief.requirements.landSize).toBeUndefined();
      expect(brief.requirements.buildingAge).toBeUndefined();
      expect(brief.requirements.maxCommute).toBeUndefined();
      expect(brief.requirements.schoolZones).toBeUndefined();
      expect(brief.requirements.investorCriteria).toBeUndefined();
      expect(brief.timeline.mustSettleBefore).toBeUndefined();
      expect(brief.communication.preferredMethod).toBeUndefined();
      expect(brief.solicitor).toBeUndefined();
    });

    it('should reconstruct solicitor only when at least one field is non-null', () => {
      const dbRow: ClientBriefDbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        contact_id: '123e4567-e89b-12d3-a456-426614174001',
        transaction_id: null,
        purchase_type: 'owner_occupier',
        enquiry_type: 'home_buyer',
        budget_min: 500000,
        budget_max: 750000,
        budget_absolute_max: null,
        stamp_duty_budgeted: false,
        pre_approved: false,
        pre_approval_amount: null,
        pre_approval_expiry: null,
        lender: null,
        broker_name: null,
        broker_phone: null,
        broker_email: null,
        deposit_available: null,
        first_home_buyer: false,
        property_types: ['house'],
        bedrooms_min: 3,
        bedrooms_ideal: null,
        bathrooms_min: 2,
        bathrooms_ideal: null,
        car_spaces_min: 1,
        car_spaces_ideal: null,
        land_size_min: null,
        land_size_max: null,
        building_age_min: null,
        building_age_max: null,
        suburbs: [],
        max_commute: null,
        school_zones: null,
        must_haves: [],
        nice_to_haves: [],
        deal_breakers: [],
        investor_criteria: null,
        urgency: 'no_rush',
        must_settle_before: null,
        ideal_settlement: null,
        preferred_contact_method: null,
        update_frequency: null,
        best_time_to_call: null,
        partner_name: null,
        partner_phone: null,
        partner_email: null,
        solicitor_firm: 'Smith Law',
        solicitor_contact: null,
        solicitor_phone: null,
        solicitor_email: null,
        brief_version: 1,
        client_signed_off: false,
        signed_off_at: null,
        is_deleted: false,
        deleted_at: null,
        created_by: '123e4567-e89b-12d3-a456-426614174003',
        created_at: '2026-01-15T10:30:00Z',
        updated_at: '2026-01-15T10:30:00Z',
      };

      const brief = fromDbSchema(dbRow);

      expect(brief.solicitor).toBeDefined();
      expect(brief.solicitor?.firmName).toBe('Smith Law');
      expect(brief.solicitor?.contactName).toBe('');
    });
  });

describe('bidirectional transformation', () => {
  it('should maintain data integrity through round-trip transformation', () => {
      const dbRow = toDbSchema(mockClientBrief);
      const reconstructed = fromDbSchema(dbRow);

      // Compare key nested structures
      expect(reconstructed.budget).toEqual(mockClientBrief.budget);
      expect(reconstructed.finance).toEqual(mockClientBrief.finance);
      expect(reconstructed.requirements.bedrooms).toEqual(mockClientBrief.requirements.bedrooms);
      expect(reconstructed.requirements.suburbs).toEqual(mockClientBrief.requirements.suburbs);
      expect(reconstructed.timeline).toEqual(mockClientBrief.timeline);
      expect(reconstructed.communication).toEqual(mockClientBrief.communication);
      expect(reconstructed.solicitor).toEqual(mockClientBrief.solicitor);
    });

    it('should handle edge case: landSize with only min value', () => {
      const briefWithMinLandSize: ClientBrief = {
        ...mockClientBrief,
        requirements: {
          ...mockClientBrief.requirements,
          landSize: {
            min: 400,
          },
        },
      };

      const dbRow = toDbSchema(briefWithMinLandSize);
      const reconstructed = fromDbSchema(dbRow);

      expect(reconstructed.requirements.landSize).toEqual({ min: 400 });
    });

    it('should handle edge case: buildingAge with only max value', () => {
      const briefWithMaxAge: ClientBrief = {
        ...mockClientBrief,
        requirements: {
          ...mockClientBrief.requirements,
          buildingAge: {
            max: 15,
          },
        },
      };

      const dbRow = toDbSchema(briefWithMaxAge);
      const reconstructed = fromDbSchema(dbRow);

      expect(reconstructed.requirements.buildingAge).toEqual({ max: 15 });
    });
  });

// ─── Additional Edge Cases ─────────────────────────────────────────

describe("ClientBriefTransformer - Additional Edge Cases", () => {
  it("handles empty string arrays correctly", () => {
    const brief = makeMinimalClientBrief();
    brief.requirements.mustHaves = [];
    brief.requirements.niceToHaves = [];
    brief.requirements.dealBreakers = [];

    const dbRow = toDbSchema(brief);
    const restored = fromDbSchema(dbRow);

    expect(restored.requirements.mustHaves).toEqual([]);
    expect(restored.requirements.niceToHaves).toEqual([]);
    expect(restored.requirements.dealBreakers).toEqual([]);
  });

  it("handles SMSF purchase type", () => {
    const brief = makeMinimalClientBrief();
    brief.purchaseType = "smsf";
    brief.enquiryType = "investor";

    const dbRow = toDbSchema(brief);
    const restored = fromDbSchema(dbRow);

    expect(restored.purchaseType).toBe("smsf");
  });

  it("handles development purchase type", () => {
    const brief = makeMinimalClientBrief();
    brief.purchaseType = "development";

    const dbRow = toDbSchema(brief);
    const restored = fromDbSchema(dbRow);

    expect(restored.purchaseType).toBe("development");
  });

  it("handles all urgency values", () => {
    const urgencies: Array<"asap" | "1_3_months" | "3_6_months" | "6_12_months" | "no_rush"> = [
      "asap",
      "1_3_months",
      "3_6_months",
      "6_12_months",
      "no_rush",
    ];

    urgencies.forEach((urgency) => {
      const brief = makeMinimalClientBrief();
      brief.timeline.urgency = urgency;

      const dbRow = toDbSchema(brief);
      const restored = fromDbSchema(dbRow);

      expect(restored.timeline.urgency).toBe(urgency);
    });
  });

  it("handles all contact methods", () => {
    const methods: Array<"phone" | "email" | "sms" | "whatsapp"> = [
      "phone",
      "email",
      "sms",
      "whatsapp",
    ];

    methods.forEach((method) => {
      const brief = makeMinimalClientBrief();
      brief.communication.preferredMethod = method;

      const dbRow = toDbSchema(brief);
      const restored = fromDbSchema(dbRow);

      expect(restored.communication.preferredMethod).toBe(method);
    });
  });

  it("handles zero values correctly (not treated as null)", () => {
    const brief = makeMinimalClientBrief();
    brief.budget.min = 0;
    brief.requirements.bedrooms.min = 0;
    brief.requirements.landSize = { min: 0, max: 0 };

    const dbRow = toDbSchema(brief);
    const restored = fromDbSchema(dbRow);

    expect(restored.budget.min).toBe(0);
    expect(restored.requirements.bedrooms.min).toBe(0);
    expect(restored.requirements.landSize?.min).toBe(0);
    expect(restored.requirements.landSize?.max).toBe(0);
  });

  it("handles large numeric values", () => {
    const brief = makeMinimalClientBrief();
    brief.budget.min = 10000000;
    brief.budget.max = 20000000;
    brief.finance.preApprovalAmount = 15000000;

    const dbRow = toDbSchema(brief);
    const restored = fromDbSchema(dbRow);

    expect(restored.budget.min).toBe(10000000);
    expect(restored.budget.max).toBe(20000000);
    expect(restored.finance.preApprovalAmount).toBe(15000000);
  });

  it("handles ISO datetime strings correctly", () => {
    const brief = makeFullClientBrief();
    brief.finance.preApprovalExpiry = "2026-12-31T23:59:59.999Z";
    brief.timeline.mustSettleBefore = "2027-01-15T10:30:00.000Z";
    brief.signedOffAt = "2026-02-12T08:15:30.500Z";

    const dbRow = toDbSchema(brief);
    const restored = fromDbSchema(dbRow);

    expect(restored.finance.preApprovalExpiry).toBe("2026-12-31T23:59:59.999Z");
    expect(restored.timeline.mustSettleBefore).toBe("2027-01-15T10:30:00.000Z");
    expect(restored.signedOffAt).toBe("2026-02-12T08:15:30.500Z");
  });

  it("handles multiple property types", () => {
    const brief = makeMinimalClientBrief();
    brief.requirements.propertyTypes = ["house", "townhouse", "villa", "duplex"];

    const dbRow = toDbSchema(brief);
    const restored = fromDbSchema(dbRow);

    expect(restored.requirements.propertyTypes).toEqual(["house", "townhouse", "villa", "duplex"]);
  });
});

