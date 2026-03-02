import { z } from 'zod';

export const ActionItemCategorySchema = z.enum([
  'call',
  'follow_up',
  'key_date',
  'inspection',
  'offer_review',
  'document',
  'pre_approval',
  'settlement',
  'general',
]);
export type ActionItemCategory = z.infer<typeof ActionItemCategorySchema>;

export const DailyActionScoreComponentsSchema = z.object({
  urgencyScore: z.number(),
  recencyPenalty: z.number(),
  deadlineProximity: z.number(),
  leadScore: z.number(),
  compositeScore: z.number(),
});
export type DailyActionScoreComponents = z.infer<typeof DailyActionScoreComponentsSchema>;

export const DailyActionItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string(),
  rank: z.number().int(),
  category: ActionItemCategorySchema,
  title: z.string(),
  subtitle: z.string(),
  contactId: z.string().uuid().nullable().optional(),
  transactionId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  urgencyScore: z.number(),
  recencyPenalty: z.number(),
  deadlineProximity: z.number(),
  leadScore: z.number(),
  compositeScore: z.number(),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().nullable().optional(),
  aiModel: z.string().nullable().optional(),
  aiCostAud: z.number().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DailyActionItem = z.infer<typeof DailyActionItemSchema>;

export const DailyActionListSchema = z.object({
  date: z.string(),
  userId: z.string().uuid(),
  items: z.array(DailyActionItemSchema),
  generatedAt: z.string().datetime(),
  totalCount: z.number().int(),
  urgentCount: z.number().int(),
  completedCount: z.number().int(),
});
export type DailyActionList = z.infer<typeof DailyActionListSchema>;

// ─── Candidate (pre-DB, used during scoring) ──────────────────────────────────

export const DailyActionCandidateSchema = z.object({
  category: ActionItemCategorySchema,
  title: z.string(),
  contactId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  urgencyScore: z.number().default(0),
  recencyPenalty: z.number().default(0),
  deadlineProximity: z.number().default(0),
  leadScore: z.number().default(0),
  compositeScore: z.number().default(0),
  // Populated by AI
  subtitle: z.string().default(''),
  aiModel: z.string().optional(),
  aiCostAud: z.number().optional(),
});
export type DailyActionCandidate = z.infer<typeof DailyActionCandidateSchema>;
