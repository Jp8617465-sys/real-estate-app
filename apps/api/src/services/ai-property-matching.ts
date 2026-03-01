import type { Property, ClientBrief, AIPropertyAnalysis, AIEnhancedMatchResult } from '@realflow/shared';
import { PropertyMatchEngine } from '@realflow/business-logic';
import type { AnthropicClient } from '@realflow/integrations';
import type { AICache } from '@realflow/integrations';

// Scoring weights — must match PropertyMatchEngine exactly
const WEIGHTS = {
  priceMatch: 30,
  locationMatch: 25,
  sizeMatch: 20,
  featureMatch: 15,
  investorMatch: 10,
} as const;

/**
 * AI-enhanced property matching service.
 *
 * Wraps PropertyMatchEngine (pure, no external deps) with an optional
 * Anthropic Claude layer that scores the featureMatch component using NLP
 * on listing descriptions vs brief requirements.
 *
 * Degrades gracefully when:
 * - No ANTHROPIC_API_KEY is configured (client = null)
 * - Property has no listingDescription
 * - Claude API is unavailable (falls back to base score)
 */
export class AIPropertyMatchingService {
  private anthropicClient: AnthropicClient | null;
  private cache: AICache;

  constructor(anthropicClient: AnthropicClient | null, cache: AICache) {
    this.anthropicClient = anthropicClient;
    this.cache = cache;
  }

  /**
   * Score a property against a brief, optionally enhanced with AI.
   * Falls back to pure rule-based scoring if AI is unavailable.
   */
  async scoreProperty(property: Property, brief: ClientBrief): Promise<AIEnhancedMatchResult> {
    // Step 1: Get base score from pure engine (always works)
    const baseResult = PropertyMatchEngine.scoreProperty(property, brief);

    // Step 2: Skip AI if client not configured or no description to analyse
    if (!this.anthropicClient || !property.listingDescription) {
      return {
        propertyId: baseResult.propertyId,
        clientBriefId: baseResult.clientBriefId,
        clientId: baseResult.clientId,
        overallScore: baseResult.overallScore,
        scoreBreakdown: baseResult.scoreBreakdown,
        flags: baseResult.flags,
        aiAnalysis: undefined,
        matchExplanation: undefined,
      };
    }

    // Step 3: Try AI enhancement, fall back on error
    try {
      const aiAnalysis = await this.getAIAnalysis(property, brief);

      // Step 4: Rebuild weighted score replacing featureMatch with AI score
      const enhancedBreakdown = {
        ...baseResult.scoreBreakdown,
        featureMatch: aiAnalysis.featureScore,
      };

      const hasInvestor = enhancedBreakdown.investorMatch !== undefined;
      const totalWeight = hasInvestor ? 100 : 90;

      let weightedSum =
        enhancedBreakdown.priceMatch * WEIGHTS.priceMatch +
        enhancedBreakdown.locationMatch * WEIGHTS.locationMatch +
        enhancedBreakdown.sizeMatch * WEIGHTS.sizeMatch +
        enhancedBreakdown.featureMatch * WEIGHTS.featureMatch;

      if (hasInvestor && enhancedBreakdown.investorMatch !== undefined) {
        weightedSum += enhancedBreakdown.investorMatch * WEIGHTS.investorMatch;
      }

      const overallScore = Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)));

      // Step 5: Merge AI deal-breaker flags with structural flags
      const enhancedFlags = [...baseResult.flags];
      for (const flag of aiAnalysis.dealBreakerFlags) {
        const flagKey = `ai_dealbreaker:${flag}`;
        if (!enhancedFlags.includes(flagKey)) {
          enhancedFlags.push(flagKey);
        }
      }

      return {
        propertyId: baseResult.propertyId,
        clientBriefId: baseResult.clientBriefId,
        clientId: baseResult.clientId,
        overallScore,
        scoreBreakdown: enhancedBreakdown,
        flags: enhancedFlags,
        aiAnalysis,
        matchExplanation: aiAnalysis.summary,
      };
    } catch {
      // AI failed — return base result so the system keeps working
      return {
        propertyId: baseResult.propertyId,
        clientBriefId: baseResult.clientBriefId,
        clientId: baseResult.clientId,
        overallScore: baseResult.overallScore,
        scoreBreakdown: baseResult.scoreBreakdown,
        flags: baseResult.flags,
        aiAnalysis: undefined,
        matchExplanation: undefined,
      };
    }
  }

  /**
   * Score multiple properties against a brief, sorted by overall score descending.
   */
  async scoreProperties(properties: Property[], brief: ClientBrief): Promise<AIEnhancedMatchResult[]> {
    const results = await Promise.all(properties.map(p => this.scoreProperty(p, brief)));
    return results.sort((a, b) => b.overallScore - a.overallScore);
  }

  // ─── Private ───────────────────────────────────────────────────

  private async getAIAnalysis(property: Property, brief: ClientBrief): Promise<AIPropertyAnalysis> {
    const cacheKey = this.cache.generateKey(
      'property-analysis',
      property.id,
      brief.id,
      property.listingDescription ?? '',
    );

    const cached = this.cache.get<AIPropertyAnalysis>(cacheKey);
    if (cached) return cached;

    const result = await this.anthropicClient!.analyzePropertyMatch({
      listingDescription: property.listingDescription!,
      mustHaves: brief.requirements.mustHaves,
      niceToHaves: brief.requirements.niceToHaves,
      dealBreakers: brief.requirements.dealBreakers,
      propertyContext: {
        suburb: property.address.suburb,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
      },
    });

    const analysis: AIPropertyAnalysis = {
      propertyId: property.id,
      featureScore: result.featureScore,
      featureMatches: result.features,
      dealBreakerFlags: result.dealBreakerFlags,
      summary: result.summary,
      tokenUsage: result.tokenUsage,
      cachedAt: new Date().toISOString(),
    };

    // Cache for 24 hours (listing descriptions rarely change)
    this.cache.set(cacheKey, analysis, result.tokenUsage);

    return analysis;
  }
}
