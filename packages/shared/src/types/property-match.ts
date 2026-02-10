import { z } from 'zod';

// ─── Match Score Breakdown ─────────────────────────────────────────
export const MatchScoreBreakdownSchema = z.object({
  priceMatch: z.number().min(0).max(100),
  locationMatch: z.number().min(0).max(100),
  sizeMatch: z.number().min(0).max(100),
  featureMatch: z.number().min(0).max(100),
  investorMatch: z.number().min(0).max(100).optional(),
});
export type MatchScoreBreakdown = z.infer<typeof MatchScoreBreakdownSchema>;

// ─── Property Match Status ─────────────────────────────────────────
export const PropertyMatchStatusSchema = z.enum([
  'new',
  'sent_to_client',
  'client_interested',
  'inspection_booked',
  'rejected',
  'under_review',
]);
export type PropertyMatchStatus = z.infer<typeof PropertyMatchStatusSchema>;

// ─── Property Match ────────────────────────────────────────────────
export const PropertyMatchSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  clientBriefId: z.string().uuid(),
  clientId: z.string().uuid(),

  overallScore: z.number().int().min(0).max(100),
  scoreBreakdown: MatchScoreBreakdownSchema,

  status: PropertyMatchStatusSchema.default('new'),
  rejectionReason: z.string().optional(),
  agentNotes: z.string().optional(),

  matchedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PropertyMatch = z.infer<typeof PropertyMatchSchema>;

// ─── Create Property Match ─────────────────────────────────────────
export const CreatePropertyMatchSchema = PropertyMatchSchema.omit({
  id: true,
  matchedAt: true,
  updatedAt: true,
});
export type CreatePropertyMatch = z.infer<typeof CreatePropertyMatchSchema>;

// ─── Update Property Match ─────────────────────────────────────────
export const UpdatePropertyMatchSchema = z.object({
  status: PropertyMatchStatusSchema.optional(),
  rejectionReason: z.string().optional(),
  agentNotes: z.string().optional(),
});
export type UpdatePropertyMatch = z.infer<typeof UpdatePropertyMatchSchema>;
