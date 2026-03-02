import { z } from 'zod';
import type { AIFeatureMatchDetail, AITokenUsage } from '@realflow/shared';
import { AnthropicAPIError } from '../errors';
import {
  buildPropertyAnalysisPrompt,
  buildLeadScoringPrompt,
  buildBriefRefinementPrompt,
  buildMessageDraftPrompt,
  buildEmailSignalExtractionPrompt,
  buildDailyActionsPrompt,
  buildSequenceContentPrompt,
  type DailyActionCandidateInput,
  type SequenceContentInput,
} from './prompts';

// ─── Configuration ──────────────────────────────────────────────────

const AnthropicConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url().default('https://api.anthropic.com'),
  model: z.string().default('claude-sonnet-4-20250514'),
  maxTokens: z.number().int().positive().default(4096),
  defaultTemperature: z.number().min(0).max(1).default(0.3),
  maxRetries: z.number().int().nonnegative().default(3),
  rateLimitPerMinute: z.number().int().positive().default(50),
  retryBaseDelayMs: z.number().int().nonnegative().default(1000),
});

type AnthropicConfigInput = z.input<typeof AnthropicConfigSchema>;
type AnthropicConfig = z.infer<typeof AnthropicConfigSchema>;

// ─── Anthropic API Types ────────────────────────────────────────────

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// ─── Cost Constants (AUD per million tokens) ────────────────────────

const COST_PER_MILLION_INPUT: Record<string, number> = {
  'claude-sonnet-4-20250514': 4.80,   // $3 USD ≈ $4.80 AUD
  'claude-haiku-4-5-20251001': 1.28,   // $0.80 USD ≈ $1.28 AUD
  'claude-opus-4-6': 24.00,           // $15 USD ≈ $24 AUD
};

const COST_PER_MILLION_OUTPUT: Record<string, number> = {
  'claude-sonnet-4-20250514': 24.00,  // $15 USD ≈ $24 AUD
  'claude-haiku-4-5-20251001': 6.40,   // $4 USD ≈ $6.40 AUD
  'claude-opus-4-6': 120.00,          // $75 USD ≈ $120 AUD
};

// ─── Result Types ───────────────────────────────────────────────────

export interface PropertyAnalysisResult {
  featureScore: number;
  features: AIFeatureMatchDetail[];
  dealBreakerFlags: string[];
  summary: string;
  tokenUsage: AITokenUsage;
}

export interface LeadScoringResult {
  signals: Array<{
    signal: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    explanation: string;
  }>;
  urgencyLevel: 'immediate' | 'high' | 'medium' | 'low' | 'none';
  estimatedTimeline: string | null;
  budgetConfidence: 'high' | 'medium' | 'low' | 'unknown';
  suggestedScore: number;
  tokenUsage: AITokenUsage;
}

export interface BriefRefinementResult {
  suggestions: Array<{
    field: string;
    currentValue?: string;
    suggestedValue: string;
    reason: string;
    confidence: number;
  }>;
  completenessScore: number;
  missingFields: string[];
  tokenUsage: AITokenUsage;
}

export interface MessageDraftResult {
  subject?: string;
  body: string;
  suggestedTone: 'formal' | 'friendly' | 'professional';
  alternativePhrasing: string[];
  tokenUsage: AITokenUsage;
}

export interface EmailSignalsResult {
  intent: 'buy' | 'sell' | 'invest' | 'general' | 'unknown';
  urgency: 'immediate' | 'high' | 'medium' | 'low' | 'none';
  budgetMin?: number;
  budgetMax?: number;
  financeStatus?: 'pre_approved' | 'self_funded' | 'seeking' | 'unknown';
  estimatedTimeline: string | null;
  propertyPreferences: string[];
  signals: Array<{
    signal: string;
    impact: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }>;
  overallConfidence: number;
  tokenUsage: AITokenUsage;
}

// ─── Client ─────────────────────────────────────────────────────────

/**
 * Client for the Anthropic Messages API.
 * Handles authentication, rate limiting, retry logic, and cost tracking.
 *
 * Uses raw fetch() — no SDK dependency — matching the integration pattern
 * used by DomainClient, MetaSocialClient, etc.
 */
export class AnthropicClient {
  private config: AnthropicConfig;
  private requestTimestamps: number[] = [];

  constructor(config: AnthropicConfigInput) {
    this.config = AnthropicConfigSchema.parse(config);
  }

  // ─── Public Methods ─────────────────────────────────────────────

  /**
   * Analyse a property listing description against a buyer's requirements.
   * Returns a feature score (0-100) with detailed match breakdown.
   */
  async analyzePropertyMatch(params: {
    listingDescription: string;
    mustHaves: string[];
    niceToHaves: string[];
    dealBreakers: string[];
    propertyContext?: { suburb: string; propertyType: string; bedrooms: number };
  }): Promise<PropertyAnalysisResult> {
    const prompt = buildPropertyAnalysisPrompt(params);
    const response = await this.sendMessage(prompt.system, prompt.user);

    const parsed = this.parseJsonResponse<{
      featureScore: number;
      features: AIFeatureMatchDetail[];
      dealBreakerFlags: string[];
      summary: string;
    }>(response.text);

    return {
      featureScore: Math.max(0, Math.min(100, Math.round(parsed.featureScore))),
      features: parsed.features ?? [],
      dealBreakerFlags: parsed.dealBreakerFlags ?? [],
      summary: parsed.summary ?? '',
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * Analyse enquiry text for lead scoring signals.
   * Returns buying signals, urgency, and a suggested score.
   */
  async analyzeLeadEnquiry(params: {
    enquiryText: string;
    contactContext?: { name: string; source: string };
  }): Promise<LeadScoringResult> {
    const prompt = buildLeadScoringPrompt(params);
    const response = await this.sendMessage(prompt.system, prompt.user);

    const parsed = this.parseJsonResponse<{
      signals: LeadScoringResult['signals'];
      urgencyLevel: LeadScoringResult['urgencyLevel'];
      estimatedTimeline: string | null;
      budgetConfidence: LeadScoringResult['budgetConfidence'];
      suggestedScore: number;
    }>(response.text);

    return {
      signals: parsed.signals ?? [],
      urgencyLevel: parsed.urgencyLevel ?? 'none',
      estimatedTimeline: parsed.estimatedTimeline ?? null,
      budgetConfidence: parsed.budgetConfidence ?? 'unknown',
      suggestedScore: Math.max(0, Math.min(100, Math.round(parsed.suggestedScore ?? 50))),
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * Suggest refinements to a client brief based on requirements and search history.
   */
  async suggestBriefRefinements(params: {
    brief: {
      mustHaves: string[];
      niceToHaves: string[];
      dealBreakers: string[];
      suburbs: string[];
      propertyTypes: string[];
      budget: { min: number; max: number };
    };
    searchHistory?: {
      rejectedProperties: number;
      averageScore: number;
      commonRejectionReasons: string[];
    };
  }): Promise<BriefRefinementResult> {
    const prompt = buildBriefRefinementPrompt(params);
    const response = await this.sendMessage(prompt.system, prompt.user);

    const parsed = this.parseJsonResponse<{
      suggestions: BriefRefinementResult['suggestions'];
      completenessScore: number;
      missingFields: string[];
    }>(response.text);

    return {
      suggestions: parsed.suggestions ?? [],
      completenessScore: Math.max(0, Math.min(100, Math.round(parsed.completenessScore ?? 50))),
      missingFields: parsed.missingFields ?? [],
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * Draft a channel-appropriate message (email/SMS/WhatsApp) for a given intent.
   * Returns the draft body, optional subject, tone, and alternative phrasings.
   */
  async draftMessage(params: {
    channel: 'email' | 'sms' | 'whatsapp';
    intent: string;
    toneHint?: 'formal' | 'friendly' | 'professional';
    contactContext?: {
      name: string;
      source?: string;
      pipelineStage?: string;
      recentActivities?: string[];
    };
  }): Promise<MessageDraftResult> {
    const prompt = buildMessageDraftPrompt(params);
    const response = await this.sendMessage(prompt.system, prompt.user);

    const parsed = this.parseJsonResponse<{
      subject?: string;
      body: string;
      suggestedTone: MessageDraftResult['suggestedTone'];
      alternativePhrasing: string[];
    }>(response.text);

    return {
      subject: parsed.subject,
      body: parsed.body ?? '',
      suggestedTone: parsed.suggestedTone ?? 'professional',
      alternativePhrasing: parsed.alternativePhrasing ?? [],
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * Extract lead qualification signals from an inbound email.
   * Returns intent, urgency, budget estimates, and individual buying signals.
   */
  async extractEmailSignals(params: {
    subject: string;
    body: string;
    fromEmail?: string;
    classifiedType?: string;
  }): Promise<EmailSignalsResult> {
    const prompt = buildEmailSignalExtractionPrompt(params);
    const response = await this.sendMessage(prompt.system, prompt.user);

    const parsed = this.parseJsonResponse<{
      intent: EmailSignalsResult['intent'];
      urgency: EmailSignalsResult['urgency'];
      budgetMin?: number;
      budgetMax?: number;
      financeStatus?: EmailSignalsResult['financeStatus'];
      estimatedTimeline: string | null;
      propertyPreferences: string[];
      signals: EmailSignalsResult['signals'];
      overallConfidence: number;
    }>(response.text);

    return {
      intent: parsed.intent ?? 'unknown',
      urgency: parsed.urgency ?? 'none',
      budgetMin: parsed.budgetMin,
      budgetMax: parsed.budgetMax,
      financeStatus: parsed.financeStatus,
      estimatedTimeline: parsed.estimatedTimeline ?? null,
      propertyPreferences: parsed.propertyPreferences ?? [],
      signals: parsed.signals ?? [],
      overallConfidence: Math.max(0, Math.min(1, parsed.overallConfidence ?? 0.5)),
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * Generate "why now" subtitles for a list of daily action candidates.
   * Returns an array of { index, subtitle } ordered by input index.
   */
  async generateDailyActionInsights(
    candidates: DailyActionCandidateInput[],
  ): Promise<Array<{ index: number; subtitle: string; tokenUsage: AITokenUsage }>> {
    if (candidates.length === 0) return [];

    const prompt = buildDailyActionsPrompt(candidates);
    const response = await this.sendMessage(prompt.system, prompt.user);

    const parsed = this.parseJsonResponse<{ items: Array<{ index: number; subtitle: string }> }>(response.text);

    return (parsed.items ?? []).map((item) => ({
      index: item.index,
      subtitle: item.subtitle ?? '',
      tokenUsage: response.tokenUsage,
    }));
  }

  /**
   * Generate AI-drafted message content for a follow-up sequence step.
   * Returns subject (email only) + body + suggested tone.
   */
  async generateSequenceContent(params: SequenceContentInput): Promise<{
    subject?: string;
    body: string;
    suggestedTone: 'formal' | 'friendly' | 'professional';
    tokenUsage: AITokenUsage;
  }> {
    const prompt = buildSequenceContentPrompt(params);
    const response = await this.sendMessage(prompt.system, prompt.user);

    const parsed = this.parseJsonResponse<{
      subject?: string;
      body: string;
      suggestedTone: 'formal' | 'friendly' | 'professional';
    }>(response.text);

    return {
      subject: parsed.subject,
      body: parsed.body ?? '',
      suggestedTone: parsed.suggestedTone ?? 'professional',
      tokenUsage: response.tokenUsage,
    };
  }

  // ─── Private Methods ────────────────────────────────────────────

  private async sendMessage(
    system: string,
    userContent: string,
    retryCount = 0,
  ): Promise<{ text: string; tokenUsage: AITokenUsage }> {
    await this.enforceRateLimit();

    const messages: AnthropicMessage[] = [{ role: 'user', content: userContent }];

    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.defaultTemperature,
        system,
        messages,
      }),
    });

    this.requestTimestamps.push(Date.now());

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const errorResponse = errorBody as AnthropicErrorResponse | null;
      const errorType = errorResponse?.error?.type ?? 'unknown';
      const errorMessage = errorResponse?.error?.message ?? response.statusText;

      // Retry on rate limit (429) and overloaded (529)
      if ((response.status === 429 || response.status === 529) && retryCount < this.config.maxRetries) {
        const delayMs = Math.min(this.config.retryBaseDelayMs * Math.pow(2, retryCount) + Math.random() * 500, 30_000);
        await this.sleep(delayMs);
        return this.sendMessage(system, userContent, retryCount + 1);
      }

      throw new AnthropicAPIError(
        `Anthropic API error: ${errorMessage}`,
        response.status,
        response.statusText,
        errorType,
      );
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content[0]?.text ?? '';

    const tokenUsage: AITokenUsage = {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      model: data.model,
      estimatedCostAud: this.calculateCost(data.model, data.usage.input_tokens, data.usage.output_tokens),
    };

    return { text, tokenUsage };
  }

  private parseJsonResponse<T>(text: string): T {
    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch (error: unknown) {
      throw new AnthropicAPIError(
        `Failed to parse AI response as JSON: ${cleaned.slice(0, 200)}`,
        0,
        'parse_error',
        'invalid_response',
      );
    }
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const inputRate = COST_PER_MILLION_INPUT[model] ?? COST_PER_MILLION_INPUT['claude-sonnet-4-20250514']!;
    const outputRate = COST_PER_MILLION_OUTPUT[model] ?? COST_PER_MILLION_OUTPUT['claude-sonnet-4-20250514']!;

    return (
      (inputTokens / 1_000_000) * inputRate +
      (outputTokens / 1_000_000) * outputRate
    );
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 60_000;

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < windowMs);

    if (this.requestTimestamps.length >= this.config.rateLimitPerMinute) {
      const oldestInWindow = this.requestTimestamps[0]!;
      const waitMs = windowMs - (now - oldestInWindow) + 100;
      await this.sleep(waitMs);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
