import { z } from 'zod';

// ─── Social DM Channel ───────────────────────────────────────────────────────

export const SocialDmChannelSchema = z.enum(['facebook_dm', 'instagram_dm', 'linkedin_dm']);
export type SocialDmChannel = z.infer<typeof SocialDmChannelSchema>;

// ─── Social DM Lead Status ───────────────────────────────────────────────────

export const SocialDmLeadStatusSchema = z.enum(['pending', 'converted', 'dismissed']);
export type SocialDmLeadStatus = z.infer<typeof SocialDmLeadStatusSchema>;

// ─── Social DM Lead ──────────────────────────────────────────────────────────

export const SocialDmLeadSchema = z.object({
  id: z.string().uuid(),
  channel: SocialDmChannelSchema,
  externalId: z.string(),
  senderName: z.string().nullable(),
  senderHandle: z.string().nullable(),
  messageText: z.string().nullable(),
  rawPayload: z.record(z.unknown()).nullable(),
  status: SocialDmLeadStatusSchema,
  contactId: z.string().uuid().nullable(),
  agentId: z.string().uuid(),
  officeId: z.string().uuid(),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type SocialDmLead = z.infer<typeof SocialDmLeadSchema>;

// ─── Webhook Payload (inbound from Meta / LinkedIn) ─────────────────────────

export const SocialDmWebhookSchema = z.object({
  channel: SocialDmChannelSchema,
  externalId: z.string().min(1),
  senderName: z.string().optional(),
  senderHandle: z.string().optional(),
  messageText: z.string().min(1),
  rawPayload: z.record(z.unknown()).optional(),
  agentId: z.string().uuid(),
  officeId: z.string().uuid(),
});
export type SocialDmWebhook = z.infer<typeof SocialDmWebhookSchema>;

// ─── Convert Lead to Contact ─────────────────────────────────────────────────

export const ConvertSocialLeadSchema = z.object({
  leadId: z.string().uuid(),
  overrides: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});
export type ConvertSocialLead = z.infer<typeof ConvertSocialLeadSchema>;

// ─── Social Lead Stats ───────────────────────────────────────────────────────

export const SocialLeadStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  converted: z.number().int().nonnegative(),
  dismissed: z.number().int().nonnegative(),
  conversionRate: z.number().min(0).max(100),
  byChannel: z.record(SocialDmChannelSchema, z.number().int().nonnegative()),
});
export type SocialLeadStats = z.infer<typeof SocialLeadStatsSchema>;
