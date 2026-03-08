import { z } from 'zod';

// ─── Off-Market Property Source ──────────────────────────────────────────────

export const OffMarketSourceSchema = z.enum([
  'vendor_direct',
  'selling_agent',
  'referral',
  'door_knock',
  'other',
]);
export type OffMarketSource = z.infer<typeof OffMarketSourceSchema>;

// ─── Off-Market Property Status ──────────────────────────────────────────────

export const OffMarketStatusSchema = z.enum(['active', 'under_offer', 'sold', 'withdrawn']);
export type OffMarketStatus = z.infer<typeof OffMarketStatusSchema>;

// ─── Off-Market Visibility ───────────────────────────────────────────────────

export const OffMarketVisibilitySchema = z.enum(['agent_only', 'sent_to_client']);
export type OffMarketVisibility = z.infer<typeof OffMarketVisibilitySchema>;

// ─── Off-Market Property Type (simplified vs full property type) ─────────────

export const OffMarketPropertyTypeSchema = z.enum([
  'house',
  'apartment',
  'townhouse',
  'land',
  'other',
]);
export type OffMarketPropertyType = z.infer<typeof OffMarketPropertyTypeSchema>;

// ─── Off-Market Property ─────────────────────────────────────────────────────

export const OffMarketPropertySchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  officeId: z.string().uuid(),
  addressLine1: z.string().min(1),
  suburb: z.string().min(1),
  state: z.enum(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']),
  postcode: z.string().regex(/^\d{4}$/),
  propertyType: OffMarketPropertyTypeSchema,
  bedrooms: z.number().int().nonnegative().nullable(),
  bathrooms: z.number().int().nonnegative().nullable(),
  carSpaces: z.number().int().nonnegative().nullable(),
  landSizeSqm: z.number().positive().nullable(),
  askingPrice: z.number().positive().nullable(),
  source: OffMarketSourceSchema,
  sourceName: z.string().nullable(),
  agentNotes: z.string().nullable(),
  visibility: OffMarketVisibilitySchema,
  status: OffMarketStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type OffMarketProperty = z.infer<typeof OffMarketPropertySchema>;

// ─── Create Off-Market Property ──────────────────────────────────────────────

export const CreateOffMarketPropertySchema = z.object({
  addressLine1: z.string().min(1),
  suburb: z.string().min(1),
  state: z.enum(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']),
  postcode: z.string().regex(/^\d{4}$/),
  propertyType: OffMarketPropertyTypeSchema,
  bedrooms: z.number().int().nonnegative().nullable().optional(),
  bathrooms: z.number().int().nonnegative().nullable().optional(),
  carSpaces: z.number().int().nonnegative().nullable().optional(),
  landSizeSqm: z.number().positive().nullable().optional(),
  askingPrice: z.number().positive().nullable().optional(),
  source: OffMarketSourceSchema,
  sourceName: z.string().nullable().optional(),
  agentNotes: z.string().nullable().optional(),
});
export type CreateOffMarketProperty = z.infer<typeof CreateOffMarketPropertySchema>;

// ─── Update Off-Market Property ──────────────────────────────────────────────

export const UpdateOffMarketPropertySchema = CreateOffMarketPropertySchema.partial().extend({
  status: OffMarketStatusSchema.optional(),
  visibility: OffMarketVisibilitySchema.optional(),
});
export type UpdateOffMarketProperty = z.infer<typeof UpdateOffMarketPropertySchema>;

// ─── Off-Market Match ────────────────────────────────────────────────────────

export const OffMarketMatchStatusSchema = z.enum(['new', 'sent_to_client', 'rejected']);
export type OffMarketMatchStatus = z.infer<typeof OffMarketMatchStatusSchema>;

export const OffMarketMatchSchema = z.object({
  id: z.string().uuid(),
  offMarketId: z.string().uuid(),
  clientBriefId: z.string().uuid(),
  matchScore: z.number().min(0).max(100),
  status: OffMarketMatchStatusSchema,
  sentToClientAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type OffMarketMatch = z.infer<typeof OffMarketMatchSchema>;

// ─── Off-Market Stats ────────────────────────────────────────────────────────

export const OffMarketStatsSchema = z.object({
  totalOffMarket: z.number().int().nonnegative(),
  totalOnMarket: z.number().int().nonnegative(),
  offMarketClosed: z.number().int().nonnegative(),
  onMarketClosed: z.number().int().nonnegative(),
  offMarketSuccessRate: z.number().min(0).max(100),
  onMarketSuccessRate: z.number().min(0).max(100),
});
export type OffMarketStats = z.infer<typeof OffMarketStatsSchema>;
