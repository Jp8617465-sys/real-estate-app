import { z } from 'zod';
import { AIClient } from './client';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from './prompts';
import {
  PropertyDescriptionAnalysisSchema,
  type AIConfigInput,
  type PropertyDescriptionAnalysis,
  type AIInsight,
} from './types';

// ─── Analysis Request Schema ───────────────────────────────────────
export const PropertyAnalysisRequestSchema = z.object({
  propertyId: z.string().uuid(),
  description: z.string().min(1),
  address: z.string().optional(),
  listingPrice: z.number().nonnegative().optional(),
  mustHaves: z.array(z.string()),
  dealBreakers: z.array(z.string()),
  niceToHaves: z.array(z.string()),
  budgetMin: z.number().nonnegative(),
  budgetMax: z.number().positive(),
  propertyTypes: z.array(z.string()),
  clientBriefId: z.string().uuid().optional(),
});
export type PropertyAnalysisRequest = z.infer<typeof PropertyAnalysisRequestSchema>;

// ─── Consolidation Report Schema ───────────────────────────────────
const ConsolidationReportResponseSchema = z.object({
  executiveSummary: z.string(),
  propertyRankings: z.array(z.object({
    address: z.string(),
    rank: z.number().int().positive(),
    score: z.number().min(0).max(100),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    recommendation: z.string(),
  })),
  marketContext: z.string(),
  riskAssessment: z.array(z.string()),
  recommendedActions: z.array(z.object({
    action: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    deadline: z.string().optional(),
  })),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type ConsolidationReportResponse = z.infer<typeof ConsolidationReportResponseSchema>;

// ─── Brief Refinement Schema ───────────────────────────────────────
const BriefRefinementResponseSchema = z.object({
  suggestedChanges: z.array(z.object({
    field: z.string(),
    currentValue: z.string(),
    suggestedValue: z.string(),
    reason: z.string(),
  })),
  missingInformation: z.array(z.string()),
  conflictsIdentified: z.array(z.object({
    conflict: z.string(),
    suggestion: z.string(),
  })),
  suburbSuggestions: z.array(z.object({
    suburb: z.string(),
    reason: z.string(),
    medianPrice: z.string().optional(),
  })),
  overallAssessment: z.string(),
});
export type BriefRefinementResponse = z.infer<typeof BriefRefinementResponseSchema>;

/**
 * AI-powered property analysis and research consolidation service.
 * Uses LLM to enhance the rule-based PropertyMatchEngine with
 * natural language understanding of property descriptions and
 * consolidated research report generation.
 */
export class PropertyAnalysisService {
  private client: AIClient;

  constructor(config: AIConfigInput) {
    this.client = new AIClient(config);
  }

  /**
   * Analyze a property description against client requirements using NLP.
   * Enhances the rule-based PropertyMatchEngine by understanding
   * free-text descriptions, identifying must-haves/deal-breakers
   * that can't be detected from structured data alone.
   */
  async analyzePropertyDescription(
    request: PropertyAnalysisRequest,
  ): Promise<PropertyDescriptionAnalysis> {
    const validated = PropertyAnalysisRequestSchema.parse(request);

    const prompt = PROMPT_TEMPLATES.analyzePropertyDescription({
      description: validated.description,
      mustHaves: validated.mustHaves,
      dealBreakers: validated.dealBreakers,
      niceToHaves: validated.niceToHaves,
      budgetMin: validated.budgetMin,
      budgetMax: validated.budgetMax,
      propertyTypes: validated.propertyTypes,
    });

    return this.client.analyzeJSON(
      {
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: SYSTEM_PROMPTS.propertyAnalysis,
      },
      PropertyDescriptionAnalysisSchema,
    );
  }

  /**
   * Generate a consolidated research report for a client.
   * Aggregates property match data, market context, inspection notes,
   * and DD status into a structured client-facing report.
   */
  async generateConsolidationReport(params: {
    clientName: string;
    briefSummary: string;
    properties: Array<{ address: string; score: number; notes: string }>;
    marketData: string;
    ddStatus: string;
  }): Promise<ConsolidationReportResponse> {
    const prompt = PROMPT_TEMPLATES.consolidateResearch(params);

    return this.client.analyzeJSON(
      {
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: SYSTEM_PROMPTS.researchConsolidation,
        maxTokens: 8192,
      },
      ConsolidationReportResponseSchema,
    );
  }

  /**
   * Analyze a client brief and suggest refinements based on
   * search history and client feedback patterns.
   */
  async refineBrief(params: {
    currentBrief: string;
    searchHistory: string;
    clientFeedback: string;
  }): Promise<BriefRefinementResponse> {
    const prompt = PROMPT_TEMPLATES.refineBrief(params);

    return this.client.analyzeJSON(
      {
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: SYSTEM_PROMPTS.briefRefinement,
      },
      BriefRefinementResponseSchema,
    );
  }

  /**
   * Generate a free-form AI insight for a given context.
   * Used by workflow automation to produce ad-hoc analysis.
   */
  async generateInsight(params: {
    type: AIInsight['type'];
    context: string;
    systemPrompt?: string;
  }): Promise<{ title: string; content: string; confidence: 'high' | 'medium' | 'low' }> {
    const InsightResponseSchema = z.object({
      title: z.string(),
      content: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
    });

    const systemPrompt = params.systemPrompt ?? SYSTEM_PROMPTS.researchConsolidation;

    return this.client.analyzeJSON(
      {
        messages: [{ role: 'user', content: params.context }],
        systemPrompt: `${systemPrompt}\n\nRespond with JSON: {"title": "...", "content": "...", "confidence": "high|medium|low"}`,
      },
      InsightResponseSchema,
    );
  }

  /**
   * Draft a professional message (email/SMS) for a buyers agent.
   */
  async draftMessage(params: {
    recipient: 'client' | 'selling_agent' | 'solicitor' | 'broker';
    purpose: string;
    context: string;
    tone?: 'formal' | 'friendly' | 'urgent';
  }): Promise<{ subject: string; body: string }> {
    const MessageResponseSchema = z.object({
      subject: z.string(),
      body: z.string(),
    });

    const prompt = `Draft a ${params.tone ?? 'professional'} message to a ${params.recipient}.

Purpose: ${params.purpose}
Context: ${params.context}

Respond with JSON: {"subject": "...", "body": "..."}`;

    return this.client.analyzeJSON(
      {
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: SYSTEM_PROMPTS.messageDrafting,
      },
      MessageResponseSchema,
    );
  }
}
