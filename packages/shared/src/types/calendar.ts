import { z } from 'zod';

// ─── Calendar Provider ──────────────────────────────────────────────

export const CalendarProviderSchema = z.enum(['google', 'microsoft']);
export type CalendarProvider = z.infer<typeof CalendarProviderSchema>;

// ─── Calendar Connection ────────────────────────────────────────────

export const CalendarConnectionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  officeId: z.string().uuid(),
  provider: CalendarProviderSchema,
  calendarId: z.string(),
  calendarName: z.string(),
  accountEmail: z.string().email(),
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenExpiresAt: z.string().datetime(),
  syncEnabled: z.boolean().default(true),
  lastSyncAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CalendarConnection = z.infer<typeof CalendarConnectionSchema>;

// ─── Calendar Event Type ────────────────────────────────────────────

export const CalendarEventTypeSchema = z.enum([
  'inspection',
  'open_home',
  'client_meeting',
  'auction',
  'settlement',
  'phone_call',
  'other',
]);
export type CalendarEventType = z.infer<typeof CalendarEventTypeSchema>;

// ─── Calendar Event ─────────────────────────────────────────────────

export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  officeId: z.string().uuid(),
  connectionId: z.string().uuid().optional(),
  externalEventId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  eventType: CalendarEventTypeSchema,
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  isAllDay: z.boolean().default(false),
  contactId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  reminderMinutes: z.number().int().nonnegative().default(15),
  syncStatus: z.enum(['synced', 'pending', 'failed', 'local_only']).default('local_only'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

// ─── Create Calendar Event ──────────────────────────────────────────

export const CreateCalendarEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  eventType: CalendarEventTypeSchema,
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  isAllDay: z.boolean().default(false),
  contactId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  reminderMinutes: z.number().int().nonnegative().default(15),
  syncToCalendar: z.boolean().default(true),
});
export type CreateCalendarEvent = z.infer<typeof CreateCalendarEventSchema>;

// ─── Update Calendar Event ──────────────────────────────────────────

export const UpdateCalendarEventSchema = CreateCalendarEventSchema.partial();
export type UpdateCalendarEvent = z.infer<typeof UpdateCalendarEventSchema>;

// ─── Calendar Sync Config ───────────────────────────────────────────

export const CalendarSyncConfigSchema = z.object({
  syncDirection: z.enum(['realflow_to_calendar', 'calendar_to_realflow', 'bidirectional']).default('bidirectional'),
  conflictResolution: z.enum(['realflow_wins', 'calendar_wins', 'ask']).default('realflow_wins'),
  syncEventTypes: z.array(CalendarEventTypeSchema).default(['inspection', 'open_home', 'client_meeting', 'auction']),
});
export type CalendarSyncConfig = z.infer<typeof CalendarSyncConfigSchema>;

// ─── Connect Calendar Request ───────────────────────────────────────

export const ConnectCalendarSchema = z.object({
  provider: CalendarProviderSchema,
  authorizationCode: z.string(),
  redirectUri: z.string().url(),
});
export type ConnectCalendar = z.infer<typeof ConnectCalendarSchema>;
