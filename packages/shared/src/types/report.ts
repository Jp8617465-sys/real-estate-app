import { z } from 'zod';

// ─── Report Type ────────────────────────────────────────────────────

export const ReportTypeSchema = z.enum([
  'pipeline_value',
  'agent_performance',
  'revenue',
  'lead_conversion',
  'property_market',
  'client_activity',
  'team_overview',
  'custom',
]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

// ─── Report Filter Operator ─────────────────────────────────────────

export const FilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
  'contains',
  'between',
  'is_null',
  'is_not_null',
]);
export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

// ─── Report Filter ──────────────────────────────────────────────────

export const ReportFilterSchema = z.object({
  field: z.string(),
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
});
export type ReportFilter = z.infer<typeof ReportFilterSchema>;

// ─── Report Date Range ──────────────────────────────────────────────

export const DateRangePresetSchema = z.enum([
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
  'custom',
]);
export type DateRangePreset = z.infer<typeof DateRangePresetSchema>;

export const ReportDateRangeSchema = z.object({
  preset: DateRangePresetSchema,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
export type ReportDateRange = z.infer<typeof ReportDateRangeSchema>;

// ─── Chart Type ─────────────────────────────────────────────────────

export const ChartTypeSchema = z.enum([
  'bar',
  'line',
  'pie',
  'donut',
  'table',
  'number',
  'funnel',
]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

// ─── Report Definition ──────────────────────────────────────────────

export const ReportDefinitionSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  createdBy: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: ReportTypeSchema,
  chartType: ChartTypeSchema.default('table'),
  filters: z.array(ReportFilterSchema).default([]),
  dateRange: ReportDateRangeSchema,
  groupBy: z.string().optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
  isTemplate: z.boolean().default(false),
  isShared: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReportDefinition = z.infer<typeof ReportDefinitionSchema>;

// ─── Create Report ──────────────────────────────────────────────────

export const CreateReportSchema = ReportDefinitionSchema.omit({
  id: true,
  officeId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateReport = z.infer<typeof CreateReportSchema>;

// ─── Update Report ──────────────────────────────────────────────────

export const UpdateReportSchema = CreateReportSchema.partial();
export type UpdateReport = z.infer<typeof UpdateReportSchema>;

// ─── Report Result ──────────────────────────────────────────────────

export const ReportResultRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
export type ReportResultRow = z.infer<typeof ReportResultRowSchema>;

export const ReportResultSchema = z.object({
  reportId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean', 'currency']),
  })),
  rows: z.array(ReportResultRowSchema),
  summary: z.record(z.string(), z.number()).optional(),
});
export type ReportResult = z.infer<typeof ReportResultSchema>;

// ─── Report Schedule ────────────────────────────────────────────────

export const ReportScheduleFrequencySchema = z.enum(['daily', 'weekly', 'monthly']);
export type ReportScheduleFrequency = z.infer<typeof ReportScheduleFrequencySchema>;

export const ReportScheduleSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  frequency: ReportScheduleFrequencySchema,
  recipientEmails: z.array(z.string().email()),
  isActive: z.boolean().default(true),
  lastSentAt: z.string().datetime().optional(),
  nextSendAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReportSchedule = z.infer<typeof ReportScheduleSchema>;

export const CreateReportScheduleSchema = z.object({
  reportId: z.string().uuid(),
  frequency: ReportScheduleFrequencySchema,
  recipientEmails: z.array(z.string().email()).min(1),
});
export type CreateReportSchedule = z.infer<typeof CreateReportScheduleSchema>;

// ─── Dashboard Widget ───────────────────────────────────────────────

export const DashboardWidgetSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  userId: z.string().uuid(),
  reportId: z.string().uuid(),
  title: z.string(),
  position: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;
