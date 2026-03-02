import { z } from 'zod';

// ─── Period ───────────────────────────────────────────────────────────────────

export const AnalyticsPeriodSchema = z.enum(['7d', '30d', '90d', 'ytd']);
export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriodSchema>;

// ─── Pipeline Velocity ────────────────────────────────────────────────────────

export const PipelineVelocitySchema = z.object({
  stage: z.string(),
  pipelineType: z.enum(['buyer', 'seller', 'buyers_agent']),
  activeCount: z.number().int().min(0),
  avgDaysInStage: z.number().min(0),
  conversionRate: z.number().min(0).max(100),
  new30d: z.number().int().min(0),
});

// ─── Agent Performance ────────────────────────────────────────────────────────

export const AgentPerformanceSchema = z.object({
  agentId: z.string().uuid(),
  agentName: z.string(),
  period: AnalyticsPeriodSchema,
  dealsSettled: z.number().int().min(0),
  dealsInProgress: z.number().int().min(0),
  totalRevenue: z.number().min(0),
  avgDealValue: z.number().min(0),
  avgResponseTimeMinutes: z.number().nullable(),
  messagesSent: z.number().int().min(0),
  inspectionsDone: z.number().int().min(0),
  offerConversionRate: z.number().min(0).max(100),
});

// ─── Market Insight ───────────────────────────────────────────────────────────

export const MarketInsightSchema = z.object({
  suburb: z.string(),
  postcode: z.string().nullable(),
  state: z.string().nullable(),
  propertyType: z.enum(['house', 'unit', 'townhouse']),
  medianSalePrice: z.number().nullable(),
  medianDaysOnMarket: z.number().nullable(),
  clearanceRate: z.number().nullable(),
  priceChange1yPercent: z.number().nullable(),
  snapshotDate: z.string().date(),
});

// ─── Revenue Forecast ─────────────────────────────────────────────────────────

export const RevenueForecastSchema = z.object({
  period: AnalyticsPeriodSchema,
  earnedRevenue: z.number().min(0),
  pipelineValue: z.number().min(0),
  forecastRevenue: z.number().min(0),
  retainerFees: z.number().min(0),
  successFees: z.number().min(0),
  referralFees: z.number().min(0),
});

// ─── Daily Snapshot (stored in DB) ───────────────────────────────────────────

export const AnalyticsDailySnapshotSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  snapshotDate: z.string().date(),
  activeClientsCount: z.number().int().min(0),
  newLeadsCount: z.number().int().min(0),
  leadsContactedCount: z.number().int().min(0),
  briefsCreatedCount: z.number().int().min(0),
  inspectionsDoneCount: z.number().int().min(0),
  offersSubmittedCount: z.number().int().min(0),
  contractsSignedCount: z.number().int().min(0),
  settlementsCount: z.number().int().min(0),
  stageVelocity: z.array(z.unknown()),
  revenueEarnedAud: z.number().min(0),
  pipelineValueAud: z.number().min(0),
  avgDealValueAud: z.number().min(0),
  messagesSentCount: z.number().int().min(0),
  avgResponseTimeMinutes: z.number().nullable(),
  aiMatchesRun: z.number().int().min(0),
  aiCostAud: z.number().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ─── Full Dashboard Snapshot ──────────────────────────────────────────────────

export const DashboardSnapshotSchema = z.object({
  pipelineVelocity: z.array(PipelineVelocitySchema),
  agentPerformance: AgentPerformanceSchema,
  marketInsights: z.array(MarketInsightSchema),
  revenue: RevenueForecastSchema,
  generatedAt: z.string().datetime(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type PipelineVelocity        = z.infer<typeof PipelineVelocitySchema>;
export type AgentPerformance        = z.infer<typeof AgentPerformanceSchema>;
export type MarketInsight           = z.infer<typeof MarketInsightSchema>;
export type RevenueForecast         = z.infer<typeof RevenueForecastSchema>;
export type AnalyticsDailySnapshot  = z.infer<typeof AnalyticsDailySnapshotSchema>;
export type DashboardSnapshot       = z.infer<typeof DashboardSnapshotSchema>;
