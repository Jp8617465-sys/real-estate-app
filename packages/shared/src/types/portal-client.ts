import { z } from 'zod';

export const PortalClientSchema = z.object({
  id: z.string().uuid(),
  authId: z.string().uuid(),
  contactId: z.string().uuid(),
  agentId: z.string().uuid(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PortalClient = z.infer<typeof PortalClientSchema>;

export const CreatePortalClientSchema = z.object({
  authId: z.string().uuid(),
  contactId: z.string().uuid(),
  agentId: z.string().uuid(),
});
export type CreatePortalClient = z.infer<typeof CreatePortalClientSchema>;
