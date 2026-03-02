import { z } from 'zod';

// ─── AI Token Usage (for cost tracking) ─────────────────────────────
export const AITokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  model: z.string(),
  estimatedCostAud: z.number().nonnegative(),
});
export type AITokenUsage = z.infer<typeof AITokenUsageSchema>;

// ─── Feature Match Detail ───────────────────────────────────────────
export const AIFeatureMatchDetailSchema = z.object({
  feature: z.string(),
  status: z.enum(['matched', 'not_matched', 'partial', 'unknown']),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  source: z.enum(['must_have', 'nice_to_have', 'deal_breaker']),
});
export type AIFeatureMatchDetail = z.infer<typeof AIFeatureMatchDetailSchema>;

// ─── AI Property Analysis Result ────────────────────────────────────
export const AIPropertyAnalysisSchema = z.object({
  propertyId: z.string().uuid(),
  featureScore: z.number().min(0).max(100),
  featureMatches: z.array(AIFeatureMatchDetailSchema),
  dealBreakerFlags: z.array(z.string()),
  summary: z.string(),
  tokenUsage: AITokenUsageSchema,
  cachedAt: z.string().datetime().optional(),
});
export type AIPropertyAnalysis = z.infer<typeof AIPropertyAnalysisSchema>;

// ─── AI Enhanced Match Result ───────────────────────────────────────
export const AIEnhancedMatchResultSchema = z.object({
  propertyId: z.string().uuid(),
  clientBriefId: z.string().uuid(),
  clientId: z.string().uuid(),
  overallScore: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    priceMatch: z.number().min(0).max(100),
    locationMatch: z.number().min(0).max(100),
    sizeMatch: z.number().min(0).max(100),
    featureMatch: z.number().min(0).max(100),
    investorMatch: z.number().min(0).max(100).optional(),
  }),
  flags: z.array(z.string()),
  aiAnalysis: AIPropertyAnalysisSchema.optional(),
  matchExplanation: z.string().optional(),
});
export type AIEnhancedMatchResult = z.infer<typeof AIEnhancedMatchResultSchema>;

// ─── AI Lead Score Enhancement ──────────────────────────────────────
export const AILeadSignalSchema = z.object({
  signal: z.string(),
  impact: z.enum(['positive', 'negative', 'neutral']),
  weight: z.number(),
  explanation: z.string(),
});
export type AILeadSignal = z.infer<typeof AILeadSignalSchema>;

export const AILeadScoreEnhancementSchema = z.object({
  contactId: z.string().uuid(),
  baseScore: z.number().min(0).max(100),
  aiAdjustment: z.number().min(-50).max(50),
  finalScore: z.number().min(0).max(100),
  signals: z.array(AILeadSignalSchema),
  urgencyLevel: z.enum(['immediate', 'high', 'medium', 'low', 'none']),
  estimatedTimeline: z.string().optional(),
  budgetConfidence: z.enum(['high', 'medium', 'low', 'unknown']),
  tokenUsage: AITokenUsageSchema,
});
export type AILeadScoreEnhancement = z.infer<typeof AILeadScoreEnhancementSchema>;

// ─── AI Brief Refinement ────────────────────────────────────────────
export const AIBriefSuggestionSchema = z.object({
  field: z.string(),
  currentValue: z.string().optional(),
  suggestedValue: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});
export type AIBriefSuggestion = z.infer<typeof AIBriefSuggestionSchema>;

export const AIBriefRefinementSchema = z.object({
  clientBriefId: z.string().uuid(),
  suggestions: z.array(AIBriefSuggestionSchema),
  completenessScore: z.number().min(0).max(100),
  missingFields: z.array(z.string()),
  tokenUsage: AITokenUsageSchema,
});
export type AIBriefRefinement = z.infer<typeof AIBriefRefinementSchema>;

// ─── AI Message Draft ────────────────────────────────────────────────
export const AIMessageDraftResultSchema = z.object({
  subject: z.string().optional(),
  body: z.string(),
  suggestedTone: z.enum(['formal', 'friendly', 'professional']),
  alternativePhrasing: z.array(z.string()),
  tokenUsage: AITokenUsageSchema,
});
export type AIMessageDraftResult = z.infer<typeof AIMessageDraftResultSchema>;

// ─── AI Request Schemas (for API input validation) ───────────────────

export const AIMessageDraftRequestSchema = z.object({
  contactId: z.string().uuid(),
  channel: z.enum(['email', 'sms', 'whatsapp']),
  intent: z.string().min(1).max(500),
  toneHint: z.enum(['formal', 'friendly', 'professional']).optional(),
});
export type AIMessageDraftRequest = z.infer<typeof AIMessageDraftRequestSchema>;

export const AIEmailSignalsRequestSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  fromEmail: z.string().email().optional(),
  classifiedType: z.string().optional(),
});
export type AIEmailSignalsRequest = z.infer<typeof AIEmailSignalsRequestSchema>;

// ─── AI Narrative Request ────────────────────────────────────────────
export const AINarrativeRequestSchema = z.object({
  clientId: z.string().uuid(),
  propertyIds: z.array(z.string().uuid()).max(20).optional(),
});
export type AINarrativeRequest = z.infer<typeof AINarrativeRequestSchema>;

// ─── AI Email Signal Extraction ──────────────────────────────────────
export const AIEmailSignalSchema = z.object({
  signal: z.string(),
  impact: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
});
export type AIEmailSignal = z.infer<typeof AIEmailSignalSchema>;

export const AIEmailSignalsSchema = z.object({
  intent: z.enum(['buy', 'sell', 'invest', 'general', 'unknown']),
  urgency: z.enum(['immediate', 'high', 'medium', 'low', 'none']),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  financeStatus: z.enum(['pre_approved', 'self_funded', 'seeking', 'unknown']).optional(),
  estimatedTimeline: z.string().nullable(),
  propertyPreferences: z.array(z.string()),
  signals: z.array(AIEmailSignalSchema),
  overallConfidence: z.number().min(0).max(1),
  tokenUsage: AITokenUsageSchema,
});
export type AIEmailSignals = z.infer<typeof AIEmailSignalsSchema>;
