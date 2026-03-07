import { z } from 'zod';

// ─── Lead Assignment Rule Type ───────────────────────────────────────────────

export const AssignmentRuleTypeSchema = z.enum([
  'round_robin',
  'geographic',
  'specialisation',
  'manual',
]);
export type AssignmentRuleType = z.infer<typeof AssignmentRuleTypeSchema>;

// ─── Assignment Rule Conditions ──────────────────────────────────────────────

export const AssignmentRuleConditionsSchema = z.object({
  suburbs: z.array(z.string()).optional(),
  leadSources: z.array(z.string()).optional(),
  propertyTypes: z.array(z.string()).optional(),
});
export type AssignmentRuleConditions = z.infer<typeof AssignmentRuleConditionsSchema>;

// ─── Lead Assignment Rule ────────────────────────────────────────────────────

export const LeadAssignmentRuleSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  name: z.string().min(1),
  ruleType: AssignmentRuleTypeSchema,
  conditions: AssignmentRuleConditionsSchema,
  priority: z.number().int().nonnegative(),
  assigneeIds: z.array(z.string().uuid()).min(1),
  roundRobinIdx: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type LeadAssignmentRule = z.infer<typeof LeadAssignmentRuleSchema>;

// ─── Create / Update Assignment Rule ────────────────────────────────────────

export const CreateLeadAssignmentRuleSchema = z.object({
  name: z.string().min(1),
  ruleType: AssignmentRuleTypeSchema,
  conditions: AssignmentRuleConditionsSchema.optional().default({}),
  priority: z.number().int().nonnegative().optional().default(0),
  assigneeIds: z.array(z.string().uuid()).min(1),
  isActive: z.boolean().optional().default(true),
});
export type CreateLeadAssignmentRule = z.infer<typeof CreateLeadAssignmentRuleSchema>;

export const UpdateLeadAssignmentRuleSchema = CreateLeadAssignmentRuleSchema.partial();
export type UpdateLeadAssignmentRule = z.infer<typeof UpdateLeadAssignmentRuleSchema>;

// ─── Team Performance ────────────────────────────────────────────────────────

export const TeamPerformanceSchema = z.object({
  agentId: z.string().uuid(),
  agentName: z.string(),
  activeContacts: z.number().int().nonnegative(),
  activeDeals: z.number().int().nonnegative(),
  dealsClosed: z.number().int().nonnegative(),
  avgResponseHours: z.number().nonnegative().nullable(),
  leadsReceived: z.number().int().nonnegative(),
  leadsConverted: z.number().int().nonnegative(),
  conversionRate: z.number().min(0).max(100),
});
export type TeamPerformance = z.infer<typeof TeamPerformanceSchema>;

// ─── Team Performance Snapshot ───────────────────────────────────────────────

export const TeamPerformanceSnapshotSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  agentId: z.string().uuid(),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activeContacts: z.number().int().nonnegative(),
  activeDeals: z.number().int().nonnegative(),
  dealsClosed: z.number().int().nonnegative(),
  avgResponseH: z.number().nonnegative().nullable(),
  leadsReceived: z.number().int().nonnegative(),
  leadsConverted: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type TeamPerformanceSnapshot = z.infer<typeof TeamPerformanceSnapshotSchema>;

// ─── Team Member (agent visible in team view) ────────────────────────────────

export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  role: z.string(),
  avatarUrl: z.string().url().nullable(),
  isActive: z.boolean(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

// ─── Test Assignment Rule ────────────────────────────────────────────────────

export const TestAssignmentRuleSchema = z.object({
  contactId: z.string().uuid(),
});
export type TestAssignmentRule = z.infer<typeof TestAssignmentRuleSchema>;
