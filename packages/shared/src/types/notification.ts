import { z } from 'zod';

export const NotificationPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

export const NotificationCategorySchema = z.enum([
  'new_lead',
  'property_match',
  'key_date',
  'pipeline_update',
  'follow_up_due',
  'daily_action_list',
  'system',
  'digest',
]);
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;

export const NotificationStatusSchema = z.enum(['pending', 'sent', 'read', 'dismissed', 'snoozed']);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  priority: NotificationPrioritySchema,
  category: NotificationCategorySchema,
  status: NotificationStatusSchema,
  entityType: z.string().nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  actionPrimary: z.string().nullable().optional(),
  actionSecondary: z.string().nullable().optional(),
  actionTertiary: z.string().nullable().optional(),
  dedupKey: z.string().nullable().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  snoozedUntil: z.string().datetime().nullable().optional(),
  sentAt: z.string().datetime().nullable().optional(),
  readAt: z.string().datetime().nullable().optional(),
  dismissedAt: z.string().datetime().nullable().optional(),
  isDigestItem: z.boolean(),
  digestSentAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  isDeleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  priority: NotificationPrioritySchema.default('medium'),
  category: NotificationCategorySchema,
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  actionPrimary: z.string().optional(),
  actionSecondary: z.string().optional(),
  actionTertiary: z.string().optional(),
  dedupKey: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  isDigestItem: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateNotification = z.infer<typeof CreateNotificationSchema>;

export const NotificationPreferencesSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  quietHoursStart: z.string(),
  quietHoursEnd: z.string(),
  digestModeEnabled: z.boolean(),
  digestSendTime: z.string(),
  notifyNewLead: z.boolean(),
  notifyPropertyMatch: z.boolean(),
  notifyKeyDateReminder: z.boolean(),
  notifyPipelineUpdate: z.boolean(),
  notifyFollowUpDue: z.boolean(),
  notifyLowPriority: z.boolean(),
  dailyActionListEnabled: z.boolean(),
  dailyActionListTime: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdateNotificationPreferencesSchema = NotificationPreferencesSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();
export type UpdateNotificationPreferences = z.infer<typeof UpdateNotificationPreferencesSchema>;

export const PushDeviceTokenSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  token: z.string(),
  platform: z.enum(['ios', 'android']),
  deviceId: z.string().nullable().optional(),
  isActive: z.boolean(),
  lastSeenAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PushDeviceToken = z.infer<typeof PushDeviceTokenSchema>;

export const RegisterPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  deviceId: z.string().optional(),
});
export type RegisterPushToken = z.infer<typeof RegisterPushTokenSchema>;
