import { z } from 'zod';

export const DocumentCategorySchema = z.enum([
  'contracts',
  'inspections',
  'legal',
  'finance',
  'property',
  'environmental',
  'council',
  'identification',
  'other',
]);
export type DocumentCategory = z.infer<typeof DocumentCategorySchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  filePath: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  category: DocumentCategorySchema,
  contactId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  uploadedBy: z.string().uuid(),
  isDeleted: z.boolean().default(false),
  deletedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const CreateDocumentSchema = z.object({
  name: z.string().min(1),
  filePath: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  category: DocumentCategorySchema.default('other'),
  contactId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
});
export type CreateDocument = z.infer<typeof CreateDocumentSchema>;
