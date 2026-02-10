import { z } from 'zod';

// ─── Activity Types ─────────────────────────────────────────────────
export const ActivityTypeSchema = z.enum([
  'call',
  'email-sent',
  'email-received',
  'sms-sent',
  'sms-received',
  'meeting',
  'inspection',
  'open-home',
  'property-sent',
  'note-added',
  'stage-change',
  'task-completed',
  'document-uploaded',
  'offer-submitted',
  'contract-exchanged',
  'settlement-completed',
  'social-dm-sent',
  'social-dm-received',
  'inspection-logged',
  'property-matched',
  'offer-round',
  'dd-item-completed',
  'brief-updated',
  'system', // automated actions
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

// ─── Activity ───────────────────────────────────────────────────────
export const ActivitySchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  transactionId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  type: ActivityTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Activity = z.infer<typeof ActivitySchema>;

// ─── Create Activity ────────────────────────────────────────────────
export const CreateActivitySchema = ActivitySchema.omit({
  id: true,
  createdAt: true,
});
export type CreateActivity = z.infer<typeof CreateActivitySchema>;

// ─── Note ───────────────────────────────────────────────────────────
export const NoteSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  content: z.string().min(1),
  isPinned: z.boolean().default(false),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Note = z.infer<typeof NoteSchema>;

export const CreateNoteSchema = NoteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateNote = z.infer<typeof CreateNoteSchema>;
