import { z } from 'zod';

// ─── Report Type ───────────────────────────────────────────────────
export const ConsolidationReportTypeSchema = z.enum([
  'client_brief_summary',
  'property_comparison',
  'market_analysis',
  'search_progress',
  'due_diligence_summary',
  'settlement_outcome',
]);
export type ConsolidationReportType = z.infer<typeof ConsolidationReportTypeSchema>;

// ─── Report Status ─────────────────────────────────────────────────
export const ConsolidationReportStatusSchema = z.enum([
  'generating',
  'ready',
  'sent_to_client',
  'archived',
  'failed',
]);
export type ConsolidationReportStatus = z.infer<typeof ConsolidationReportStatusSchema>;

// ─── Property Ranking ──────────────────────────────────────────────
export const PropertyRankingSchema = z.object({
  propertyId: z.string().uuid(),
  address: z.string(),
  rank: z.number().int().positive(),
  overallScore: z.number().min(0).max(100),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  recommendation: z.string(),
  inspectionSummary: z.string().optional(),
  ddCompletionPercent: z.number().min(0).max(100).optional(),
});
export type PropertyRanking = z.infer<typeof PropertyRankingSchema>;

// ─── Market Snapshot ───────────────────────────────────────────────
export const MarketSnapshotSchema = z.object({
  suburb: z.string(),
  state: z.string(),
  medianPrice: z.number().nonnegative().optional(),
  medianPriceChange12m: z.number().optional(),
  daysOnMarket: z.number().int().nonnegative().optional(),
  auctionClearanceRate: z.number().min(0).max(100).optional(),
  totalListings: z.number().int().nonnegative().optional(),
  dataAsOf: z.string().datetime().optional(),
});
export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

// ─── Risk Item ─────────────────────────────────────────────────────
export const ReportRiskItemSchema = z.object({
  category: z.enum(['financial', 'legal', 'physical', 'market', 'timeline', 'compliance']),
  severity: z.enum(['high', 'medium', 'low']),
  description: z.string(),
  mitigationAction: z.string().optional(),
});
export type ReportRiskItem = z.infer<typeof ReportRiskItemSchema>;

// ─── Recommended Action ────────────────────────────────────────────
export const RecommendedActionSchema = z.object({
  action: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  assignee: z.enum(['agent', 'client', 'solicitor', 'broker']).optional(),
  deadline: z.string().optional(),
  completed: z.boolean().default(false),
});
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;

// ─── Consolidation Report Content ──────────────────────────────────
export const ConsolidationReportContentSchema = z.object({
  executiveSummary: z.string(),
  propertyRankings: z.array(PropertyRankingSchema).optional(),
  marketSnapshots: z.array(MarketSnapshotSchema).optional(),
  risks: z.array(ReportRiskItemSchema).optional(),
  recommendedActions: z.array(RecommendedActionSchema).optional(),
  searchProgress: z
    .object({
      propertiesReviewed: z.number().int().nonnegative(),
      inspectionsCompleted: z.number().int().nonnegative(),
      offersMade: z.number().int().nonnegative(),
      daysInSearch: z.number().int().nonnegative(),
    })
    .optional(),
  ddSummary: z
    .object({
      totalItems: z.number().int().nonnegative(),
      completedItems: z.number().int().nonnegative(),
      criticalPending: z.number().int().nonnegative(),
      completionPercent: z.number().min(0).max(100),
    })
    .optional(),
  aiConfidence: z.enum(['high', 'medium', 'low']).optional(),
  rawDataSources: z.array(z.string()).optional(),
});
export type ConsolidationReportContent = z.infer<typeof ConsolidationReportContentSchema>;

// ─── Consolidation Report ──────────────────────────────────────────
export const ConsolidationReportSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  clientBriefId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),

  type: ConsolidationReportTypeSchema,
  title: z.string().min(1),
  status: ConsolidationReportStatusSchema.default('generating'),

  content: ConsolidationReportContentSchema,

  generatedBy: z.enum(['ai', 'manual', 'automated']).default('ai'),
  generatedAt: z.string().datetime(),
  sentToClientAt: z.string().datetime().optional(),

  version: z.number().int().positive().default(1),
  previousVersionId: z.string().uuid().optional(),

  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().optional(),
});
export type ConsolidationReport = z.infer<typeof ConsolidationReportSchema>;

// ─── Create Consolidation Report ───────────────────────────────────
export const CreateConsolidationReportSchema = ConsolidationReportSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  generatedAt: true,
  version: true,
});
export type CreateConsolidationReport = z.infer<typeof CreateConsolidationReportSchema>;

// ─── Report Generation Request ─────────────────────────────────────
export const GenerateReportRequestSchema = z.object({
  clientId: z.string().uuid(),
  clientBriefId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  type: ConsolidationReportTypeSchema,
  propertyIds: z.array(z.string().uuid()).optional(),
  includeMarketData: z.boolean().default(true),
  includeDueDiligence: z.boolean().default(true),
  includeInspections: z.boolean().default(true),
});
export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;
