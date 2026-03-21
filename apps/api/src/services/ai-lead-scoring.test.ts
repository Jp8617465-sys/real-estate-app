import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AILeadScoringService } from './ai-lead-scoring';
import { AICache } from '@realflow/integrations';
import type { Contact, Activity } from '@realflow/shared';

// ─── Fixtures ──────────────────────────────────────────────────────

const baseContact: Contact = {
  id: 'contact-123',
  types: ['buyer'],
  firstName: 'Sarah',
  lastName: 'Johnson',
  email: 'sarah@example.com',
  phone: '0412345678',
  source: 'domain',
  assignedAgentId: 'agent-1',
  buyerProfile: {
    budgetMin: 800_000,
    budgetMax: 1_100_000,
    preApproved: true,
    propertyTypes: ['house'],
    bedrooms: { min: 3 },
    bathrooms: { min: 2 },
    carSpaces: { min: 1 },
    suburbs: ['Paddington'],
    mustHaves: [],
    dealBreakers: [],
  },
  tags: [],
  communicationPreference: 'email',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const emptyActivities: Activity[] = [];

// ─── Mock Anthropic Client ─────────────────────────────────────────

function makeAnthropicMock(
  overrides?: Partial<{
    signals: unknown[];
    urgencyLevel: string;
    estimatedTimeline: string | null;
    budgetConfidence: string;
    suggestedScore: number;
  }>,
) {
  return {
    analyzeLeadEnquiry: vi.fn().mockResolvedValue({
      signals: overrides?.signals ?? [],
      urgencyLevel: overrides?.urgencyLevel ?? 'high',
      estimatedTimeline: overrides?.estimatedTimeline ?? '1-3 months',
      budgetConfidence: overrides?.budgetConfidence ?? 'high',
      suggestedScore: overrides?.suggestedScore ?? 80,
      tokenUsage: {
        inputTokens: 150,
        outputTokens: 80,
        model: 'claude-sonnet-4-20250514',
        estimatedCostAud: 0.001,
      },
    }),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('AILeadScoringService', () => {
  let cache: AICache;

  beforeEach(() => {
    cache = new AICache({ defaultTtlMs: 60_000, maxEntries: 100 });
  });

  // ─── Graceful Degradation ──────────────────────────────────────

  it('returns base score when anthropic client is null', async () => {
    const service = new AILeadScoringService(null, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities);

    expect(result.aiAdjustment).toBe(0);
    expect(result.finalScore).toBe(result.baseScore);
    expect(result.signals).toEqual([]);
    expect(result.urgencyLevel).toBe('none');
    expect(result.budgetConfidence).toBe('unknown');
  });

  it('returns base score when enquiry text is not provided', async () => {
    const anthropic = makeAnthropicMock();
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, undefined);

    expect(result.aiAdjustment).toBe(0);
    expect(anthropic.analyzeLeadEnquiry).not.toHaveBeenCalled();
  });

  it('returns base score when enquiry text is empty string', async () => {
    const anthropic = makeAnthropicMock();
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, '  ');

    expect(result.aiAdjustment).toBe(0);
    expect(anthropic.analyzeLeadEnquiry).not.toHaveBeenCalled();
  });

  it('returns base score when AI call throws', async () => {
    const failingAnthropic = {
      analyzeLeadEnquiry: vi.fn().mockRejectedValue(new Error('API error')),
    };
    const service = new AILeadScoringService(failingAnthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, 'Hello');

    expect(result.aiAdjustment).toBe(0);
    expect(result.finalScore).toBe(result.baseScore);
  });

  // ─── AI Enhancement ────────────────────────────────────────────

  it('applies positive AI adjustment when suggestedScore > 50', async () => {
    const anthropic = makeAnthropicMock({ suggestedScore: 80 });
    const service = new AILeadScoringService(anthropic as never, cache);
    const enquiry = 'We are pre-approved to $1.2M and want to buy in 6 weeks.';

    const result = await service.enhancedScore(baseContact, emptyActivities, enquiry);

    expect(result.aiAdjustment).toBe(30); // 80 - 50 = 30
    expect(result.finalScore).toBe(result.baseScore + 30);
  });

  it('applies negative AI adjustment when suggestedScore < 50', async () => {
    const anthropic = makeAnthropicMock({ suggestedScore: 20 });
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, 'Just browsing.');

    expect(result.aiAdjustment).toBe(-30); // 20 - 50 = -30
  });

  it('caps AI adjustment at +50', async () => {
    const anthropic = makeAnthropicMock({ suggestedScore: 100 });
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, 'Urgent buyer');

    expect(result.aiAdjustment).toBe(50);
  });

  it('caps AI adjustment at -50', async () => {
    const anthropic = makeAnthropicMock({ suggestedScore: 0 });
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, 'Not interested');

    expect(result.aiAdjustment).toBe(-50);
  });

  it('clamps finalScore to 0 minimum', async () => {
    const anthropic = makeAnthropicMock({ suggestedScore: 0 }); // -50 adjustment
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, 'Low intent enquiry');

    expect(result.finalScore).toBeGreaterThanOrEqual(0);
  });

  it('clamps finalScore to 100 maximum', async () => {
    const anthropic = makeAnthropicMock({ suggestedScore: 100 }); // +50 adjustment
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, 'Hot lead!');

    expect(result.finalScore).toBeLessThanOrEqual(100);
  });

  it('returns signals, urgencyLevel, estimatedTimeline and budgetConfidence from AI', async () => {
    const anthropic = makeAnthropicMock({
      signals: [
        { signal: 'Pre-approved', impact: 'positive', weight: 9, explanation: 'Finance ready' },
      ],
      urgencyLevel: 'immediate',
      estimatedTimeline: '2 weeks',
      budgetConfidence: 'high',
      suggestedScore: 90,
    });
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(
      baseContact,
      emptyActivities,
      'We have approved finance and need to buy NOW.',
    );

    expect(result.signals).toHaveLength(1);
    expect(result.urgencyLevel).toBe('immediate');
    expect(result.estimatedTimeline).toBe('2 weeks');
    expect(result.budgetConfidence).toBe('high');
  });

  // ─── Caching ──────────────────────────────────────────────────

  it('calls AI only once for same contact + enquiry (cache hit)', async () => {
    const anthropic = makeAnthropicMock();
    const service = new AILeadScoringService(anthropic as never, cache);
    const enquiry = 'I want to buy this month.';

    await service.enhancedScore(baseContact, emptyActivities, enquiry);
    await service.enhancedScore(baseContact, emptyActivities, enquiry);

    expect(anthropic.analyzeLeadEnquiry).toHaveBeenCalledTimes(1);
  });

  it('calls AI again for different contacts', async () => {
    const anthropic = makeAnthropicMock();
    const service = new AILeadScoringService(anthropic as never, cache);
    const enquiry = 'Looking to buy.';
    const contact2 = { ...baseContact, id: 'contact-different' };

    await service.enhancedScore(baseContact, emptyActivities, enquiry);
    await service.enhancedScore(contact2, emptyActivities, enquiry);

    expect(anthropic.analyzeLeadEnquiry).toHaveBeenCalledTimes(2);
  });

  // ─── BaseScore passthrough ────────────────────────────────────

  it('includes baseScore in result', async () => {
    const anthropic = makeAnthropicMock({ suggestedScore: 50 }); // no adjustment
    const service = new AILeadScoringService(anthropic as never, cache);
    const result = await service.enhancedScore(baseContact, emptyActivities, 'Test enquiry.');

    expect(result.baseScore).toBeGreaterThan(0); // contact has email + phone + pre-approval
  });
});
