import { z } from 'zod';
import { LeadSourceSchema } from './common';

// ─── Workflow Trigger ───────────────────────────────────────────────
export const WorkflowTriggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stage_change'),
    from: z.string().optional(),
    to: z.string(),
  }),
  z.object({
    type: z.literal('new_lead'),
    source: LeadSourceSchema.optional(),
  }),
  z.object({
    type: z.literal('time_based'),
    schedule: z.string(), // cron expression
  }),
  z.object({
    type: z.literal('field_change'),
    field: z.string(),
  }),
  z.object({
    type: z.literal('no_activity'),
    days: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('date_approaching'),
    field: z.string(),
    daysBefore: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('form_submitted'),
    formId: z.string(),
  }),
  // ─── AI-Powered Triggers ──────────────────────────────────────────
  z.object({
    type: z.literal('ai_insight'),
    insightType: z.enum([
      'high_match_property',
      'market_shift',
      'brief_conflict',
      'risk_detected',
      'opportunity_identified',
    ]),
    minConfidence: z.enum(['high', 'medium', 'low']).default('medium'),
  }),
  z.object({
    type: z.literal('market_change'),
    metric: z.enum(['median_price', 'days_on_market', 'auction_clearance', 'listing_volume']),
    threshold: z.number(),
    direction: z.enum(['above', 'below', 'change_percent']),
    suburb: z.string().optional(),
  }),
  z.object({
    type: z.literal('consolidation_ready'),
    reportType: z.enum([
      'client_brief_summary',
      'property_comparison',
      'market_analysis',
      'search_progress',
      'due_diligence_summary',
      'settlement_outcome',
    ]),
  }),
  z.object({
    type: z.literal('match_score_threshold'),
    minScore: z.number().int().min(0).max(100),
    propertyCount: z.number().int().positive().default(1),
  }),
]);
export type WorkflowTrigger = z.infer<typeof WorkflowTriggerSchema>;

// ─── Workflow Action ────────────────────────────────────────────────
export const WorkflowActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('send_email'), templateId: z.string() }),
  z.object({ type: z.literal('send_sms'), templateId: z.string() }),
  z.object({
    type: z.literal('create_task'),
    taskTitle: z.string(),
    taskType: z.string(),
    dueDaysFromNow: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('assign_contact'), agentId: z.string().uuid() }),
  z.object({ type: z.literal('update_field'), field: z.string(), value: z.unknown() }),
  z.object({ type: z.literal('add_tag'), tag: z.string() }),
  z.object({ type: z.literal('notify_agent'), message: z.string() }),
  z.object({
    type: z.literal('post_social'),
    platforms: z.array(z.string()),
    templateId: z.string(),
  }),
  z.object({ type: z.literal('webhook'), url: z.string().url(), payload: z.record(z.unknown()) }),
  z.object({ type: z.literal('wait'), duration: z.string() }),
  z.object({
    type: z.literal('create_follow_up'),
    daysFromNow: z.number().int().positive(),
    taskType: z.string(),
  }),
  // ─── AI-Powered Actions ───────────────────────────────────────────
  z.object({
    type: z.literal('ai_analyze'),
    analysisType: z.enum([
      'property_description',
      'market_comparison',
      'brief_refinement',
      'risk_assessment',
    ]),
    targetId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal('generate_report'),
    reportType: z.enum([
      'client_brief_summary',
      'property_comparison',
      'market_analysis',
      'search_progress',
      'due_diligence_summary',
      'settlement_outcome',
    ]),
    autoSendToClient: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('ai_draft_message'),
    recipient: z.enum(['client', 'selling_agent', 'solicitor', 'broker']),
    purpose: z.string(),
    channel: z.enum(['email', 'sms']).default('email'),
    autoSend: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('ai_score_property'),
    enhanceWithNLP: z.boolean().default(true),
  }),
]);
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;

// ─── Workflow Condition ─────────────────────────────────────────────
export const WorkflowConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']),
  value: z.unknown().optional(),
});
export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>;

// ─── Workflow ───────────────────────────────────────────────────────
export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: WorkflowTriggerSchema,
  conditions: z.array(WorkflowConditionSchema),
  actions: z.array(WorkflowActionSchema),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// ─── Workflow Run ───────────────────────────────────────────────────
export const WorkflowRunStatusSchema = z.enum(['running', 'completed', 'failed', 'cancelled']);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;

export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  status: WorkflowRunStatusSchema,
  currentActionIndex: z.number().int().nonnegative(),
  error: z.string().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
