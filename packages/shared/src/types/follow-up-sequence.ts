import { z } from 'zod';

// ─── Sequence Step ─────────────────────────────────────────────────────────────
// Each step is a workflow action + a day offset from enrollment date.

export const SequenceStepActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('send_email'), templateId: z.string(), aiDraft: z.boolean().default(false) }),
  z.object({ type: z.literal('send_sms'), templateId: z.string(), aiDraft: z.boolean().default(false) }),
  z.object({ type: z.literal('create_task'), taskTitle: z.string(), taskType: z.string(), priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium') }),
  z.object({ type: z.literal('notify_agent'), message: z.string() }),
  z.object({ type: z.literal('add_tag'), tag: z.string() }),
  z.object({ type: z.literal('update_field'), field: z.string(), value: z.unknown() }),
]);
export type SequenceStepAction = z.infer<typeof SequenceStepActionSchema>;

export const SequenceStepSchema = z.object({
  index: z.number().int().min(0),
  // Day offset from enrollment (0 = immediately, 2 = 2 days after enrollment)
  dayOffset: z.number().int().min(0),
  action: SequenceStepActionSchema,
  // Optional condition: only execute if contact hasn't responded
  skipIfResponded: z.boolean().default(false),
  label: z.string().optional(),
});
export type SequenceStep = z.infer<typeof SequenceStepSchema>;

// ─── Follow-Up Sequence ───────────────────────────────────────────────────────

export const FollowUpSequenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  triggerType: z.enum(['new_lead', 'stage_change', 'no_activity', 'date_approaching', 'manual']),
  triggerConfig: z.record(z.unknown()),
  steps: z.array(SequenceStepSchema),
  isTemplate: z.boolean(),
  isActive: z.boolean(),
  createdBy: z.string().uuid().nullable().optional(),
  isDeleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FollowUpSequence = z.infer<typeof FollowUpSequenceSchema>;

export const CreateFollowUpSequenceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  triggerType: z.enum(['new_lead', 'stage_change', 'no_activity', 'date_approaching', 'manual']),
  triggerConfig: z.record(z.unknown()).default({}),
  steps: z.array(SequenceStepSchema).min(1),
});
export type CreateFollowUpSequence = z.infer<typeof CreateFollowUpSequenceSchema>;

// ─── Sequence Enrollment ──────────────────────────────────────────────────────

export const EnrollmentStatusSchema = z.enum(['active', 'paused', 'completed', 'cancelled']);
export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>;

export const SequenceEnrollmentSchema = z.object({
  id: z.string().uuid(),
  sequenceId: z.string().uuid(),
  contactId: z.string().uuid(),
  transactionId: z.string().uuid().nullable().optional(),
  enrolledBy: z.string().uuid().nullable().optional(),
  currentStepIndex: z.number().int(),
  status: EnrollmentStatusSchema,
  preferredSendHour: z.number().int().min(0).max(23).nullable().optional(),
  lastStepSentAt: z.string().datetime().nullable().optional(),
  nextStepDueAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  cancelledAt: z.string().datetime().nullable().optional(),
  aiContentOverrides: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SequenceEnrollment = z.infer<typeof SequenceEnrollmentSchema>;

export const CreateEnrollmentSchema = z.object({
  sequenceId: z.string().uuid(),
  contactId: z.string().uuid(),
  transactionId: z.string().uuid().optional(),
  enrolledBy: z.string().uuid().optional(),
});
export type CreateEnrollment = z.infer<typeof CreateEnrollmentSchema>;
