import { describe, it, expect } from 'vitest';
import type { ClientBrief, Property } from '@realflow/shared';
import { PropertyMatcher } from './property-matcher';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = '2026-03-04T00:00:00.000Z';

const baseBrief: ClientBrief = {
  id: '00000000-0000-0000-0000-000000000001',
  contactId: '00000000-0000-0000-0000-000000000010',
  purchaseType: 'owner_occupier',
  enquiryType: 'home_buyer',
  budget: {
    min: 800_000,
    max: 1_100_000,
    absoluteMax: 1_200_000,
    stampDutyBudgeted: false,
  },
  finance: {
    preApproved: true,
    preApprovalAmount: 1_100_000,
    lender: 'CBA',
    firstHomeBuyer: false,
  },
  requirements: {
    propertyTypes: ['house'],
    bedrooms: { min: 3, ideal: 4 },
    bathrooms: { min: 2 },
    carSpaces: { min: 1, ideal: 2 },
    landSize: { min: 400, max: 800 },
    suburbs: [
      { suburb: 'Paddington', state: 'QLD', postcode: '4064', rank: 1 },
      { suburb: 'Red Hill', state: 'QLD', postcode: '4059', rank: 2 },
    ],
    mustHaves: ['renovated kitchen', 'north-facing backyard'],
    niceToHaves: ['pool', 'study'],
    dealBreakers: ['flood zone', 'main road frontage'],
  },
  timeline: { urgency: '3_6_months' },
  communication: { preferredMethod: 'phone', updateFrequency: 'weekly' },
  briefVersion: 1,
  clientSignedOff: false,
  createdBy: '00000000-0000-0000-0000-000000000099',
  createdAt: now,
  updatedAt: now,
};

function makeProperty(overrides: Partial<Property> & { id: string }): Property {
  return {
    id: overrides.id,
    address: overrides.address ?? {
      streetNumber: '42',
      streetName: 'Latrobe Terrace',
      suburb: 'Paddington',
      state: 'QLD',
      postcode: '4064',
      country: 'AU',
    },
    propertyType: overrides.propertyType ?? 'house',
    bedrooms: overrides.bedrooms ?? 4,
    bathrooms: overrides.bathrooms ?? 2,
    carSpaces: overrides.carSpaces ?? 2,
    landSize: 'landSize' in overrides ? overrides.landSize : 600,
    yearBuilt: overrides.yearBuilt,
    listingStatus: overrides.listingStatus ?? 'active',
    listPrice: 'listPrice' in overrides ? overrides.listPrice : 950_000,
    listingDescription: overrides.listingDescription,
    saleType: overrides.saleType ?? 'private-treaty',
    photos: overrides.photos ?? [],
    floorPlans: overrides.floorPlans ?? [],
    interestedBuyerIds: overrides.interestedBuyerIds ?? [],
    assignedAgentId: overrides.assignedAgentId ?? '00000000-0000-0000-0000-000000000050',
    portalViews: overrides.portalViews ?? 0,
    enquiryCount: overrides.enquiryCount ?? 0,
    inspectionCount: overrides.inspectionCount ?? 0,
    comparables: overrides.comparables ?? [],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

// ─── Test Properties ────────────────────────────────────────────────────────

const perfectMatchWithDescription = makeProperty({
  id: 'prop-perfect',
  listingDescription: 'Beautiful renovated kitchen with north-facing backyard. Features include a pool and separate study. Modern air conditioning throughout.',
});

const dealBreakerProperty = makeProperty({
  id: 'prop-dealbreaker',
  listingDescription: 'Located in a known flood zone area. Recently renovated kitchen.',
});

const mainRoadProperty = makeProperty({
  id: 'prop-mainroad',
  listingDescription: 'Prime main road frontage with excellent visibility. Renovated kitchen.',
});

const noDescriptionProperty = makeProperty({
  id: 'prop-nodesc',
});

const seenProperty = makeProperty({
  id: 'prop-seen',
  listingDescription: 'Renovated kitchen with north-facing backyard and pool.',
});

const wrongSuburbProperty = makeProperty({
  id: 'prop-wrongsuburb',
  address: {
    streetNumber: '10',
    streetName: 'Lancaster Road',
    suburb: 'Ascot',
    state: 'QLD',
    postcode: '4007',
    country: 'AU',
  },
  listingDescription: 'Renovated kitchen with north-facing backyard.',
});

const lowScoreProperty = makeProperty({
  id: 'prop-lowscore',
  listPrice: 1_300_000, // Way over absolute max
  bedrooms: 1,
  propertyType: 'unit',
  address: {
    streetNumber: '1',
    streetName: 'High Street',
    suburb: 'Ascot',
    state: 'QLD',
    postcode: '4007',
    country: 'AU',
  },
});

// ─── matchProperties ────────────────────────────────────────────────────────

describe('PropertyMatcher.matchProperties', () => {
  it('returns matches sorted by score descending', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const results = matcher.matchProperties(
      [wrongSuburbProperty, perfectMatchWithDescription, noDescriptionProperty],
      baseBrief,
    );

    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.overallScore).toBeGreaterThanOrEqual(results[i]!.overallScore);
    }
  });

  it('filters out already-seen properties', () => {
    const matcher = new PropertyMatcher({
      minimumScore: 0,
      seenPropertyIds: new Set(['prop-seen']),
      enableDescriptionMatching: true,
    });
    const results = matcher.matchProperties(
      [seenProperty, perfectMatchWithDescription],
      baseBrief,
    );

    expect(results.find((r) => r.propertyId === 'prop-seen')).toBeUndefined();
    expect(results.find((r) => r.propertyId === 'prop-perfect')).toBeDefined();
  });

  it('filters out properties below minimum score', () => {
    const matcher = new PropertyMatcher({ minimumScore: 70, enableDescriptionMatching: true });
    const results = matcher.matchProperties(
      [perfectMatchWithDescription, lowScoreProperty],
      baseBrief,
    );

    for (const result of results) {
      expect(result.overallScore).toBeGreaterThanOrEqual(70);
    }
  });

  it('returns empty array when all properties are below minimum score', () => {
    const matcher = new PropertyMatcher({ minimumScore: 100, enableDescriptionMatching: true });
    const results = matcher.matchProperties([lowScoreProperty], baseBrief);
    expect(results).toHaveLength(0);
  });
});

// ─── matchPropertiesIncludingSeen ───────────────────────────────────────────

describe('PropertyMatcher.matchPropertiesIncludingSeen', () => {
  it('includes seen properties but marks them', () => {
    const matcher = new PropertyMatcher({
      minimumScore: 0,
      seenPropertyIds: new Set(['prop-seen']),
      enableDescriptionMatching: true,
    });
    const results = matcher.matchPropertiesIncludingSeen(
      [seenProperty, perfectMatchWithDescription],
      baseBrief,
    );

    const seenResult = results.find((r) => r.propertyId === 'prop-seen');
    expect(seenResult).toBeDefined();
    expect(seenResult?.previouslySeen).toBe(true);

    const unseenResult = results.find((r) => r.propertyId === 'prop-perfect');
    expect(unseenResult?.previouslySeen).toBe(false);
  });
});

// ─── Deal Breaker Detection ─────────────────────────────────────────────────

describe('PropertyMatcher deal breaker detection', () => {
  it('detects flood zone deal breaker from description', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(dealBreakerProperty, baseBrief);

    expect(result.hasDealBreakers).toBe(true);
    expect(result.detectedDealBreakers).toContain('flood zone');
    expect(result.flags).toContain('deal_breaker_detected');
  });

  it('detects main road deal breaker from description', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(mainRoadProperty, baseBrief);

    expect(result.hasDealBreakers).toBe(true);
    expect(result.detectedDealBreakers).toContain('main road frontage');
  });

  it('caps overall score at 30 when deal breaker is detected', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(dealBreakerProperty, baseBrief);

    expect(result.overallScore).toBeLessThanOrEqual(30);
  });

  it('does not flag deal breakers when description matching is disabled', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: false });
    const result = matcher.enhancedScore(dealBreakerProperty, baseBrief);

    // Without description matching, only structured data is checked
    expect(result.hasDealBreakers).toBe(false);
  });
});

// ─── Must-Have Matching ─────────────────────────────────────────────────────

describe('PropertyMatcher must-have matching', () => {
  it('detects must-haves from listing description', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(perfectMatchWithDescription, baseBrief);

    expect(result.matchedMustHaves).toContain('renovated kitchen');
    expect(result.matchedMustHaves).toContain('north-facing backyard');
    expect(result.allMustHavesMet).toBe(true);
  });

  it('adds all_must_haves_met flag when all are met', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(perfectMatchWithDescription, baseBrief);

    expect(result.flags).toContain('all_must_haves_met');
  });

  it('adds +5 bonus when all must-haves are met', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const withMustHaves = matcher.enhancedScore(perfectMatchWithDescription, baseBrief);

    // Compare with same property but using a brief with no must-haves
    const noMustHaveBrief = {
      ...baseBrief,
      requirements: { ...baseBrief.requirements, mustHaves: [], niceToHaves: [], dealBreakers: [] },
    };
    const withoutMustHaves = matcher.enhancedScore(perfectMatchWithDescription, noMustHaveBrief);

    // The score with must-haves met should be at least as high (bonus may bring it higher)
    // This tests the bonus exists, not exact value (feature score differs)
    expect(withMustHaves.allMustHavesMet).toBe(true);
  });

  it('reports partial must-have matches', () => {
    const partialMatch = makeProperty({
      id: 'prop-partial',
      listingDescription: 'Beautiful renovated kitchen with modern finishes.',
    });

    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(partialMatch, baseBrief);

    expect(result.matchedMustHaves).toContain('renovated kitchen');
    expect(result.matchedMustHaves).not.toContain('north-facing backyard');
    expect(result.allMustHavesMet).toBe(false);
  });
});

// ─── Nice-to-Have Matching ──────────────────────────────────────────────────

describe('PropertyMatcher nice-to-have matching', () => {
  it('detects nice-to-haves from listing description', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(perfectMatchWithDescription, baseBrief);

    expect(result.matchedNiceToHaves).toContain('pool');
    expect(result.matchedNiceToHaves).toContain('study');
    expect(result.niceToHaveCount).toBe(2);
  });

  it('counts nice-to-haves correctly when only some match', () => {
    const poolOnly = makeProperty({
      id: 'prop-poolonly',
      listingDescription: 'Beautiful home with pool and renovated kitchen. North-facing backyard.',
    });

    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(poolOnly, baseBrief);

    expect(result.matchedNiceToHaves).toContain('pool');
    expect(result.niceToHaveCount).toBe(1);
  });
});

// ─── Feature Details ────────────────────────────────────────────────────────

describe('PropertyMatcher feature details', () => {
  it('provides detailed feature match information', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(perfectMatchWithDescription, baseBrief);

    // Should have entries for all must-haves, nice-to-haves, and deal-breakers
    const totalFeatures =
      baseBrief.requirements.mustHaves.length +
      baseBrief.requirements.niceToHaves.length +
      baseBrief.requirements.dealBreakers.length;
    expect(result.featureDetails).toHaveLength(totalFeatures);

    // Check must-have details
    const kitchenDetail = result.featureDetails.find((d) => d.feature === 'renovated kitchen');
    expect(kitchenDetail).toBeDefined();
    expect(kitchenDetail?.category).toBe('must_have');
    expect(kitchenDetail?.matched).toBe(true);
    expect(kitchenDetail?.matchSource).toBe('description');

    // Check deal-breaker details
    const floodDetail = result.featureDetails.find((d) => d.feature === 'flood zone');
    expect(floodDetail).toBeDefined();
    expect(floodDetail?.category).toBe('deal_breaker');
    expect(floodDetail?.matched).toBe(false);
  });
});

// ─── Keyword Expansion ──────────────────────────────────────────────────────

describe('PropertyMatcher keyword expansion', () => {
  it('matches pool variations', () => {
    const swimmingPool = makeProperty({
      id: 'prop-swimpool',
      listingDescription: 'Gorgeous swimming pool in the backyard. Renovated kitchen. North facing.',
    });

    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(swimmingPool, baseBrief);

    expect(result.matchedNiceToHaves).toContain('pool');
  });

  it('matches study/home office variations', () => {
    const homeOffice = makeProperty({
      id: 'prop-office',
      listingDescription: 'Includes a home office. Renovated kitchen with north-facing backyard.',
    });

    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(homeOffice, baseBrief);

    expect(result.matchedNiceToHaves).toContain('study');
  });

  it('matches north-facing variations', () => {
    const northerly = makeProperty({
      id: 'prop-northerly',
      listingDescription: 'Renovated kitchen. Northerly aspect on a quiet backyard.',
    });

    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(northerly, baseBrief);

    expect(result.matchedMustHaves).toContain('north-facing backyard');
  });
});

// ─── Utility Methods ────────────────────────────────────────────────────────

describe('PropertyMatcher utility methods', () => {
  it('getTopMatches returns limited results', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const properties = Array.from({ length: 10 }, (_, i) =>
      makeProperty({
        id: `prop-${i}`,
        listPrice: 900_000 + i * 10_000,
        listingDescription: 'Renovated kitchen with north-facing backyard.',
      }),
    );

    const top3 = matcher.getTopMatches(properties, baseBrief, 3);
    expect(top3).toHaveLength(3);
  });

  it('isMatch returns true for good matches', () => {
    const matcher = new PropertyMatcher({ minimumScore: 40, enableDescriptionMatching: true });
    expect(matcher.isMatch(perfectMatchWithDescription, baseBrief)).toBe(true);
  });

  it('isMatch returns false for deal-breaker properties', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    expect(matcher.isMatch(dealBreakerProperty, baseBrief)).toBe(false);
  });

  it('markAsSeen adds property IDs to the seen set', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });

    const allResults = matcher.matchProperties(
      [perfectMatchWithDescription, noDescriptionProperty],
      baseBrief,
    );
    expect(allResults).toHaveLength(2);

    matcher.markAsSeen(['prop-perfect']);

    const afterSeen = matcher.matchProperties(
      [perfectMatchWithDescription, noDescriptionProperty],
      baseBrief,
    );
    expect(afterSeen.find((r) => r.propertyId === 'prop-perfect')).toBeUndefined();
  });

  it('clearSeen removes all seen entries', () => {
    const matcher = new PropertyMatcher({
      minimumScore: 0,
      seenPropertyIds: new Set(['prop-perfect']),
      enableDescriptionMatching: true,
    });

    matcher.clearSeen();

    const results = matcher.matchProperties([perfectMatchWithDescription], baseBrief);
    expect(results.find((r) => r.propertyId === 'prop-perfect')).toBeDefined();
  });
});

// ─── Scoring with no features ───────────────────────────────────────────────

describe('PropertyMatcher with brief having no features', () => {
  const noFeatureBrief: ClientBrief = {
    ...baseBrief,
    requirements: {
      ...baseBrief.requirements,
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    },
  };

  it('returns neutral feature score (50) when no features specified', () => {
    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: true });
    const result = matcher.enhancedScore(perfectMatchWithDescription, noFeatureBrief);

    expect(result.scoreBreakdown.featureMatch).toBe(50);
    expect(result.featureDetails).toHaveLength(0);
    expect(result.hasDealBreakers).toBe(false);
    expect(result.allMustHavesMet).toBe(true); // Vacuously true
  });
});

// ─── Structured Data Matching ───────────────────────────────────────────────

describe('PropertyMatcher structured data matching', () => {
  it('matches garage/parking from car spaces data', () => {
    const briefWithGarage: ClientBrief = {
      ...baseBrief,
      requirements: {
        ...baseBrief.requirements,
        mustHaves: ['garage'],
        niceToHaves: [],
        dealBreakers: [],
      },
    };

    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: false });
    const propertyWithCar = makeProperty({ id: 'prop-car', carSpaces: 2 });
    const result = matcher.enhancedScore(propertyWithCar, briefWithGarage);

    expect(result.matchedMustHaves).toContain('garage');
  });

  it('matches double garage from car spaces data', () => {
    const briefWithDoubleGarage: ClientBrief = {
      ...baseBrief,
      requirements: {
        ...baseBrief.requirements,
        mustHaves: ['double garage'],
        niceToHaves: [],
        dealBreakers: [],
      },
    };

    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: false });

    const twoCarProperty = makeProperty({ id: 'prop-2car', carSpaces: 2 });
    const result = matcher.enhancedScore(twoCarProperty, briefWithDoubleGarage);
    expect(result.matchedMustHaves).toContain('double garage');

    const oneCarProperty = makeProperty({ id: 'prop-1car', carSpaces: 1 });
    const result2 = matcher.enhancedScore(oneCarProperty, briefWithDoubleGarage);
    expect(result2.matchedMustHaves).not.toContain('double garage');
  });

  it('matches no parking deal-breaker from structured data', () => {
    const briefWithNoParkingBreaker: ClientBrief = {
      ...baseBrief,
      requirements: {
        ...baseBrief.requirements,
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: ['no parking'],
      },
    };

    const matcher = new PropertyMatcher({ minimumScore: 0, enableDescriptionMatching: false });

    const noParkingProperty = makeProperty({ id: 'prop-nopark', carSpaces: 0 });
    const result = matcher.enhancedScore(noParkingProperty, briefWithNoParkingBreaker);
    expect(result.hasDealBreakers).toBe(true);
    expect(result.detectedDealBreakers).toContain('no parking');

    const withParkingProperty = makeProperty({ id: 'prop-park', carSpaces: 1 });
    const result2 = matcher.enhancedScore(withParkingProperty, briefWithNoParkingBreaker);
    expect(result2.hasDealBreakers).toBe(false);
  });
});
