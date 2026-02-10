import { z } from 'zod';

// ─── Key Date Status ───────────────────────────────────────────────
export const KeyDateStatusSchema = z.enum(['upcoming', 'due_soon', 'overdue', 'completed']);
export type KeyDateStatus = z.infer<typeof KeyDateStatusSchema>;

// ─── Key Date ──────────────────────────────────────────────────────
export const KeyDateSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),

  label: z.string(),
  date: z.string().datetime(),
  isCritical: z.boolean().default(false),
  reminderDaysBefore: z.array(z.number().int().positive()).default([7, 3, 1]),
  status: KeyDateStatusSchema.default('upcoming'),
  completedAt: z.string().datetime().optional(),
  notes: z.string().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type KeyDate = z.infer<typeof KeyDateSchema>;

// ─── Create Key Date ───────────────────────────────────────────────
export const CreateKeyDateSchema = KeyDateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type CreateKeyDate = z.infer<typeof CreateKeyDateSchema>;

// ─── Update Key Date ───────────────────────────────────────────────
export const UpdateKeyDateSchema = z.object({
  label: z.string().optional(),
  date: z.string().datetime().optional(),
  isCritical: z.boolean().optional(),
  reminderDaysBefore: z.array(z.number().int().positive()).optional(),
  status: KeyDateStatusSchema.optional(),
  completedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});
export type UpdateKeyDate = z.infer<typeof UpdateKeyDateSchema>;
