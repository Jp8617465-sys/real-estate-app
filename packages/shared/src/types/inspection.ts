import { z } from 'zod';

// ─── Inspection Impression ─────────────────────────────────────────
export const InspectionImpressionSchema = z.enum(['positive', 'negative', 'neutral']);
export type InspectionImpression = z.infer<typeof InspectionImpressionSchema>;

// ─── Client Suitability ────────────────────────────────────────────
export const ClientSuitabilitySchema = z.enum(['match', 'maybe', 'no']);
export type ClientSuitability = z.infer<typeof ClientSuitabilitySchema>;

// ─── Inspection Photo ──────────────────────────────────────────────
export const InspectionPhotoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  caption: z.string().optional(),
  takenAt: z.string().datetime().optional(),
});
export type InspectionPhoto = z.infer<typeof InspectionPhotoSchema>;

// ─── Inspection ────────────────────────────────────────────────────
export const InspectionSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  sellingAgentId: z.string().uuid().optional(),

  inspectionDate: z.string().datetime(),
  timeSpentMinutes: z.number().int().positive().optional(),
  overallImpression: InspectionImpressionSchema,
  conditionNotes: z.string().optional(),
  areaFeelNotes: z.string().optional(),
  clientSuitability: ClientSuitabilitySchema.optional(),

  photos: z.array(InspectionPhotoSchema),
  voiceNoteUrl: z.string().url().optional(),
  voiceNoteTranscript: z.string().optional(),
  agentNotes: z.string().optional(),

  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Inspection = z.infer<typeof InspectionSchema>;

// ─── Create Inspection ─────────────────────────────────────────────
export const CreateInspectionSchema = InspectionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  photos: true,
});
export type CreateInspection = z.infer<typeof CreateInspectionSchema>;

// ─── Update Inspection ─────────────────────────────────────────────
export const UpdateInspectionSchema = CreateInspectionSchema.partial();
export type UpdateInspection = z.infer<typeof UpdateInspectionSchema>;
