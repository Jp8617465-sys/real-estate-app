import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIPropertyMatchingService } from './ai-property-matching';
import { AICache } from '@realflow/integrations';
import type { Property, ClientBrief } from '@realflow/shared';

// ─── Fixtures ──────────────────────────────────────────────────────

const baseProperty: Property = {
  id: 'prop-123',
  address: {
    streetNumber: '42',
    streetName: 'Rosewood Drive',
    suburb: 'Paddington',
    state: 'QLD',
    postcode: '4064',
    country: 'AU',
  },
  propertyType: 'house',
  bedrooms: 4,
  bathrooms: 2,
  carSpaces: 2,
  landSize: 450,
  yearBuilt: 2005,
  listingStatus: 'active',
  listPrice: 1_200_000,
  saleType: 'private-treaty',
  photos: [],
  floorPlans: [],
  interestedBuyerIds: [],
  assignedAgentId: 'agent-1',
  portalViews: 0,
  enquiryCount: 0,
  inspectionCount: 0,
  comparables: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const baseBrief: ClientBrief = {
  id: 'brief-456',
  contactId: 'contact-789',
  purchaseType: 'owner_occupier',
  enquiryType: 'home_buyer',
  budget: { min: 1_000_000, max: 1_300_000, stampDutyBudgeted: true },
  finance: { preApproved: true, firstHomeBuyer: false },
  requirements: {
    propertyTypes: ['house'],
    bedrooms: { min: 3, ideal: 4 },
    bathrooms: { min: 2 },
    carSpaces: { min: 1 },
    suburbs: [{ suburb: 'Paddington', state: 'QLD', postcode: '4064', rank: 1 }],
    mustHaves: ['pool'],
    niceToHaves: ['modern kitchen'],
    dealBreakers: ['main road'],
  },
  timeline: { urgency: '3_6_months' },
  communication: {},
  briefVersion: 1,
  clientSignedOff: false,
  createdBy: 'agent-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ─── Mock Anthropic Client ─────────────────────────────────────────

function makeAnthropicMock(overrides?: Partial<{
  featureScore: number;
  features: unknown[];
  dealBreakerFlags: string[];
  summary: string;
}>) {
  return {
    analyzePropertyMatch: vi.fn().mockResolvedValue({
      featureScore: overrides?.featureScore ?? 80,
      features: overrides?.features ?? [],
      dealBreakerFlags: overrides?.dealBreakerFlags ?? [],
      summary: overrides?.summary ?? 'Good match for requirements.',
      tokenUsage: {
        inputTokens: 200,
        outputTokens: 100,
        model: 'claude-sonnet-4-20250514',
        estimatedCostAud: 0.002,
      },
    }),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('AIPropertyMatchingService', () => {
  let cache: AICache;

  beforeEach(() => {
    cache = new AICache({ defaultTtlMs: 60_000, maxEntries: 100 });
  });

  // ─── Graceful Degradation ──────────────────────────────────────

  it('returns base score when anthropic client is null', async () => {
    const service = new AIPropertyMatchingService(null, cache);
    const result = await service.scoreProperty(baseProperty, baseBrief);

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.aiAnalysis).toBeUndefined();
    expect(result.matchExplanation).toBeUndefined();
  });

  it('returns base score when property has no listingDescription', async () => {
    const anthropic = makeAnthropicMock();
    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const propertyWithoutDescription = { ...baseProperty, listingDescription: undefined };

    const result = await service.scoreProperty(propertyWithoutDescription, baseBrief);

    expect(result.aiAnalysis).toBeUndefined();
    expect(anthropic.analyzePropertyMatch).not.toHaveBeenCalled();
  });

  it('returns base score when AI call throws', async () => {
    const failingAnthropic = {
      analyzePropertyMatch: vi.fn().mockRejectedValue(new Error('API down')),
    };
    const service = new AIPropertyMatchingService(failingAnthropic as never, cache);
    const property = { ...baseProperty, listingDescription: 'Modern home with pool.' };

    const result = await service.scoreProperty(property, baseBrief);

    // Should not throw — graceful degradation
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.aiAnalysis).toBeUndefined();
  });

  // ─── AI Enhancement ────────────────────────────────────────────

  it('replaces featureMatch score with AI score when description present', async () => {
    const anthropic = makeAnthropicMock({ featureScore: 90 });
    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const property = { ...baseProperty, listingDescription: 'Stunning home with heated pool and modern kitchen.' };

    const result = await service.scoreProperty(property, baseBrief);

    expect(result.scoreBreakdown.featureMatch).toBe(90);
    expect(result.aiAnalysis).toBeDefined();
    expect(result.matchExplanation).toBe('Good match for requirements.');
  });

  it('recalculates overall score using AI feature score', async () => {
    // Force AI feature score to extreme (100) and verify it shifts the overall score
    const anthropic = makeAnthropicMock({ featureScore: 100 });
    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const property = { ...baseProperty, listingDescription: 'Perfect match property.' };

    const resultWithAI = await service.scoreProperty(property, baseBrief);

    // Without AI the featureMatch would be 50 — with AI it's 100
    const serviceNoAI = new AIPropertyMatchingService(null, cache);
    const resultBaseOnly = await serviceNoAI.scoreProperty(property, baseBrief);

    expect(resultWithAI.overallScore).toBeGreaterThan(resultBaseOnly.overallScore);
  });

  it('merges AI deal-breaker flags with structural flags', async () => {
    const anthropic = makeAnthropicMock({
      featureScore: 30,
      dealBreakerFlags: ['backs onto busy road'],
    });
    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const property = { ...baseProperty, listingDescription: 'Unit on George St.' };

    const result = await service.scoreProperty(property, baseBrief);

    expect(result.flags).toContain('ai_dealbreaker:backs onto busy road');
  });

  it('does not duplicate AI flags already present', async () => {
    const anthropic = makeAnthropicMock({
      featureScore: 40,
      dealBreakerFlags: ['main road frontage'],
    });
    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const property = { ...baseProperty, listingDescription: 'On main road.' };

    const result = await service.scoreProperty(property, baseBrief);

    const dupeCheck = result.flags.filter(f => f === 'ai_dealbreaker:main road frontage');
    expect(dupeCheck).toHaveLength(1);
  });

  // ─── Caching ──────────────────────────────────────────────────

  it('calls AI only once for same property/brief (cache hit on second call)', async () => {
    const anthropic = makeAnthropicMock();
    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const property = { ...baseProperty, listingDescription: 'Nice home.' };

    await service.scoreProperty(property, baseBrief);
    await service.scoreProperty(property, baseBrief);

    expect(anthropic.analyzePropertyMatch).toHaveBeenCalledTimes(1);
  });

  it('calls AI again for different properties', async () => {
    const anthropic = makeAnthropicMock();
    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const prop1 = { ...baseProperty, id: 'prop-1', listingDescription: 'House A.' };
    const prop2 = { ...baseProperty, id: 'prop-2', listingDescription: 'House B.' };

    await service.scoreProperty(prop1, baseBrief);
    await service.scoreProperty(prop2, baseBrief);

    expect(anthropic.analyzePropertyMatch).toHaveBeenCalledTimes(2);
  });

  // ─── scoreProperties ──────────────────────────────────────────

  it('sorts results by overallScore descending', async () => {
    let callCount = 0;
    const anthropic = {
      analyzePropertyMatch: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          featureScore: callCount === 1 ? 20 : 90,  // first prop gets low score, second gets high
          features: [],
          dealBreakerFlags: [],
          summary: 'Test',
          tokenUsage: { inputTokens: 10, outputTokens: 5, model: 'test', estimatedCostAud: 0 },
        });
      }),
    };

    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const props = [
      { ...baseProperty, id: 'prop-low', listingDescription: 'Low score property.' },
      { ...baseProperty, id: 'prop-high', listingDescription: 'High score property.' },
    ];

    const results = await service.scoreProperties(props, baseBrief);
    expect(results[0]!.overallScore).toBeGreaterThanOrEqual(results[1]!.overallScore);
  });

  // ─── Score bounds ──────────────────────────────────────────────

  it('clamps overall score to 0-100', async () => {
    const anthropic = makeAnthropicMock({ featureScore: 100 });
    const service = new AIPropertyMatchingService(anthropic as never, cache);
    const property = { ...baseProperty, listingDescription: 'Perfect home.' };

    const result = await service.scoreProperty(property, baseBrief);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});
