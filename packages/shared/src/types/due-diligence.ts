import { z } from 'zod';

// ─── Due Diligence Category ────────────────────────────────────────
export const DueDiligenceCategorySchema = z.enum(['legal', 'physical', 'financial', 'environmental', 'council', 'strata']);
export type DueDiligenceCategory = z.infer<typeof DueDiligenceCategorySchema>;

// ─── Due Diligence Item Status ─────────────────────────────────────
export const DueDiligenceItemStatusSchema = z.enum(['not_started', 'in_progress', 'completed', 'issue_found', 'not_applicable']);
export type DueDiligenceItemStatus = z.infer<typeof DueDiligenceItemStatusSchema>;

// ─── Due Diligence Assignee ────────────────────────────────────────
export const DueDiligenceAssigneeSchema = z.enum(['buyers_agent', 'solicitor', 'broker', 'building_inspector', 'pest_inspector', 'client']);
export type DueDiligenceAssignee = z.infer<typeof DueDiligenceAssigneeSchema>;

// ─── Due Diligence Checklist Status ────────────────────────────────
export const DueDiligenceChecklistStatusSchema = z.enum(['not_started', 'in_progress', 'completed', 'blocked']);
export type DueDiligenceChecklistStatus = z.infer<typeof DueDiligenceChecklistStatusSchema>;

// ─── Due Diligence Document ────────────────────────────────────────
export const DueDiligenceDocumentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  uploadedAt: z.string().datetime(),
});
export type DueDiligenceDocument = z.infer<typeof DueDiligenceDocumentSchema>;

// ─── Due Diligence Item ────────────────────────────────────────────
export const DueDiligenceItemSchema = z.object({
  id: z.string().uuid(),
  checklistId: z.string().uuid(),

  category: DueDiligenceCategorySchema,
  name: z.string(),
  description: z.string().optional(),

  status: DueDiligenceItemStatusSchema.default('not_started'),
  assignedTo: DueDiligenceAssigneeSchema,

  dueDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional(),
  documents: z.array(DueDiligenceDocumentSchema),
  notes: z.string().optional(),

  isBlocking: z.boolean().default(false),
  isCritical: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DueDiligenceItem = z.infer<typeof DueDiligenceItemSchema>;

// ─── Create Due Diligence Item ─────────────────────────────────────
export const CreateDueDiligenceItemSchema = DueDiligenceItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedDate: true,
}).partial({
  documents: true,
});
export type CreateDueDiligenceItem = z.infer<typeof CreateDueDiligenceItemSchema>;

// ─── Update Due Diligence Item ─────────────────────────────────────
export const UpdateDueDiligenceItemSchema = z.object({
  status: DueDiligenceItemStatusSchema.optional(),
  assignedTo: DueDiligenceAssigneeSchema.optional(),
  dueDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional(),
  documents: z.array(DueDiligenceDocumentSchema).optional(),
  notes: z.string().optional(),
  isBlocking: z.boolean().optional(),
  isCritical: z.boolean().optional(),
});
export type UpdateDueDiligenceItem = z.infer<typeof UpdateDueDiligenceItemSchema>;

// ─── Due Diligence Checklist ───────────────────────────────────────
export const DueDiligenceChecklistSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  state: z.string(), // Australian state code (QLD, NSW, VIC, etc.)
  propertyType: z.string(), // maps to property_type

  completionPercentage: z.number().int().min(0).max(100).default(0),
  status: DueDiligenceChecklistStatusSchema.default('not_started'),

  // Nested items (for API responses)
  items: z.array(DueDiligenceItemSchema).optional(),

  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DueDiligenceChecklist = z.infer<typeof DueDiligenceChecklistSchema>;

// ─── Create Due Diligence Checklist ────────────────────────────────
export const CreateDueDiligenceChecklistSchema = DueDiligenceChecklistSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completionPercentage: true,
  items: true,
});
export type CreateDueDiligenceChecklist = z.infer<typeof CreateDueDiligenceChecklistSchema>;
