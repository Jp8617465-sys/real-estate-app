import { z } from 'zod'

export const AlertChannelSchema = z.enum(['push', 'email', 'sms'])
export type AlertChannel = z.infer<typeof AlertChannelSchema>

export const PropertyAlertSubscriptionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  briefId: z.string().uuid(),
  scoreThreshold: z.number().int().min(50).max(100),
  channels: z.array(AlertChannelSchema).min(1),
  digestMode: z.boolean(),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PropertyAlertSubscription = z.infer<typeof PropertyAlertSubscriptionSchema>

export const CreateAlertSubscriptionSchema = z.object({
  briefId: z.string().uuid(),
  scoreThreshold: z.number().int().min(50).max(100).default(70),
  channels: z.array(AlertChannelSchema).min(1).default(['push']),
  digestMode: z.boolean().default(false),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/).default('07:00'),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default('21:00'),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default('07:00'),
})
export type CreateAlertSubscription = z.infer<typeof CreateAlertSubscriptionSchema>

export const UpdateAlertSubscriptionSchema = CreateAlertSubscriptionSchema.omit({ briefId: true }).partial()
export type UpdateAlertSubscription = z.infer<typeof UpdateAlertSubscriptionSchema>

export const PropertyAlertEventSchema = z.object({
  id: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  propertyMatchId: z.string().uuid().nullable(),
  alertType: z.enum(['new_match', 'price_drop', 'auction_date', 'status_change']),
  channelsAttempted: z.array(AlertChannelSchema),
  channelsDelivered: z.array(AlertChannelSchema),
  matchScore: z.number().int().min(0).max(100),
  sentAt: z.string().datetime().nullable(),
  actionedAt: z.string().datetime().nullable(),
  action: z.enum(['viewed', 'sent_to_client', 'dismissed', 'snoozed']).nullable(),
  snoozeUntil: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export type PropertyAlertEvent = z.infer<typeof PropertyAlertEventSchema>

export const SendToClientSchema = z.object({
  matchId: z.string().uuid(),
})
export type SendToClient = z.infer<typeof SendToClientSchema>
