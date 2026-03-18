import { z } from 'zod';

// ─── View Entity Type ───────────────────────────────────────────────

export const ViewEntityTypeSchema = z.enum([
  'contacts',
  'properties',
  'pipeline',
  'tasks',
  'inspections',
]);
export type ViewEntityType = z.infer<typeof ViewEntityTypeSchema>;

// ─── View Filter ────────────────────────────────────────────────────

export const ViewFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
  'contains',
  'is_empty',
  'is_not_empty',
]);
export type ViewFilterOperator = z.infer<typeof ViewFilterOperatorSchema>;

export const ViewFilterSchema = z.object({
  field: z.string(),
  operator: ViewFilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
});
export type ViewFilter = z.infer<typeof ViewFilterSchema>;

// ─── View Sort ──────────────────────────────────────────────────────

export const ViewSortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});
export type ViewSort = z.infer<typeof ViewSortSchema>;

// ─── Saved View ─────────────────────────────────────────────────────

export const SavedViewSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  userId: z.string().uuid(),
  entityType: ViewEntityTypeSchema,
  name: z.string().min(1).max(100),
  filters: z.array(ViewFilterSchema).default([]),
  sorts: z.array(ViewSortSchema).default([]),
  columns: z.array(z.string()).optional(),
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SavedView = z.infer<typeof SavedViewSchema>;

// ─── Create Saved View ──────────────────────────────────────────────

export const CreateSavedViewSchema = z.object({
  entityType: ViewEntityTypeSchema,
  name: z.string().min(1).max(100),
  filters: z.array(ViewFilterSchema).default([]),
  sorts: z.array(ViewSortSchema).default([]),
  columns: z.array(z.string()).optional(),
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false),
});
export type CreateSavedView = z.infer<typeof CreateSavedViewSchema>;

// ─── Update Saved View ──────────────────────────────────────────────

export const UpdateSavedViewSchema = CreateSavedViewSchema.partial();
export type UpdateSavedView = z.infer<typeof UpdateSavedViewSchema>;

// ─── Bulk Action ────────────────────────────────────────────────────

export const BulkActionTypeSchema = z.enum([
  'assign_agent',
  'change_stage',
  'add_tag',
  'remove_tag',
  'send_email',
  'send_sms',
  'create_task',
  'export_csv',
  'soft_delete',
]);
export type BulkActionType = z.infer<typeof BulkActionTypeSchema>;

export const BulkActionSchema = z.object({
  action: BulkActionTypeSchema,
  entityType: ViewEntityTypeSchema,
  entityIds: z.array(z.string().uuid()).min(1).max(500),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type BulkAction = z.infer<typeof BulkActionSchema>;

export const BulkActionResultSchema = z.object({
  action: BulkActionTypeSchema,
  totalCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  errors: z.array(z.object({
    entityId: z.string().uuid(),
    message: z.string(),
  })).default([]),
});
export type BulkActionResult = z.infer<typeof BulkActionResultSchema>;
