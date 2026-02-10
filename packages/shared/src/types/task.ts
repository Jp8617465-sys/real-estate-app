import { z } from 'zod';

// ─── Task Priority ──────────────────────────────────────────────────
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

// ─── Task Status ────────────────────────────────────────────────────
export const TaskStatusSchema = z.enum(['pending', 'in-progress', 'completed', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// ─── Task Type ──────────────────────────────────────────────────────
export const TaskTypeSchema = z.enum([
  'call',
  'email',
  'sms',
  'meeting',
  'inspection',
  'follow-up',
  'document-review',
  'appraisal',
  'listing-preparation',
  'marketing',
  'open-home',
  'auction-prep',
  'settlement-task',
  'brief-review',
  'due-diligence-check',
  'pre-settlement-inspection',
  'client-portal-update',
  'general',
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

// ─── Task ───────────────────────────────────────────────────────────
export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: TaskTypeSchema,
  priority: TaskPrioritySchema.default('medium'),
  status: TaskStatusSchema.default('pending'),

  // Relationships
  contactId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  assignedTo: z.string().uuid(),

  // Scheduling
  dueDate: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),

  // Workflow
  workflowId: z.string().uuid().optional(),
  isAutomated: z.boolean().default(false),

  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Task = z.infer<typeof TaskSchema>;

// ─── Create Task ────────────────────────────────────────────────────
export const CreateTaskSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type CreateTask = z.infer<typeof CreateTaskSchema>;

// ─── Update Task ────────────────────────────────────────────────────
export const UpdateTaskSchema = CreateTaskSchema.partial();
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
