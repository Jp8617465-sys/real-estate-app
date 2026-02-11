import { z } from 'zod';
import { OAuthProviderSchema } from './oauth-token';

export const IntegrationConnectionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  officeId: z.string().uuid(),
  provider: OAuthProviderSchema,
  isActive: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
  lastSyncAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type IntegrationConnection = z.infer<typeof IntegrationConnectionSchema>;

export const CreateIntegrationConnectionSchema = z.object({
  officeId: z.string().uuid(),
  provider: OAuthProviderSchema,
  config: z.record(z.unknown()).default({}),
});
export type CreateIntegrationConnection = z.infer<typeof CreateIntegrationConnectionSchema>;
