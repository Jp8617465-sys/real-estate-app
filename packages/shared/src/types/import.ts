import { z } from 'zod';

// ─── Import Source ──────────────────────────────────────────────────

export const ImportSourceSchema = z.enum([
  'csv',
  'hubspot',
  'rex',
  'agentbox',
  'mydesktop',
  'spreadsheet',
]);
export type ImportSource = z.infer<typeof ImportSourceSchema>;

// ─── Import Entity Type ─────────────────────────────────────────────

export const ImportEntityTypeSchema = z.enum(['contacts', 'properties']);
export type ImportEntityType = z.infer<typeof ImportEntityTypeSchema>;

// ─── Import Status ──────────────────────────────────────────────────

export const ImportStatusSchema = z.enum([
  'uploaded',
  'mapping',
  'previewing',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

// ─── Field Mapping ──────────────────────────────────────────────────

export const FieldMappingSchema = z.object({
  sourceColumn: z.string(),
  targetField: z.string(),
  transform: z.enum(['none', 'uppercase', 'lowercase', 'trim', 'phone_au', 'date_au']).default('none'),
});
export type FieldMapping = z.infer<typeof FieldMappingSchema>;

// ─── Import Job ─────────────────────────────────────────────────────

export const ImportJobSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  userId: z.string().uuid(),
  source: ImportSourceSchema,
  entityType: ImportEntityTypeSchema,
  fileName: z.string(),
  fileSize: z.number().int().positive(),
  status: ImportStatusSchema,
  fieldMappings: z.array(FieldMappingSchema).default([]),
  totalRows: z.number().int().nonnegative().default(0),
  processedRows: z.number().int().nonnegative().default(0),
  successCount: z.number().int().nonnegative().default(0),
  errorCount: z.number().int().nonnegative().default(0),
  duplicateCount: z.number().int().nonnegative().default(0),
  skipDuplicates: z.boolean().default(true),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ImportJob = z.infer<typeof ImportJobSchema>;

// ─── Create Import Job ──────────────────────────────────────────────

export const CreateImportJobSchema = z.object({
  source: ImportSourceSchema,
  entityType: ImportEntityTypeSchema,
  fileName: z.string(),
  fileSize: z.number().int().positive(),
});
export type CreateImportJob = z.infer<typeof CreateImportJobSchema>;

// ─── Update Field Mappings ──────────────────────────────────────────

export const UpdateFieldMappingsSchema = z.object({
  fieldMappings: z.array(FieldMappingSchema).min(1),
  skipDuplicates: z.boolean().default(true),
});
export type UpdateFieldMappings = z.infer<typeof UpdateFieldMappingsSchema>;

// ─── Import Error ───────────────────────────────────────────────────

export const ImportErrorSchema = z.object({
  id: z.string().uuid(),
  importJobId: z.string().uuid(),
  rowNumber: z.number().int().positive(),
  field: z.string().optional(),
  message: z.string(),
  rawData: z.record(z.string(), z.string()).optional(),
  createdAt: z.string().datetime(),
});
export type ImportError = z.infer<typeof ImportErrorSchema>;

// ─── Import Preview Row ─────────────────────────────────────────────

export const ImportPreviewRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  mapped: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()).default([]),
  isDuplicate: z.boolean().default(false),
  duplicateOfId: z.string().uuid().optional(),
});
export type ImportPreviewRow = z.infer<typeof ImportPreviewRowSchema>;

export const ImportPreviewSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  previewRows: z.array(ImportPreviewRowSchema),
  detectedColumns: z.array(z.string()),
  suggestedMappings: z.array(FieldMappingSchema),
  duplicateCount: z.number().int().nonnegative(),
});
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;

// ─── Onboarding ─────────────────────────────────────────────────────

export const OnboardingStepSchema = z.enum([
  'office_setup',
  'invite_team',
  'connect_portals',
  'import_data',
  'configure_pipelines',
  'setup_workflows',
  'complete',
]);
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

export const OnboardingProgressSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  currentStep: OnboardingStepSchema,
  completedSteps: z.array(OnboardingStepSchema).default([]),
  skippedSteps: z.array(OnboardingStepSchema).default([]),
  isComplete: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OnboardingProgress = z.infer<typeof OnboardingProgressSchema>;

export const UpdateOnboardingSchema = z.object({
  currentStep: OnboardingStepSchema,
  completedSteps: z.array(OnboardingStepSchema).optional(),
  skippedSteps: z.array(OnboardingStepSchema).optional(),
});
export type UpdateOnboarding = z.infer<typeof UpdateOnboardingSchema>;
