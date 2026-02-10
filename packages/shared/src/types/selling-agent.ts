import { z } from 'zod';

// ─── Selling Agent Profile ─────────────────────────────────────────
export const SellingAgentProfileSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  agency: z.string().optional(),
  suburbs: z.array(z.string()),

  relationshipScore: z.number().int().min(1).max(5).optional(),
  totalInteractions: z.number().int().nonnegative().default(0),
  lastContactDate: z.string().datetime().optional(),

  propertiesSent: z.number().int().nonnegative().default(0),
  dealsClosedWith: z.number().int().nonnegative().default(0),
  averageResponseTime: z.string().optional(),

  tags: z.array(z.string()),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SellingAgentProfile = z.infer<typeof SellingAgentProfileSchema>;

// ─── Create Selling Agent Profile ──────────────────────────────────
export const CreateSellingAgentProfileSchema = SellingAgentProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalInteractions: true,
  propertiesSent: true,
  dealsClosedWith: true,
}).partial({
  tags: true,
  suburbs: true,
});
export type CreateSellingAgentProfile = z.infer<typeof CreateSellingAgentProfileSchema>;

// ─── Update Selling Agent Profile ──────────────────────────────────
export const UpdateSellingAgentProfileSchema = CreateSellingAgentProfileSchema.partial();
export type UpdateSellingAgentProfile = z.infer<typeof UpdateSellingAgentProfileSchema>;
