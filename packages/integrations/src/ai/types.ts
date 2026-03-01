import { z } from 'zod';

// ─── AI Provider Configuration ─────────────────────────────────────
export const AIProviderSchema = z.enum(['anthropic', 'openai']);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AIConfigSchema = z.object({
  provider: AIProviderSchema.default('anthropic'),
  apiKey: z.string().min(1),
  model: z.string().default('claude-sonnet-4-20250514'),
  maxTokens: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(1).default(0.3),
  baseUrl: z.string().url().optional(),
});
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type AIConfigInput = z.input<typeof AIConfigSchema>;

// ─── AI Message Types ──────────────────────────────────────────────
export const AIRoleSchema = z.enum(['system', 'user', 'assistant']);
export type AIRole = z.infer<typeof AIRoleSchema>;

export const AIMessageSchema = z.object({
  role: AIRoleSchema,
  content: z.string(),
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

// ─── AI Completion Request ─────────────────────────────────────────
export const AICompletionRequestSchema = z.object({
  messages: z.array(AIMessageSchema).min(1),
  systemPrompt: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  jsonMode: z.boolean().default(false),
});
export type AICompletionRequest = z.infer<typeof AICompletionRequestSchema>;

// ─── AI Completion Response ────────────────────────────────────────
export const AICompletionResponseSchema = z.object({
  content: z.string(),
  finishReason: z.enum(['stop', 'max_tokens', 'error']),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
  model: z.string(),
  provider: AIProviderSchema,
});
export type AICompletionResponse = z.infer<typeof AICompletionResponseSchema>;

// ─── AI Analysis Types (domain-specific) ───────────────────────────
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const AIInsightSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'property_analysis',
    'market_summary',
    'brief_refinement',
    'risk_assessment',
    'recommendation',
    'consolidation_summary',
  ]),
  title: z.string(),
  content: z.string(),
  confidence: ConfidenceLevelSchema,
  metadata: z.record(z.unknown()).optional(),
  generatedAt: z.string().datetime(),
});
export type AIInsight = z.infer<typeof AIInsightSchema>;

export const PropertyDescriptionAnalysisSchema = z.object({
  mustHaveMatches: z.array(z.object({
    requirement: z.string(),
    found: z.boolean(),
    evidence: z.string().optional(),
    confidence: ConfidenceLevelSchema,
  })),
  dealBreakerMatches: z.array(z.object({
    dealBreaker: z.string(),
    triggered: z.boolean(),
    evidence: z.string().optional(),
    confidence: ConfidenceLevelSchema,
  })),
  niceToHaveMatches: z.array(z.object({
    preference: z.string(),
    found: z.boolean(),
    evidence: z.string().optional(),
    confidence: ConfidenceLevelSchema,
  })),
  keyFeatures: z.array(z.string()),
  concerns: z.array(z.string()),
  overallSentiment: z.enum(['positive', 'neutral', 'negative']),
  summary: z.string(),
});
export type PropertyDescriptionAnalysis = z.infer<typeof PropertyDescriptionAnalysisSchema>;
