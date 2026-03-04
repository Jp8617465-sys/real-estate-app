import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ResearchConsolidationEngine,
  type ConsolidationDataInput,
  type ConsolidationOptions,
} from './research-consolidation-engine';
import type {
  ClientBrief,
  Property,
  PropertyMatch,
  Inspection,
  DueDiligenceChecklist,
  DueDiligenceItem,
  KeyDate,
  Offer,
  MarketSnapshot,
} from '@realflow/shared';

// ─── Test Data Factories ────────────────────────────────────────────

function createProperty(overrides?: Partial<Property>): Property {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    address: {
      streetNumber: '42',
      streetName: 'Ocean Street',
      suburb: 'Bondi',
      state: 'NSW',
      postcode: '2026',
      country: 'AU',
    },
    propertyType: 'house',
    bedrooms: 4,
    bathrooms: 2,
    carSpaces: 2,
    landSize: 450,
    listingStatus: 'active',
    listPrice: 2100000,
    priceGuide: '$2,000,000 - $2,200,000',
    listingDescription: 'Stunning beachside home',
    saleType: 'auction',
    photos: [],
    floorPlans: [],
    interestedBuyerIds: [],
    assignedAgentId: '00000000-0000-0000-0000-000000000001',
    portalViews: 150,
    enquiryCount: 12,
    inspectionCount: 4,
    comparables: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function createPropertyMatch(
  overrides?: Partial<PropertyMatch & { property: Property }>,
): PropertyMatch & { property: Property } {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    propertyId: '11111111-1111-1111-1111-111111111111',
    clientBriefId: '33333333-3333-3333-3333-333333333333',
    clientId: '44444444-4444-4444-4444-444444444444',
    overallScore: 82,
    scoreBreakdown: {
      priceMatch: 85,
      locationMatch: 90,
      sizeMatch: 80,
      featureMatch: 75,
    },
    status: 'new',
    matchedAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    property: createProperty(),
    ...overrides,
  };
}

function createClientBrief(overrides?: Partial<ClientBrief>): ClientBrief {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    contactId: '44444444-4444-4444-4444-444444444444',
    purchaseType: 'owner_occupier',
    enquiryType: 'home_buyer',
    budget: {
      min: 1800000,
      max: 2200000,
      absoluteMax: 2400000,
      stampDutyBudgeted: true,
    },
    finance: {
      preApproved: true,
      preApprovalAmount: 2200000,
      preApprovalExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      lender: 'Commonwealth Bank',
      firstHomeBuyer: false,
    },
    requirements: {
      propertyTypes: ['house'],
      bedrooms: { min: 3, ideal: 4 },
      bathrooms: { min: 2 },
      carSpaces: { min: 1, ideal: 2 },
      suburbs: [
        { suburb: 'Bondi', state: 'NSW', postcode: '2026' },
        { suburb: 'Coogee', state: 'NSW', postcode: '2034' },
      ],
      mustHaves: ['pool', 'garden'],
      niceToHaves: ['ocean views', 'renovated kitchen'],
      dealBreakers: ['main road', 'flood zone'],
    },
    timeline: {
      urgency: '1_3_months',
    },
    communication: {},
    briefVersion: 1,
    clientSignedOff: true,
    createdBy: '00000000-0000-0000-0000-000000000001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  };
}

function createInspection(overrides?: Partial<Inspection>): Inspection {
  return {
    id: '55555555-5555-5555-5555-555555555555',
    propertyId: '11111111-1111-1111-1111-111111111111',
    clientId: '44444444-4444-4444-4444-444444444444',
    inspectionDate: '2026-01-12T10:00:00.000Z',
    timeSpentMinutes: 45,
    overallImpression: 'positive',
    conditionNotes: 'Property is in excellent condition with recent renovations to the kitchen and bathrooms.',
    clientSuitability: 'match',
    photos: [],
    agentNotes: 'Client loved the outdoor entertaining area and proximity to the beach.',
    createdBy: '00000000-0000-0000-0000-000000000001',
    createdAt: '2026-01-12T11:00:00.000Z',
    updatedAt: '2026-01-12T11:00:00.000Z',
    ...overrides,
  };
}

function createDueDiligenceItem(overrides?: Partial<DueDiligenceItem>): DueDiligenceItem {
  return {
    id: '66666666-6666-6666-6666-666666666666',
    checklistId: '77777777-7777-7777-7777-777777777777',
    category: 'legal',
    name: 'Title Search',
    description: 'Verify property title',
    status: 'completed',
    assignedTo: 'solicitor',
    documents: [],
    isCritical: true,
    isBlocking: false,
    sortOrder: 1,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-14T00:00:00.000Z',
    ...overrides,
  };
}

function createDueDiligenceChecklist(
  overrides?: Partial<DueDiligenceChecklist & { items: DueDiligenceItem[] }>,
): DueDiligenceChecklist & { items: DueDiligenceItem[] } {
  return {
    id: '77777777-7777-7777-7777-777777777777',
    transactionId: '88888888-8888-8888-8888-888888888888',
    state: 'NSW',
    propertyType: 'house',
    completionPercentage: 50,
    status: 'in_progress',
    createdBy: '00000000-0000-0000-0000-000000000001',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-14T00:00:00.000Z',
    items: [
      createDueDiligenceItem({ status: 'completed', isCritical: true }),
      createDueDiligenceItem({
        id: '66666666-6666-6666-6666-666666666667',
        name: 'Building Inspection',
        category: 'physical',
        status: 'in_progress',
        isCritical: true,
        assignedTo: 'building_inspector',
      }),
      createDueDiligenceItem({
        id: '66666666-6666-6666-6666-666666666668',
        name: 'Pest Inspection',
        category: 'physical',
        status: 'not_started',
        isCritical: false,
        assignedTo: 'pest_inspector',
      }),
    ],
    ...overrides,
  };
}

function createKeyDate(overrides?: Partial<KeyDate>): KeyDate {
  return {
    id: '99999999-9999-9999-9999-999999999999',
    transactionId: '88888888-8888-8888-8888-888888888888',
    label: 'Cooling-off period ends',
    date: '2026-02-01T00:00:00.000Z',
    isCritical: true,
    reminderDaysBefore: [7, 3, 1],
    status: 'upcoming',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function createOffer(overrides?: Partial<Offer>): Offer {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    transactionId: '88888888-8888-8888-8888-888888888888',
    propertyId: '11111111-1111-1111-1111-111111111111',
    clientId: '44444444-4444-4444-4444-444444444444',
    saleMethod: 'private_treaty',
    status: 'submitted',
    strategyNotes: 'Offer at asking price to secure quickly',
    clientMaxPrice: 2200000,
    recommendedOffer: 2050000,
    conditions: ['finance', 'building and pest inspection'],
    settlementPeriod: 42,
    depositAmount: 105000,
    depositType: 'cash',
    createdAt: '2026-01-14T00:00:00.000Z',
    updatedAt: '2026-01-14T00:00:00.000Z',
    ...overrides,
  };
}

function createMarketSnapshot(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    suburb: 'Bondi',
    state: 'NSW',
    medianPrice: 2350000,
    medianPriceChange12m: 5.2,
    daysOnMarket: 28,
    auctionClearanceRate: 72,
    totalListings: 42,
    dataAsOf: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createDefaultDataInput(overrides?: Partial<ConsolidationDataInput>): ConsolidationDataInput {
  return {
    clientBrief: createClientBrief(),
    propertyMatches: [createPropertyMatch()],
    inspections: [createInspection()],
    dueDiligenceChecklists: [createDueDiligenceChecklist()],
    keyDates: [createKeyDate()],
    offers: [createOffer()],
    marketData: [createMarketSnapshot()],
    ...overrides,
  };
}

function createDefaultOptions(overrides?: Partial<ConsolidationOptions>): ConsolidationOptions {
  return {
    reportType: 'client_brief_summary',
    includeMarketData: true,
    includeDueDiligence: true,
    includeInspections: true,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('ResearchConsolidationEngine', () => {
  // ─── consolidate() ──────────────────────────────────────────────

  describe('consolidate()', () => {
    it('returns a complete report with all sections when all data is provided', () => {
      const data = createDefaultDataInput();
      const options = createDefaultOptions();
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.executiveSummary).toBeDefined();
      expect(result.executiveSummary.length).toBeGreaterThan(0);
      expect(result.propertyRankings).toBeDefined();
      expect(result.risks).toBeDefined();
      expect(result.recommendedActions).toBeDefined();
      expect(result.searchProgress).toBeDefined();
      expect(result.rawDataSources).toBeDefined();
    });

    it('includes market snapshots when includeMarketData is true and data exists', () => {
      const data = createDefaultDataInput();
      const options = createDefaultOptions({ includeMarketData: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.marketSnapshots).toBeDefined();
      expect(result.marketSnapshots).toHaveLength(1);
      expect(result.marketSnapshots![0]!.suburb).toBe('Bondi');
    });

    it('omits market snapshots when includeMarketData is false', () => {
      const data = createDefaultDataInput();
      const options = createDefaultOptions({ includeMarketData: false });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.marketSnapshots).toBeUndefined();
    });

    it('omits market snapshots when market data array is empty', () => {
      const data = createDefaultDataInput({ marketData: [] });
      const options = createDefaultOptions({ includeMarketData: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.marketSnapshots).toBeUndefined();
    });

    it('includes DD summary when includeDueDiligence is true and data exists', () => {
      const data = createDefaultDataInput();
      const options = createDefaultOptions({ includeDueDiligence: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.ddSummary).toBeDefined();
      expect(result.ddSummary!.totalItems).toBe(3);
      expect(result.ddSummary!.completedItems).toBe(1);
      expect(result.ddSummary!.criticalPending).toBe(1);
      expect(result.ddSummary!.completionPercent).toBe(33);
    });

    it('omits DD summary when includeDueDiligence is false', () => {
      const data = createDefaultDataInput();
      const options = createDefaultOptions({ includeDueDiligence: false });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.ddSummary).toBeUndefined();
    });

    it('filters property matches by propertyIds when specified', () => {
      const match1 = createPropertyMatch({
        id: 'match-1',
        propertyId: 'prop-1',
        overallScore: 90,
        property: createProperty({ id: 'prop-1' }),
      });
      const match2 = createPropertyMatch({
        id: 'match-2',
        propertyId: 'prop-2',
        overallScore: 70,
        property: createProperty({
          id: 'prop-2',
          address: {
            streetNumber: '10',
            streetName: 'Beach Road',
            suburb: 'Coogee',
            state: 'NSW',
            postcode: '2034',
            country: 'AU',
          },
        }),
      });

      const data = createDefaultDataInput({ propertyMatches: [match1, match2] });
      const options = createDefaultOptions({ propertyIds: ['prop-1'] });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.propertyRankings).toHaveLength(1);
      expect(result.propertyRankings![0]!.propertyId).toBe('prop-1');
    });

    it('includes all matches when propertyIds is undefined', () => {
      const match1 = createPropertyMatch({ id: 'match-1', propertyId: 'prop-1' });
      const match2 = createPropertyMatch({ id: 'match-2', propertyId: 'prop-2' });
      const data = createDefaultDataInput({ propertyMatches: [match1, match2] });
      const options = createDefaultOptions();
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.propertyRankings).toHaveLength(2);
    });
  });

  // ─── Property Rankings ──────────────────────────────────────────

  describe('property rankings', () => {
    it('sorts properties by overallScore descending (highest rank first)', () => {
      const highScoreMatch = createPropertyMatch({
        id: 'high',
        propertyId: 'prop-high',
        overallScore: 95,
        property: createProperty({ id: 'prop-high' }),
      });
      const lowScoreMatch = createPropertyMatch({
        id: 'low',
        propertyId: 'prop-low',
        overallScore: 55,
        property: createProperty({ id: 'prop-low' }),
      });
      const midScoreMatch = createPropertyMatch({
        id: 'mid',
        propertyId: 'prop-mid',
        overallScore: 75,
        property: createProperty({ id: 'prop-mid' }),
      });

      const data = createDefaultDataInput({
        propertyMatches: [lowScoreMatch, highScoreMatch, midScoreMatch],
      });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.rank).toBe(1);
      expect(result.propertyRankings![0]!.overallScore).toBe(95);
      expect(result.propertyRankings![1]!.rank).toBe(2);
      expect(result.propertyRankings![1]!.overallScore).toBe(75);
      expect(result.propertyRankings![2]!.rank).toBe(3);
      expect(result.propertyRankings![2]!.overallScore).toBe(55);
    });

    it('formats Australian addresses correctly', () => {
      const match = createPropertyMatch({
        property: createProperty({
          address: {
            streetNumber: '42',
            streetName: 'Ocean Street',
            suburb: 'Bondi',
            state: 'NSW',
            postcode: '2026',
            country: 'AU',
          },
        }),
      });

      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.address).toBe('42 Ocean Street, Bondi NSW 2026');
    });

    it('formats unit addresses with unit number prefix', () => {
      const match = createPropertyMatch({
        property: createProperty({
          address: {
            unitNumber: '15',
            streetNumber: '28',
            streetName: 'Campbell Street',
            suburb: 'Surry Hills',
            state: 'NSW',
            postcode: '2010',
            country: 'AU',
          },
        }),
      });

      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.address).toBe('15/28 Campbell Street, Surry Hills NSW 2010');
    });

    it('includes inspection summary when inspection exists for property', () => {
      const match = createPropertyMatch();
      const inspection = createInspection({ propertyId: match.propertyId });
      const data = createDefaultDataInput({
        propertyMatches: [match],
        inspections: [inspection],
      });

      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.inspectionSummary).toBeDefined();
      expect(result.propertyRankings![0]!.inspectionSummary).toContain('positive');
      expect(result.propertyRankings![0]!.inspectionSummary).toContain('match');
    });

    it('omits inspection summary when no inspection exists for property', () => {
      const match = createPropertyMatch();
      const data = createDefaultDataInput({
        propertyMatches: [match],
        inspections: [],
      });

      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.inspectionSummary).toBeUndefined();
    });
  });

  // ─── Pros and Cons Identification ────────────────────────────────

  describe('pros and cons identification', () => {
    it('identifies "Within budget range" when priceMatch >= 80', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 85, locationMatch: 60, sizeMatch: 60, featureMatch: 50 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.pros).toContain('Within budget range');
    });

    it('identifies "Price is ideal for budget" when priceMatch is 100', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 100, locationMatch: 60, sizeMatch: 60, featureMatch: 50 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.pros).toContain('Price is ideal for budget');
    });

    it('identifies "In preferred suburb" when locationMatch >= 80', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 50, locationMatch: 90, sizeMatch: 60, featureMatch: 50 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.pros).toContain('In preferred suburb');
    });

    it('identifies "Strong investment potential" when investorMatch >= 70', () => {
      const match = createPropertyMatch({
        scoreBreakdown: {
          priceMatch: 50,
          locationMatch: 50,
          sizeMatch: 50,
          featureMatch: 50,
          investorMatch: 80,
        },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.pros).toContain('Strong investment potential');
    });

    it('identifies "Top-tier overall match" when overallScore >= 85', () => {
      const match = createPropertyMatch({ overallScore: 90 });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.pros).toContain('Top-tier overall match');
    });

    it('identifies "Over budget" when priceMatch < 50', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 30, locationMatch: 80, sizeMatch: 80, featureMatch: 70 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.cons).toContain('Over budget');
    });

    it('identifies "Significantly over budget" when priceMatch is 0', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 0, locationMatch: 80, sizeMatch: 80, featureMatch: 70 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.cons).toContain('Significantly over budget');
    });

    it('identifies "Missing key features" when featureMatch < 40', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 80, locationMatch: 80, sizeMatch: 80, featureMatch: 30 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.cons).toContain('Missing key features');
    });

    it('returns no cons for a property with all high scores', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 90, locationMatch: 90, sizeMatch: 90, featureMatch: 80 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.cons).toHaveLength(0);
    });
  });

  // ─── Property Recommendations ────────────────────────────────────

  describe('property recommendations', () => {
    it('strongly recommends properties with overallScore >= 85', () => {
      const match = createPropertyMatch({ overallScore: 90 });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.recommendation).toContain('Strongly recommend');
    });

    it('recommends inspection for scores 70-84 with no cons', () => {
      const match = createPropertyMatch({
        overallScore: 78,
        scoreBreakdown: { priceMatch: 80, locationMatch: 80, sizeMatch: 80, featureMatch: 70 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.recommendation).toContain('Worth inspecting');
    });

    it('includes caveat for scores 70-84 with cons', () => {
      const match = createPropertyMatch({
        overallScore: 72,
        scoreBreakdown: { priceMatch: 40, locationMatch: 80, sizeMatch: 80, featureMatch: 70 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.recommendation).toContain('Good prospect with caveats');
    });

    it('marks marginal match for scores 50-69', () => {
      const match = createPropertyMatch({ overallScore: 55 });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.recommendation).toContain('Marginal match');
    });

    it('does not recommend properties with overallScore < 50', () => {
      const match = createPropertyMatch({ overallScore: 35 });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.recommendation).toContain('Not recommended');
    });
  });

  // ─── Risk Assessment ──────────────────────────────────────────────

  describe('risk assessment', () => {
    it('flags financial risk when properties exceed maximum budget (priceMatch === 0)', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 0, locationMatch: 80, sizeMatch: 80, featureMatch: 70 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const financialRisks = result.risks!.filter((r) => r.category === 'financial');
      expect(financialRisks.some((r) => r.description.includes('exceed the maximum budget'))).toBe(true);
      expect(financialRisks[0]!.severity).toBe('high');
    });

    it('does not flag budget risk when no properties are at priceMatch 0', () => {
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 60, locationMatch: 80, sizeMatch: 80, featureMatch: 70 },
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const budgetRisks = result.risks!.filter(
        (r) => r.category === 'financial' && r.description.includes('exceed'),
      );
      expect(budgetRisks).toHaveLength(0);
    });

    it('flags high-severity risk when pre-approval expires within 7 days', () => {
      const brief = createClientBrief();
      brief.finance = {
        ...brief.finance,
        preApproved: true,
        preApprovalExpiry: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const expiryRisks = result.risks!.filter((r) => r.description.includes('Pre-approval expires'));
      expect(expiryRisks).toHaveLength(1);
      expect(expiryRisks[0]!.severity).toBe('high');
    });

    it('flags medium-severity risk when pre-approval expires in 8-30 days', () => {
      const brief = createClientBrief();
      brief.finance = {
        ...brief.finance,
        preApproved: true,
        preApprovalExpiry: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const expiryRisks = result.risks!.filter((r) => r.description.includes('Pre-approval expires'));
      expect(expiryRisks).toHaveLength(1);
      expect(expiryRisks[0]!.severity).toBe('medium');
    });

    it('does not flag pre-approval risk when expiry is more than 30 days away', () => {
      const brief = createClientBrief();
      brief.finance = {
        ...brief.finance,
        preApproved: true,
        preApprovalExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const expiryRisks = result.risks!.filter((r) => r.description.includes('Pre-approval'));
      expect(expiryRisks).toHaveLength(0);
    });

    it('flags legal risk when critical DD items are pending', () => {
      const checklist = createDueDiligenceChecklist({
        items: [
          createDueDiligenceItem({ status: 'in_progress', isCritical: true }),
          createDueDiligenceItem({ status: 'completed', isCritical: true }),
        ],
      });
      const data = createDefaultDataInput({ dueDiligenceChecklists: [checklist] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const legalRisks = result.risks!.filter((r) => r.category === 'legal');
      expect(legalRisks.some((r) => r.description.includes('critical due diligence'))).toBe(true);
    });

    it('flags timeline risk when key dates are overdue', () => {
      const overdueDate = createKeyDate({ status: 'overdue' });
      const data = createDefaultDataInput({ keyDates: [overdueDate] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const timelineRisks = result.risks!.filter(
        (r) => r.category === 'timeline' && r.severity === 'high',
      );
      expect(timelineRisks.some((r) => r.description.includes('overdue'))).toBe(true);
    });

    it('flags medium-severity timeline risk for approaching key dates', () => {
      const dueSoonDate = createKeyDate({ status: 'due_soon' });
      const data = createDefaultDataInput({ keyDates: [dueSoonDate] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const timelineRisks = result.risks!.filter(
        (r) => r.category === 'timeline' && r.severity === 'medium',
      );
      expect(timelineRisks.some((r) => r.description.includes('approaching'))).toBe(true);
    });

    it('flags market risk when urgency is ASAP but no matches found', () => {
      const brief = createClientBrief();
      brief.timeline = { urgency: 'asap' };
      const data = createDefaultDataInput({ clientBrief: brief, propertyMatches: [] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const marketRisks = result.risks!.filter((r) => r.category === 'market');
      expect(marketRisks.some((r) => r.description.includes('Urgent search'))).toBe(true);
    });

    it('returns empty risks array when there are no risk conditions', () => {
      const brief = createClientBrief();
      brief.finance = { preApproved: false, firstHomeBuyer: false };
      brief.timeline = { urgency: 'no_rush' };
      const match = createPropertyMatch({
        scoreBreakdown: { priceMatch: 80, locationMatch: 80, sizeMatch: 80, featureMatch: 70 },
      });
      const data = createDefaultDataInput({
        clientBrief: brief,
        propertyMatches: [match],
        dueDiligenceChecklists: [],
        keyDates: [],
      });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.risks).toHaveLength(0);
    });
  });

  // ─── Recommended Actions ──────────────────────────────────────────

  describe('recommended actions', () => {
    it('recommends reviewing high-scoring new matches', () => {
      const match = createPropertyMatch({ status: 'new', overallScore: 85 });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const reviewActions = result.recommendedActions!.filter(
        (a) => a.action.includes('high-scoring'),
      );
      expect(reviewActions).toHaveLength(1);
      expect(reviewActions[0]!.priority).toBe('high');
      expect(reviewActions[0]!.assignee).toBe('agent');
    });

    it('does not recommend review for new matches below score 75', () => {
      const match = createPropertyMatch({ status: 'new', overallScore: 60 });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const reviewActions = result.recommendedActions!.filter(
        (a) => a.action.includes('high-scoring'),
      );
      expect(reviewActions).toHaveLength(0);
    });

    it('recommends attending scheduled inspections', () => {
      const match = createPropertyMatch({ status: 'inspection_booked' });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const inspectionActions = result.recommendedActions!.filter(
        (a) => a.action.includes('inspections to attend'),
      );
      expect(inspectionActions).toHaveLength(1);
    });

    it('recommends offer strategy for client-interested properties', () => {
      const match = createPropertyMatch({ status: 'client_interested' });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const offerActions = result.recommendedActions!.filter(
        (a) => a.action.includes('offer strategy'),
      );
      expect(offerActions).toHaveLength(1);
    });

    it('recommends following up on active offers (submitted or countered)', () => {
      const submittedOffer = createOffer({ status: 'submitted' });
      const counteredOffer = createOffer({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'countered',
      });
      const data = createDefaultDataInput({ offers: [submittedOffer, counteredOffer] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const followUpActions = result.recommendedActions!.filter(
        (a) => a.action.includes('active offers'),
      );
      expect(followUpActions).toHaveLength(1);
      expect(followUpActions[0]!.action).toContain('2');
    });

    it('recommends pre-approval renewal when expiry is within 30 days', () => {
      const brief = createClientBrief();
      brief.finance = {
        ...brief.finance,
        preApproved: true,
        preApprovalExpiry: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const renewalActions = result.recommendedActions!.filter(
        (a) => a.action.includes('pre-approval renewal'),
      );
      expect(renewalActions).toHaveLength(1);
      expect(renewalActions[0]!.assignee).toBe('client');
    });

    it('recommends client sign-off when brief is not signed off', () => {
      const brief = createClientBrief();
      brief.clientSignedOff = false;
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const signOffActions = result.recommendedActions!.filter(
        (a) => a.action.includes('sign-off'),
      );
      expect(signOffActions).toHaveLength(1);
    });

    it('recommends gathering market data when none exists but suburbs are specified', () => {
      const data = createDefaultDataInput({ marketData: [] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      const marketActions = result.recommendedActions!.filter(
        (a) => a.action.includes('market data'),
      );
      expect(marketActions).toHaveLength(1);
    });
  });

  // ─── Search Progress ──────────────────────────────────────────────

  describe('search progress', () => {
    it('returns correct counts for properties, inspections, and offers', () => {
      const data = createDefaultDataInput({
        propertyMatches: [createPropertyMatch(), createPropertyMatch({ id: 'match-2' })],
        inspections: [createInspection()],
        offers: [createOffer(), createOffer({ id: 'offer-2' })],
      });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.searchProgress!.propertiesReviewed).toBe(2);
      expect(result.searchProgress!.inspectionsCompleted).toBe(1);
      expect(result.searchProgress!.offersMade).toBe(2);
    });

    it('calculates days in search from brief creation date', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const brief = createClientBrief();
      brief.createdAt = tenDaysAgo;
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.searchProgress!.daysInSearch).toBeGreaterThanOrEqual(9);
      expect(result.searchProgress!.daysInSearch).toBeLessThanOrEqual(11);
    });

    it('returns 0 days for a brief created today', () => {
      const brief = createClientBrief();
      brief.createdAt = new Date().toISOString();
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.searchProgress!.daysInSearch).toBe(0);
    });
  });

  // ─── Due Diligence Summary ──────────────────────────────────────

  describe('DD summary', () => {
    it('calculates completion percentage correctly', () => {
      const checklist = createDueDiligenceChecklist({
        items: [
          createDueDiligenceItem({ status: 'completed' }),
          createDueDiligenceItem({ id: 'item-2', status: 'completed' }),
          createDueDiligenceItem({ id: 'item-3', status: 'in_progress' }),
          createDueDiligenceItem({ id: 'item-4', status: 'not_started' }),
        ],
      });
      const data = createDefaultDataInput({ dueDiligenceChecklists: [checklist] });
      const options = createDefaultOptions({ includeDueDiligence: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.ddSummary!.totalItems).toBe(4);
      expect(result.ddSummary!.completedItems).toBe(2);
      expect(result.ddSummary!.completionPercent).toBe(50);
    });

    it('returns 0% completion when no items are completed', () => {
      const checklist = createDueDiligenceChecklist({
        items: [
          createDueDiligenceItem({ status: 'not_started' }),
          createDueDiligenceItem({ id: 'item-2', status: 'in_progress' }),
        ],
      });
      const data = createDefaultDataInput({ dueDiligenceChecklists: [checklist] });
      const options = createDefaultOptions({ includeDueDiligence: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.ddSummary!.completionPercent).toBe(0);
    });

    it('handles empty items array returning 0% completion', () => {
      const checklist = createDueDiligenceChecklist({ items: [] });
      const data = createDefaultDataInput({ dueDiligenceChecklists: [checklist] });
      const options = createDefaultOptions({ includeDueDiligence: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.ddSummary!.completionPercent).toBe(0);
      expect(result.ddSummary!.totalItems).toBe(0);
    });

    it('counts critical pending items across multiple checklists', () => {
      const checklist1 = createDueDiligenceChecklist({
        id: 'cl-1',
        items: [createDueDiligenceItem({ status: 'in_progress', isCritical: true })],
      });
      const checklist2 = createDueDiligenceChecklist({
        id: 'cl-2',
        items: [
          createDueDiligenceItem({ id: 'item-a', status: 'not_started', isCritical: true }),
          createDueDiligenceItem({ id: 'item-b', status: 'completed', isCritical: true }),
        ],
      });
      const data = createDefaultDataInput({
        dueDiligenceChecklists: [checklist1, checklist2],
      });
      const options = createDefaultOptions({ includeDueDiligence: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.ddSummary!.criticalPending).toBe(2);
    });
  });

  // ─── Executive Summary ──────────────────────────────────────────

  describe('executive summary', () => {
    it('includes target suburbs in the summary', () => {
      const data = createDefaultDataInput();
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.executiveSummary).toContain('Bondi');
      expect(result.executiveSummary).toContain('Coogee');
    });

    it('includes count of strong matches (score >= 75)', () => {
      const highMatch = createPropertyMatch({ id: 'm1', overallScore: 85 });
      const lowMatch = createPropertyMatch({ id: 'm2', overallScore: 50 });
      const data = createDefaultDataInput({ propertyMatches: [highMatch, lowMatch] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.executiveSummary).toContain('1 strong matches');
    });

    it('includes inspection count when inspections exist', () => {
      const data = createDefaultDataInput({
        inspections: [createInspection(), createInspection({ id: 'insp-2' })],
      });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.executiveSummary).toContain('2 inspections completed');
    });

    it('includes active offer count when offers are submitted or countered', () => {
      const data = createDefaultDataInput({
        offers: [createOffer({ status: 'submitted' })],
      });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.executiveSummary).toContain('1 active offers');
    });

    it('indicates urgency when client timeline is ASAP', () => {
      const brief = createClientBrief();
      brief.timeline = { urgency: 'asap' };
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.executiveSummary).toContain('urgent');
    });

    it('falls back to "target suburbs" when no suburbs are specified', () => {
      const brief = createClientBrief();
      brief.requirements = {
        ...brief.requirements,
        suburbs: [],
      };
      const data = createDefaultDataInput({ clientBrief: brief });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.executiveSummary).toContain('target suburbs');
    });
  });

  // ─── Data Sources ─────────────────────────────────────────────────

  describe('data sources listing', () => {
    it('always includes client_brief and property_matches', () => {
      const data = createDefaultDataInput({
        inspections: [],
        dueDiligenceChecklists: [],
        offers: [],
        keyDates: [],
        marketData: [],
      });
      const options = createDefaultOptions({
        includeInspections: false,
        includeDueDiligence: false,
        includeMarketData: false,
      });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.rawDataSources).toContain('client_brief');
      expect(result.rawDataSources).toContain('property_matches');
    });

    it('includes inspections source when option is enabled and data exists', () => {
      const data = createDefaultDataInput();
      const options = createDefaultOptions({ includeInspections: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.rawDataSources).toContain('inspections');
    });

    it('includes due_diligence source when option is enabled and data exists', () => {
      const data = createDefaultDataInput();
      const options = createDefaultOptions({ includeDueDiligence: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.rawDataSources).toContain('due_diligence');
    });

    it('includes market_data source when option is enabled and data exists', () => {
      const data = createDefaultDataInput();
      const options = createDefaultOptions({ includeMarketData: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.rawDataSources).toContain('market_data');
    });

    it('includes offers and key_dates sources when data exists', () => {
      const data = createDefaultDataInput();
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.rawDataSources).toContain('offers');
      expect(result.rawDataSources).toContain('key_dates');
    });
  });

  // ─── Convenience Methods ──────────────────────────────────────────

  describe('convenience methods', () => {
    it('consolidateBriefSummary includes market data and inspections but not DD', () => {
      const data = createDefaultDataInput();
      const result = ResearchConsolidationEngine.consolidateBriefSummary(data);

      expect(result.marketSnapshots).toBeDefined();
      expect(result.ddSummary).toBeUndefined();
      expect(result.rawDataSources).toContain('inspections');
    });

    it('consolidatePropertyComparison filters to specified property IDs', () => {
      const match1 = createPropertyMatch({ propertyId: 'prop-a', property: createProperty({ id: 'prop-a' }) });
      const match2 = createPropertyMatch({ propertyId: 'prop-b', property: createProperty({ id: 'prop-b' }) });
      const data = createDefaultDataInput({ propertyMatches: [match1, match2] });
      const result = ResearchConsolidationEngine.consolidatePropertyComparison(data, ['prop-a']);

      expect(result.propertyRankings).toHaveLength(1);
      expect(result.propertyRankings![0]!.propertyId).toBe('prop-a');
      expect(result.ddSummary).toBeDefined();
    });

    it('consolidateSearchProgress includes market data and inspections', () => {
      const data = createDefaultDataInput();
      const result = ResearchConsolidationEngine.consolidateSearchProgress(data);

      expect(result.searchProgress).toBeDefined();
      expect(result.marketSnapshots).toBeDefined();
    });

    it('consolidateDDSummary includes DD but not market data or inspections', () => {
      const data = createDefaultDataInput();
      const result = ResearchConsolidationEngine.consolidateDDSummary(data);

      expect(result.ddSummary).toBeDefined();
      expect(result.marketSnapshots).toBeUndefined();
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty data input gracefully', () => {
      const data = createDefaultDataInput({
        propertyMatches: [],
        inspections: [],
        dueDiligenceChecklists: [],
        keyDates: [],
        offers: [],
        marketData: [],
      });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.executiveSummary).toBeDefined();
      expect(result.propertyRankings).toHaveLength(0);
      expect(result.searchProgress!.propertiesReviewed).toBe(0);
    });

    it('handles Australian property data with AUD prices', () => {
      const match = createPropertyMatch({
        property: createProperty({
          listPrice: 2150000,
          priceGuide: '$2,100,000 - $2,300,000',
          address: {
            streetNumber: '7',
            streetName: 'Harbour View Drive',
            suburb: 'Mosman',
            state: 'NSW',
            postcode: '2088',
            country: 'AU',
          },
        }),
      });
      const data = createDefaultDataInput({ propertyMatches: [match] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      expect(result.propertyRankings![0]!.address).toBe('7 Harbour View Drive, Mosman NSW 2088');
    });

    it('handles multiple market snapshots for different suburbs', () => {
      const bondiSnapshot = createMarketSnapshot({ suburb: 'Bondi', medianPrice: 2350000 });
      const coogeeSnapshot = createMarketSnapshot({ suburb: 'Coogee', medianPrice: 1950000 });
      const data = createDefaultDataInput({ marketData: [bondiSnapshot, coogeeSnapshot] });
      const options = createDefaultOptions({ includeMarketData: true });
      const result = ResearchConsolidationEngine.consolidate(data, options);

      expect(result.marketSnapshots).toHaveLength(2);
    });

    it('truncates long condition and agent notes in inspection summary', () => {
      const longNotes = 'A'.repeat(200);
      const inspection = createInspection({
        conditionNotes: longNotes,
        agentNotes: longNotes,
      });
      const data = createDefaultDataInput({ inspections: [inspection] });
      const result = ResearchConsolidationEngine.consolidate(data, createDefaultOptions());

      // The summarizeInspection method truncates to 100 chars per field
      const summary = result.propertyRankings![0]!.inspectionSummary!;
      expect(summary.length).toBeLessThan(longNotes.length * 2);
    });
  });
});
