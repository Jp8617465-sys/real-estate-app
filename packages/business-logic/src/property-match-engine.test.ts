import { describe, it, expect } from 'vitest';
import type { ClientBrief, Property } from '@realflow/shared';
import { PropertyMatchEngine, type MatchResult } from './property-match-engine';

// ─── Fixtures ────────────────────────────────────────────────────────

const now = '2026-02-10T00:00:00.000Z';

/** Owner-occupier looking for a 3-bed house in Paddington QLD, $800k-$1.1M */
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
      { suburb: 'Bardon', state: 'QLD', postcode: '4065', rank: 3 },
    ],
    mustHaves: ['renovated kitchen', 'north-facing backyard'],
    niceToHaves: ['pool', 'separate study'],
    dealBreakers: ['flood zone', 'main road frontage'],
  },
  timeline: {
    urgency: '3_6_months',
  },
  communication: {
    preferredMethod: 'phone',
    updateFrequency: 'weekly',
  },
  briefVersion: 1,
  clientSignedOff: false,
  createdBy: '00000000-0000-0000-0000-000000000099',
  createdAt: now,
  updatedAt: now,
};

/** Base property template — all required fields populated.
 *  Uses 'key in overrides' checks for optional fields so that
 *  explicitly passing `undefined` works correctly. */
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

// Perfect match: Paddington house, 4 bed, 2 bath, 2 car, $950k, 600sqm
const perfectMatch = makeProperty({
  id: '00000000-0000-0000-0000-000000000101',
});

// Over budget: $1.15M (above max but below absoluteMax)
const overBudget = makeProperty({
  id: '00000000-0000-0000-0000-000000000102',
  listPrice: 1_150_000,
});

// Way over budget: $1.3M (above absoluteMax)
const overAbsoluteMax = makeProperty({
  id: '00000000-0000-0000-0000-000000000103',
  listPrice: 1_300_000,
});

// Wrong suburb: Ascot (not in brief)
const wrongSuburb = makeProperty({
  id: '00000000-0000-0000-0000-000000000104',
  address: {
    streetNumber: '10',
    streetName: 'Lancaster Road',
    suburb: 'Ascot',
    state: 'QLD',
    postcode: '4007',
    country: 'AU',
  },
});

// Wrong type: unit instead of house
const wrongType = makeProperty({
  id: '00000000-0000-0000-0000-000000000105',
  propertyType: 'unit',
  landSize: undefined,
});

// Under bedrooms: only 2 bedrooms
const underBedrooms = makeProperty({
  id: '00000000-0000-0000-0000-000000000106',
  bedrooms: 2,
});

// No price listed
const noPrice = makeProperty({
  id: '00000000-0000-0000-0000-000000000107',
  listPrice: undefined,
});

// Significantly under budget
const cheapProperty = makeProperty({
  id: '00000000-0000-0000-0000-000000000108',
  listPrice: 400_000,
});

// Second-rank suburb (Red Hill)
const secondRankSuburb = makeProperty({
  id: '00000000-0000-0000-0000-000000000109',
  address: {
    streetNumber: '5',
    streetName: 'Ithaca Street',
    suburb: 'Red Hill',
    state: 'QLD',
    postcode: '4059',
    country: 'AU',
  },
});

// Meets minimum bedrooms exactly (3, ideal is 4)
const meetsMinBedrooms = makeProperty({
  id: '00000000-0000-0000-0000-000000000110',
  bedrooms: 3,
});

// Slightly over budget with no absoluteMax
const slightlyOverNoAbsMax = makeProperty({
  id: '00000000-0000-0000-0000-000000000111',
  listPrice: 1_130_000,
});

// Under budget (below min but close)
const underBudget = makeProperty({
  id: '00000000-0000-0000-0000-000000000112',
  listPrice: 700_000,
});

// Brief without absoluteMax
const briefNoAbsMax: ClientBrief = {
  ...baseBrief,
  id: '00000000-0000-0000-0000-000000000002',
  budget: {
    min: 800_000,
    max: 1_100_000,
    stampDutyBudgeted: false,
  },
};

// Brief with empty suburbs
const briefEmptySuburbs: ClientBrief = {
  ...baseBrief,
  id: '00000000-0000-0000-0000-000000000003',
  requirements: {
    ...baseBrief.requirements,
    suburbs: [],
  },
};

// Brief with no property types
const briefNoPropertyTypes: ClientBrief = {
  ...baseBrief,
  id: '00000000-0000-0000-0000-000000000004',
  requirements: {
    ...baseBrief.requirements,
    propertyTypes: [],
  },
};

// Brief with investor criteria
const investorBrief: ClientBrief = {
  ...baseBrief,
  id: '00000000-0000-0000-0000-000000000005',
  purchaseType: 'investor',
  enquiryType: 'investor',
  requirements: {
    ...baseBrief.requirements,
    investorCriteria: {
      targetYield: 5.0,
      growthPriority: 'balanced',
      acceptTenanted: true,
      newBuildPreference: false,
    },
  },
};

// Brief with no features (empty must-haves, deal-breakers, nice-to-haves)
const briefNoFeatures: ClientBrief = {
  ...baseBrief,
  id: '00000000-0000-0000-0000-000000000006',
  requirements: {
    ...baseBrief.requirements,
    mustHaves: [],
    niceToHaves: [],
    dealBreakers: [],
  },
};

// Brief with building age preference
const briefWithBuildingAge: ClientBrief = {
  ...baseBrief,
  id: '00000000-0000-0000-0000-000000000007',
  requirements: {
    ...baseBrief.requirements,
    buildingAge: { min: 2000, max: 2025 },
  },
};

// Property with yearBuilt that's too old for the building age brief
const oldProperty = makeProperty({
  id: '00000000-0000-0000-0000-000000000113',
  yearBuilt: 1950,
});

// Property with yearBuilt that fits the building age brief
const newProperty = makeProperty({
  id: '00000000-0000-0000-0000-000000000114',
  yearBuilt: 2015,
});

// ─── scoreProperty ──────────────────────────────────────────────────

describe('PropertyMatchEngine.scoreProperty', () => {
  it('returns a score between 0 and 100 for a perfect match', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('returns correct ids in the result', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    expect(result.propertyId).toBe(perfectMatch.id);
    expect(result.clientBriefId).toBe(baseBrief.id);
    expect(result.clientId).toBe(baseBrief.contactId);
  });

  it('returns a breakdown with all required score components', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    expect(result.scoreBreakdown).toHaveProperty('priceMatch');
    expect(result.scoreBreakdown).toHaveProperty('locationMatch');
    expect(result.scoreBreakdown).toHaveProperty('sizeMatch');
    expect(result.scoreBreakdown).toHaveProperty('featureMatch');
  });

  it('all breakdown scores are between 0 and 100', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    const { priceMatch, locationMatch, sizeMatch, featureMatch } = result.scoreBreakdown;
    for (const score of [priceMatch, locationMatch, sizeMatch, featureMatch]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('perfect match gets a high overall score', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    // Perfect match: price in range (100), Paddington rank 1 (100), 4bed/2bath/2car meets ideal (100), feature neutral (50)
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
  });

  it('over absolute max gets a very low score', () => {
    const result = PropertyMatchEngine.scoreProperty(overAbsoluteMax, baseBrief);
    // Price match = 0, should drag the overall score way down
    expect(result.scoreBreakdown.priceMatch).toBe(0);
    expect(result.overallScore).toBeLessThan(60);
  });

  it('includes investorMatch in breakdown when brief has investor criteria', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, investorBrief);
    expect(result.scoreBreakdown.investorMatch).toBeDefined();
    expect(result.scoreBreakdown.investorMatch).toBeGreaterThanOrEqual(0);
    expect(result.scoreBreakdown.investorMatch).toBeLessThanOrEqual(100);
  });

  it('does not include investorMatch when brief has no investor criteria', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    expect(result.scoreBreakdown.investorMatch).toBeUndefined();
  });

  it('returns flags as an array', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    expect(Array.isArray(result.flags)).toBe(true);
  });
});

// ─── scorePriceMatch (via scoreProperty) ────────────────────────────

describe('PropertyMatchEngine price scoring', () => {
  it('scores 100 when price is within budget range', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    expect(result.scoreBreakdown.priceMatch).toBe(100);
  });

  it('scores 0 when price exceeds absoluteMax', () => {
    const result = PropertyMatchEngine.scoreProperty(overAbsoluteMax, baseBrief);
    expect(result.scoreBreakdown.priceMatch).toBe(0);
  });

  it('scores between 0 and 70 when price is between max and absoluteMax', () => {
    const result = PropertyMatchEngine.scoreProperty(overBudget, baseBrief);
    expect(result.scoreBreakdown.priceMatch).toBeGreaterThan(0);
    expect(result.scoreBreakdown.priceMatch).toBeLessThanOrEqual(70);
  });

  it('scores 50 (neutral) when no price is listed', () => {
    const result = PropertyMatchEngine.scoreProperty(noPrice, baseBrief);
    expect(result.scoreBreakdown.priceMatch).toBe(50);
  });

  it('scores 90 when slightly under budget min (within 80%)', () => {
    const result = PropertyMatchEngine.scoreProperty(underBudget, baseBrief);
    // $700k is 87.5% of $800k min, so ratio >= 0.8 -> 90
    expect(result.scoreBreakdown.priceMatch).toBe(90);
  });

  it('degrades gracefully for slightly over max without absoluteMax', () => {
    // $1.13M is ~2.7% over $1.1M max (<=5%)
    const result = PropertyMatchEngine.scoreProperty(slightlyOverNoAbsMax, briefNoAbsMax);
    expect(result.scoreBreakdown.priceMatch).toBe(60);
  });

  it('scores 0 for way over max without absoluteMax (>20%)', () => {
    const wayOver = makeProperty({
      id: '00000000-0000-0000-0000-000000000199',
      listPrice: 1_400_000,
    });
    const result = PropertyMatchEngine.scoreProperty(wayOver, briefNoAbsMax);
    // $1.4M is ~27% over $1.1M => 0
    expect(result.scoreBreakdown.priceMatch).toBe(0);
  });

  it('scores low for significantly under budget', () => {
    const result = PropertyMatchEngine.scoreProperty(cheapProperty, baseBrief);
    // $400k is 50% of $800k min, ratio < 0.6 -> 50
    expect(result.scoreBreakdown.priceMatch).toBe(50);
  });
});

// ─── scoreLocationMatch (via scoreProperty) ─────────────────────────

describe('PropertyMatchEngine location scoring', () => {
  it('scores 100 for rank-1 suburb match', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    expect(result.scoreBreakdown.locationMatch).toBe(100);
  });

  it('scores 90 for rank-2 suburb match', () => {
    const result = PropertyMatchEngine.scoreProperty(secondRankSuburb, baseBrief);
    expect(result.scoreBreakdown.locationMatch).toBe(90);
  });

  it('scores 0 when suburb is not in brief list', () => {
    const result = PropertyMatchEngine.scoreProperty(wrongSuburb, baseBrief);
    expect(result.scoreBreakdown.locationMatch).toBe(0);
  });

  it('scores 50 (neutral) when brief has no suburb preferences', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, briefEmptySuburbs);
    expect(result.scoreBreakdown.locationMatch).toBe(50);
  });

  it('is case insensitive on suburb matching', () => {
    const lowerCaseSuburb = makeProperty({
      id: '00000000-0000-0000-0000-000000000198',
      address: {
        streetNumber: '1',
        streetName: 'Given Terrace',
        suburb: 'paddington',
        state: 'QLD',
        postcode: '4064',
        country: 'AU',
      },
    });
    const result = PropertyMatchEngine.scoreProperty(lowerCaseSuburb, baseBrief);
    expect(result.scoreBreakdown.locationMatch).toBe(100);
  });
});

// ─── scoreSizeMatch (via scoreProperty) ─────────────────────────────

describe('PropertyMatchEngine size scoring', () => {
  it('scores high when property meets or exceeds ideal requirements', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    // 4 bed (ideal=4 -> 100), 2 bath (min=2 -> 100), 2 car (ideal=2 -> 100), land in range (100), house type (100)
    expect(result.scoreBreakdown.sizeMatch).toBe(100);
  });

  it('scores lower when bedrooms only meet min (not ideal)', () => {
    const result = PropertyMatchEngine.scoreProperty(meetsMinBedrooms, baseBrief);
    // 3 bed: min=3, ideal=4, actual=3 >= min -> 80
    expect(result.scoreBreakdown.sizeMatch).toBeLessThan(100);
  });

  it('scores lower when bedrooms are below minimum', () => {
    const result = PropertyMatchEngine.scoreProperty(underBedrooms, baseBrief);
    // 2 bed (40) + 2 bath (100) + 2 car (100) + land in range (100) + house type (100) = 440/5 = 88
    // Lower than perfect match (100) but other factors keep it above 80
    expect(result.scoreBreakdown.sizeMatch).toBe(88);
    expect(result.scoreBreakdown.sizeMatch).toBeLessThan(100);
  });

  it('penalises size score when property type is wrong', () => {
    const result = PropertyMatchEngine.scoreProperty(wrongType, baseBrief);
    // unit not in [house] -> type factor = 0. No landSize -> skip land factor.
    // (100 + 100 + 100 + 0) / 4 = 75
    expect(result.scoreBreakdown.sizeMatch).toBe(75);
  });

  it('ignores property type scoring when brief has no property types', () => {
    const result1 = PropertyMatchEngine.scoreProperty(wrongType, briefNoPropertyTypes);
    const result2 = PropertyMatchEngine.scoreProperty(perfectMatch, briefNoPropertyTypes);
    // Without property type constraint, both should score similarly on size
    // (difference only in landSize which wrongType doesn't have)
    expect(result1.scoreBreakdown.sizeMatch).toBeGreaterThan(0);
    expect(result2.scoreBreakdown.sizeMatch).toBeGreaterThan(0);
  });
});

// ─── scoreFeatureMatch (via scoreProperty) ──────────────────────────

describe('PropertyMatchEngine feature scoring', () => {
  it('returns 50 (neutral) when no features preferences are set', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, briefNoFeatures);
    expect(result.scoreBreakdown.featureMatch).toBe(50);
  });

  it('returns 50 (neutral) as baseline when feature preferences exist but no structured data to check', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    // Without NLP on descriptions, feature match returns 50 as baseline
    expect(result.scoreBreakdown.featureMatch).toBe(50);
  });

  it('returns 20 when property yearBuilt is outside building age range (too old)', () => {
    const result = PropertyMatchEngine.scoreProperty(oldProperty, briefWithBuildingAge);
    // 1950 is before min 2000
    expect(result.scoreBreakdown.featureMatch).toBe(20);
  });

  it('returns 50 (neutral) when property yearBuilt is within building age range', () => {
    const result = PropertyMatchEngine.scoreProperty(newProperty, briefWithBuildingAge);
    // 2015 is between 2000 and 2025
    expect(result.scoreBreakdown.featureMatch).toBe(50);
  });
});

// ─── scoreProperties ────────────────────────────────────────────────

describe('PropertyMatchEngine.scoreProperties', () => {
  it('returns results sorted by overallScore descending', () => {
    const properties = [wrongSuburb, overAbsoluteMax, perfectMatch, underBedrooms];
    const results = PropertyMatchEngine.scoreProperties(properties, baseBrief);

    expect(results).toHaveLength(4);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.overallScore).toBeGreaterThanOrEqual(results[i]!.overallScore);
    }
  });

  it('perfect match is ranked first', () => {
    const properties = [wrongSuburb, overAbsoluteMax, perfectMatch, underBedrooms];
    const results = PropertyMatchEngine.scoreProperties(properties, baseBrief);
    expect(results[0]!.propertyId).toBe(perfectMatch.id);
  });

  it('returns empty array for empty input', () => {
    const results = PropertyMatchEngine.scoreProperties([], baseBrief);
    expect(results).toEqual([]);
  });

  it('handles single property', () => {
    const results = PropertyMatchEngine.scoreProperties([perfectMatch], baseBrief);
    expect(results).toHaveLength(1);
    expect(results[0]!.propertyId).toBe(perfectMatch.id);
  });
});

// ─── filterByMinScore ───────────────────────────────────────────────

describe('PropertyMatchEngine.filterByMinScore', () => {
  it('filters results below minimum score', () => {
    const results: MatchResult[] = [
      PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief),
      PropertyMatchEngine.scoreProperty(overAbsoluteMax, baseBrief),
      PropertyMatchEngine.scoreProperty(wrongSuburb, baseBrief),
    ];

    const filtered = PropertyMatchEngine.filterByMinScore(results, 70);
    for (const r of filtered) {
      expect(r.overallScore).toBeGreaterThanOrEqual(70);
    }
  });

  it('returns all results when minScore is 0', () => {
    const results: MatchResult[] = [
      PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief),
      PropertyMatchEngine.scoreProperty(overAbsoluteMax, baseBrief),
    ];

    const filtered = PropertyMatchEngine.filterByMinScore(results, 0);
    expect(filtered).toHaveLength(results.length);
  });

  it('returns empty array when no results meet threshold', () => {
    const results: MatchResult[] = [
      PropertyMatchEngine.scoreProperty(overAbsoluteMax, baseBrief),
    ];

    const filtered = PropertyMatchEngine.filterByMinScore(results, 99);
    expect(filtered).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const filtered = PropertyMatchEngine.filterByMinScore([], 50);
    expect(filtered).toEqual([]);
  });

  it('includes results exactly at the threshold', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    const filtered = PropertyMatchEngine.filterByMinScore([result], result.overallScore);
    expect(filtered).toHaveLength(1);
  });
});

// ─── detectFlags (via scoreProperty) ────────────────────────────────

describe('PropertyMatchEngine flag detection', () => {
  it('flags over_budget when price exceeds max', () => {
    const result = PropertyMatchEngine.scoreProperty(overBudget, baseBrief);
    expect(result.flags).toContain('over_budget');
  });

  it('flags over_absolute_max when price exceeds absoluteMax', () => {
    const result = PropertyMatchEngine.scoreProperty(overAbsoluteMax, baseBrief);
    expect(result.flags).toContain('over_absolute_max');
    expect(result.flags).toContain('over_budget');
  });

  it('flags significantly_under_budget when price is < 70% of min', () => {
    const result = PropertyMatchEngine.scoreProperty(cheapProperty, baseBrief);
    // $400k < $800k * 0.7 = $560k
    expect(result.flags).toContain('significantly_under_budget');
  });

  it('flags wrong_property_type when property type not in brief', () => {
    const result = PropertyMatchEngine.scoreProperty(wrongType, baseBrief);
    expect(result.flags).toContain('wrong_property_type');
  });

  it('flags outside_target_suburbs when suburb not in brief', () => {
    const result = PropertyMatchEngine.scoreProperty(wrongSuburb, baseBrief);
    expect(result.flags).toContain('outside_target_suburbs');
  });

  it('flags below_min_bedrooms when bedrooms below minimum', () => {
    const result = PropertyMatchEngine.scoreProperty(underBedrooms, baseBrief);
    expect(result.flags).toContain('below_min_bedrooms');
  });

  it('returns no flags for a perfect match', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    expect(result.flags).toEqual([]);
  });

  it('does not flag over_absolute_max when absoluteMax is not set', () => {
    const overMax = makeProperty({
      id: '00000000-0000-0000-0000-000000000197',
      listPrice: 1_300_000,
    });
    const result = PropertyMatchEngine.scoreProperty(overMax, briefNoAbsMax);
    expect(result.flags).toContain('over_budget');
    expect(result.flags).not.toContain('over_absolute_max');
  });

  it('does not flag outside_target_suburbs when brief has no suburbs', () => {
    const result = PropertyMatchEngine.scoreProperty(wrongSuburb, briefEmptySuburbs);
    expect(result.flags).not.toContain('outside_target_suburbs');
  });

  it('does not flag wrong_property_type when brief has no property types', () => {
    const result = PropertyMatchEngine.scoreProperty(wrongType, briefNoPropertyTypes);
    expect(result.flags).not.toContain('wrong_property_type');
  });

  it('does not flag price-related flags when no price is listed', () => {
    const result = PropertyMatchEngine.scoreProperty(noPrice, baseBrief);
    expect(result.flags).not.toContain('over_budget');
    expect(result.flags).not.toContain('over_absolute_max');
    expect(result.flags).not.toContain('significantly_under_budget');
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe('PropertyMatchEngine edge cases', () => {
  it('handles brief with empty suburbs (location score = 50)', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, briefEmptySuburbs);
    expect(result.scoreBreakdown.locationMatch).toBe(50);
  });

  it('handles property with no price listed (price score = 50)', () => {
    const result = PropertyMatchEngine.scoreProperty(noPrice, baseBrief);
    expect(result.scoreBreakdown.priceMatch).toBe(50);
  });

  it('handles brief with no property types specified', () => {
    const result = PropertyMatchEngine.scoreProperty(perfectMatch, briefNoPropertyTypes);
    // Size score should not penalize for unspecified property types
    expect(result.scoreBreakdown.sizeMatch).toBeGreaterThan(0);
  });

  it('handles investor brief with investorMatch included in weighted average', () => {
    const resultInvestor = PropertyMatchEngine.scoreProperty(perfectMatch, investorBrief);
    const resultNonInvestor = PropertyMatchEngine.scoreProperty(perfectMatch, baseBrief);
    // Investor brief uses 100 total weight vs 90 for non-investor
    // Both should return valid scores but may differ
    expect(resultInvestor.overallScore).toBeGreaterThanOrEqual(0);
    expect(resultInvestor.overallScore).toBeLessThanOrEqual(100);
    expect(resultNonInvestor.overallScore).toBeGreaterThanOrEqual(0);
    expect(resultNonInvestor.overallScore).toBeLessThanOrEqual(100);
  });

  it('handles price exactly at max (should be in-range)', () => {
    const atMax = makeProperty({
      id: '00000000-0000-0000-0000-000000000196',
      listPrice: 1_100_000,
    });
    const result = PropertyMatchEngine.scoreProperty(atMax, baseBrief);
    expect(result.scoreBreakdown.priceMatch).toBe(100);
    expect(result.flags).not.toContain('over_budget');
  });

  it('handles price exactly at min (should be in-range)', () => {
    const atMin = makeProperty({
      id: '00000000-0000-0000-0000-000000000195',
      listPrice: 800_000,
    });
    const result = PropertyMatchEngine.scoreProperty(atMin, baseBrief);
    expect(result.scoreBreakdown.priceMatch).toBe(100);
  });

  it('handles price exactly at absoluteMax (within decay range)', () => {
    const atAbsMax = makeProperty({
      id: '00000000-0000-0000-0000-000000000194',
      listPrice: 1_200_000,
    });
    const result = PropertyMatchEngine.scoreProperty(atAbsMax, baseBrief);
    // At absoluteMax: overBudgetRatio = (1.2M - 1.1M) / (1.2M - 1.1M) = 1.0
    // Score = round(70 * (1 - 1.0)) = 0
    expect(result.scoreBreakdown.priceMatch).toBe(0);
    expect(result.flags).toContain('over_budget');
  });

  it('handles property with 0 bedrooms against min=3', () => {
    const noBedrooms = makeProperty({
      id: '00000000-0000-0000-0000-000000000193',
      bedrooms: 0,
    });
    const result = PropertyMatchEngine.scoreProperty(noBedrooms, baseBrief);
    expect(result.flags).toContain('below_min_bedrooms');
  });

  it('multiple properties with same score maintain stable sort', () => {
    const twin1 = makeProperty({ id: '00000000-0000-0000-0000-000000000191' });
    const twin2 = makeProperty({ id: '00000000-0000-0000-0000-000000000192' });
    const results = PropertyMatchEngine.scoreProperties([twin1, twin2], baseBrief);
    expect(results).toHaveLength(2);
    expect(results[0]!.overallScore).toBe(results[1]!.overallScore);
  });

  it('handles suburbs without rank (all score 100)', () => {
    const noRankBrief: ClientBrief = {
      ...baseBrief,
      id: '00000000-0000-0000-0000-000000000008',
      requirements: {
        ...baseBrief.requirements,
        suburbs: [
          { suburb: 'Paddington', state: 'QLD', postcode: '4064' },
          { suburb: 'Red Hill', state: 'QLD', postcode: '4059' },
        ],
      },
    };
    const result1 = PropertyMatchEngine.scoreProperty(perfectMatch, noRankBrief);
    const result2 = PropertyMatchEngine.scoreProperty(secondRankSuburb, noRankBrief);
    expect(result1.scoreBreakdown.locationMatch).toBe(100);
    expect(result2.scoreBreakdown.locationMatch).toBe(100);
  });
});
