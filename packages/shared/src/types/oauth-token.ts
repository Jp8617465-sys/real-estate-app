import { z } from 'zod';

export const OAuthProviderSchema = z.enum([
  'gmail',
  'google_calendar',
  'meta',
  'domain',
  'rea',
  'twilio',
  'whatsapp',
]);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

export const OAuthTokenSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  provider: OAuthProviderSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime(),
  scopes: z.array(z.string()).default([]),
  accountEmail: z.string().email().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OAuthToken = z.infer<typeof OAuthTokenSchema>;
