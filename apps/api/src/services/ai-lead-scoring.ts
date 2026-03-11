import type { Contact, Activity, AILeadScoreEnhancement } from '@realflow/shared';
import { ContactScoring } from '@realflow/business-logic';
import type { AnthropicClient } from '@realflow/integrations';
import type { AICache } from '@realflow/integrations';

/**
 * AI-enhanced lead scoring service.
 *
 * Wraps ContactScoring (pure, rule-based) with an optional Anthropic Claude
 * layer that analyses enquiry text for buying signals, urgency, and budget
 * confidence. The AI produces an adjustment (±50 max) applied to the base score.
 *
 * Degrades gracefully when:
 * - No ANTHROPIC_API_KEY is configured (client = null)
 * - No enquiry text provided
 * - Claude API is unavailable (returns base score only)
 */
export class AILeadScoringService {
  private anthropicClient: AnthropicClient | null;
  private cache: AICache;

  constructor(anthropicClient: AnthropicClient | null, cache: AICache) {
    this.anthropicClient = anthropicClient;
    this.cache = cache;
  }

  /**
   * Calculate an AI-enhanced lead score.
   * Falls back to base ContactScoring score if AI is unavailable.
   */
  async enhancedScore(
    contact: Contact,
    activities: Activity[],
    enquiryText?: string,
  ): Promise<AILeadScoreEnhancement> {
    // Step 1: Base rule-based score (always works)
    const baseScore = ContactScoring.calculateScore(contact, activities);

    const emptyTokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      model: 'none',
      estimatedCostAud: 0,
    };

    // Step 2: Skip AI if not configured or no text to analyse
    if (!this.anthropicClient || !enquiryText?.trim()) {
      return {
        contactId: contact.id,
        baseScore,
        aiAdjustment: 0,
        finalScore: baseScore,
        signals: [],
        urgencyLevel: 'none',
        estimatedTimeline: undefined,
        budgetConfidence: 'unknown',
        tokenUsage: emptyTokenUsage,
      };
    }

    // Step 3: Try AI enhancement, fall back on error
    try {
      const cacheKey = this.cache.generateKey('lead-scoring', contact.id, enquiryText);
      const cached =
        this.cache.get<Omit<AILeadScoreEnhancement, 'baseScore' | 'finalScore'>>(cacheKey);

      if (cached) {
        const finalScore = Math.max(0, Math.min(100, baseScore + cached.aiAdjustment));
        return { ...cached, contactId: contact.id, baseScore, finalScore };
      }

      const aiResult = await this.anthropicClient.analyzeLeadEnquiry({
        enquiryText,
        contactContext: {
          name: `${contact.firstName} ${contact.lastName}`,
          source: contact.source,
        },
      });

      // AI adjustment: difference from neutral (50), capped at ±50
      const aiAdjustment = Math.max(-50, Math.min(50, aiResult.suggestedScore - 50));
      const finalScore = Math.max(0, Math.min(100, baseScore + aiAdjustment));

      const enhancement: AILeadScoreEnhancement = {
        contactId: contact.id,
        baseScore,
        aiAdjustment,
        finalScore,
        signals: aiResult.signals,
        urgencyLevel: aiResult.urgencyLevel,
        estimatedTimeline: aiResult.estimatedTimeline ?? undefined,
        budgetConfidence: aiResult.budgetConfidence,
        tokenUsage: aiResult.tokenUsage,
      };

      // Cache for 1 hour (new activities could change the context)
      this.cache.set(cacheKey, enhancement, aiResult.tokenUsage, 60 * 60 * 1000);

      return enhancement;
    } catch {
      // AI failed — return base score so the system keeps working
      return {
        contactId: contact.id,
        baseScore,
        aiAdjustment: 0,
        finalScore: baseScore,
        signals: [],
        urgencyLevel: 'none',
        estimatedTimeline: undefined,
        budgetConfidence: 'unknown',
        tokenUsage: emptyTokenUsage,
      };
    }
  }
}
