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

export const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
  // Date operators
  'before',
  'after',
  'within_days',
  // Contact-specific operators
  'has_tag',
  'in_stage',
  'lead_score_above',
  // Property-specific operators
  'price_range',
  'suburb_match',
  'days_on_market',
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const WorkflowConditionSchema = z.object({
  field: z.string(),
  operator: ConditionOperatorSchema,
  value: z.unknown().optional(),
});
export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>;

// ─── Compound Condition (AND / OR / NOT logic) ──────────────────────

export const CompoundConditionSchema: z.ZodType<CompoundCondition> = z.lazy(() =>
  z.discriminatedUnion('logic', [
    z.object({
      logic: z.literal('AND'),
      conditions: z.array(z.union([WorkflowConditionSchema, CompoundConditionSchema])),
    }),
    z.object({
      logic: z.literal('OR'),
      conditions: z.array(z.union([WorkflowConditionSchema, CompoundConditionSchema])),
    }),
    z.object({
      logic: z.literal('NOT'),
      condition: z.union([WorkflowConditionSchema, CompoundConditionSchema]),
    }),
  ]),
);

export type CompoundCondition =
  | { logic: 'AND'; conditions: Array<WorkflowCondition | CompoundCondition> }
  | { logic: 'OR'; conditions: Array<WorkflowCondition | CompoundCondition> }
  | { logic: 'NOT'; condition: WorkflowCondition | CompoundCondition };

/** A condition node is either a simple field condition or a compound logical expression. */
export type ConditionNode = WorkflowCondition | CompoundCondition;

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

// ─── Retry Configuration ────────────────────────────────────────────

export const RetryStrategySchema = z.enum(['immediate', 'linear', 'exponential']);
export type RetryStrategy = z.infer<typeof RetryStrategySchema>;

export const RetryConfigSchema = z.object({
  maxRetries: z.number().int().nonnegative().default(3),
  strategy: RetryStrategySchema.default('exponential'),
  baseDelayMs: z.number().int().positive().default(1000),
  maxDelayMs: z.number().int().positive().default(300000), // 5 minutes
});
export type RetryConfig = z.infer<typeof RetryConfigSchema>;

// ─── Error Classification ───────────────────────────────────────────

export const ErrorClassificationSchema = z.enum(['transient', 'permanent', 'partial']);
export type ErrorClassification = z.infer<typeof ErrorClassificationSchema>;

export const ErrorRecoveryStrategySchema = z.enum([
  'retry',
  'skip',
  'fail',
  'fallback',
  'continue_with_warning',
]);
export type ErrorRecoveryStrategy = z.infer<typeof ErrorRecoveryStrategySchema>;

export const ActionErrorPolicySchema = z.object({
  classification: ErrorClassificationSchema.default('transient'),
  recoveryStrategy: ErrorRecoveryStrategySchema.default('retry'),
  retryConfig: RetryConfigSchema.optional(),
  fallbackAction: WorkflowActionSchema.optional(),
});
export type ActionErrorPolicy = z.infer<typeof ActionErrorPolicySchema>;

// ─── Execution Step Log ─────────────────────────────────────────────

export const ExecutionStepStatusSchema = z.enum([
  'started',
  'completed',
  'failed',
  'skipped',
  'retrying',
  'warning',
]);
export type ExecutionStepStatus = z.infer<typeof ExecutionStepStatusSchema>;

export const ExecutionStepLogSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  actionType: z.string(),
  status: ExecutionStepStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  retryAttempt: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
  warning: z.string().optional(),
  result: z.record(z.unknown()).optional(),
  variableSnapshot: z.record(z.unknown()).optional(),
});
export type ExecutionStepLog = z.infer<typeof ExecutionStepLogSchema>;

// ─── Dead Letter Entry ──────────────────────────────────────────────

export const DeadLetterEntrySchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  runId: z.string().uuid(),
  stepIndex: z.number().int().nonnegative(),
  actionType: z.string(),
  error: z.string(),
  errorClassification: ErrorClassificationSchema,
  context: z.record(z.unknown()),
  retryCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  resolution: z.enum(['retried', 'skipped', 'manual']).optional(),
});
export type DeadLetterEntry = z.infer<typeof DeadLetterEntrySchema>;

// ─── Workflow Run ───────────────────────────────────────────────────
export const WorkflowRunStatusSchema = z.enum([
  'running',
  'completed',
  'failed',
  'cancelled',
  'paused',
]);
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
  pausedAt: z.string().datetime().optional(),
  resumeAt: z.string().datetime().optional(),
  executionLog: z.array(ExecutionStepLogSchema).optional(),
  variableContext: z.record(z.unknown()).optional(),
  retryState: z
    .object({
      stepIndex: z.number().int().nonnegative(),
      attempt: z.number().int().nonnegative(),
      nextRetryAt: z.string().datetime().optional(),
    })
    .optional(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
