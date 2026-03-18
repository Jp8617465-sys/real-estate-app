import type { FastifyInstance } from 'fastify';
import {
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  ConnectCalendarSchema,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function calendarRoutes(fastify: FastifyInstance) {
  // ─── List calendar connections ────────────────────────────────────
  fastify.get('/connections', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: connections, error } = await supabase
      .from('calendar_connections')
      .select('id, provider, calendar_name, account_email, sync_enabled, last_sync_at')
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return { data: connections };
  });

  // ─── Connect calendar ────────────────────────────────────────────
  fastify.post('/connect', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = ConnectCalendarSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { provider, authorizationCode, redirectUri } = parsed.data;
    const userId = request.headers['x-user-id'] as string;

    const { data: user } = await supabase
      .from('users')
      .select('office_id, email')
      .eq('id', userId)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    // Exchange authorization code for tokens based on provider
    let tokens: { accessToken: string; refreshToken: string; expiresAt: string; email: string; calendarId: string };

    if (provider === 'google') {
      tokens = await exchangeGoogleToken(authorizationCode, redirectUri);
    } else {
      tokens = await exchangeMicrosoftToken(authorizationCode, redirectUri);
    }

    const { data, error } = await supabase
      .from('calendar_connections')
      .upsert({
        user_id: userId,
        office_id: user.office_id,
        provider,
        calendar_id: tokens.calendarId,
        calendar_name: provider === 'google' ? 'Google Calendar' : 'Outlook Calendar',
        account_email: tokens.email,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt,
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider,calendar_id' })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data: { id: data.id, provider, connected: true } });
  });

  // ─── Disconnect calendar ─────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/connections/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });

  // ─── List events ─────────────────────────────────────────────────
  fastify.get('/events', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const query = request.query as { startDate?: string; endDate?: string; eventType?: string };

    // Validate date parameters
    if (query.startDate && isNaN(new Date(query.startDate).getTime())) {
      return reply.status(400).send({ error: 'Invalid startDate format' });
    }
    if (query.endDate && isNaN(new Date(query.endDate).getTime())) {
      return reply.status(400).send({ error: 'Invalid endDate format' });
    }

    const validEventTypes = ['inspection', 'open_home', 'client_meeting', 'auction', 'settlement', 'phone_call', 'other'];
    if (query.eventType && !validEventTypes.includes(query.eventType)) {
      return reply.status(400).send({ error: 'Invalid eventType' });
    }

    let builder = supabase
      .from('calendar_events')
      .select('*, contact:contacts(id, first_name, last_name), property:properties(id, address_line_1, suburb)')
      .order('start_time', { ascending: true });

    if (query.startDate) {
      builder = builder.gte('start_time', query.startDate);
    }
    if (query.endDate) {
      builder = builder.lte('end_time', query.endDate);
    }
    if (query.eventType) {
      builder = builder.eq('event_type', query.eventType);
    }

    const { data: events, error } = await builder.limit(200);

    if (error) return reply.status(500).send({ error: error.message });
    return { data: events };
  });

  // ─── Get event ───────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: event, error } = await supabase
      .from('calendar_events')
      .select('*, contact:contacts(id, first_name, last_name), property:properties(id, address_line_1, suburb)')
      .eq('id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'Event not found' });
    return { data: event };
  });

  // ─── Create event ────────────────────────────────────────────────
  fastify.post('/events', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateCalendarEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.headers['x-user-id'] as string;
    const { data: user } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', userId)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const event = parsed.data;

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time')
      .eq('user_id', userId)
      .lt('start_time', event.endTime)
      .gt('end_time', event.startTime);

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: userId,
        office_id: user.office_id,
        title: event.title,
        description: event.description,
        event_type: event.eventType,
        start_time: event.startTime,
        end_time: event.endTime,
        location: event.location,
        is_all_day: event.isAllDay,
        contact_id: event.contactId,
        property_id: event.propertyId,
        reminder_minutes: event.reminderMinutes,
        sync_status: event.syncToCalendar ? 'pending' : 'local_only',
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });

    return reply.status(201).send({
      data,
      conflicts: conflicts && conflicts.length > 0 ? conflicts : undefined,
    });
  });

  // ─── Update event ────────────────────────────────────────────────
  fastify.put<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateCalendarEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.eventType !== undefined) updatePayload.event_type = updates.eventType;
    if (updates.startTime !== undefined) updatePayload.start_time = updates.startTime;
    if (updates.endTime !== undefined) updatePayload.end_time = updates.endTime;
    if (updates.location !== undefined) updatePayload.location = updates.location;
    if (updates.isAllDay !== undefined) updatePayload.is_all_day = updates.isAllDay;
    if (updates.contactId !== undefined) updatePayload.contact_id = updates.contactId;
    if (updates.propertyId !== undefined) updatePayload.property_id = updates.propertyId;
    if (updates.reminderMinutes !== undefined) updatePayload.reminder_minutes = updates.reminderMinutes;

    // Mark as pending sync if time/title changed
    if (updates.startTime || updates.endTime || updates.title) {
      updatePayload.sync_status = 'pending';
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Delete event ────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });

  // ─── Conflict check ──────────────────────────────────────────────
  fastify.get('/conflicts', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const query = request.query as { startTime: string; endTime: string; excludeId?: string };

    if (!query.startTime || !query.endTime) {
      return reply.status(400).send({ error: 'startTime and endTime are required' });
    }

    const userId = request.headers['x-user-id'] as string;

    let builder = supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time, event_type, location')
      .eq('user_id', userId)
      .lt('start_time', query.endTime)
      .gt('end_time', query.startTime);

    if (query.excludeId) {
      builder = builder.neq('id', query.excludeId);
    }

    const { data: conflicts, error } = await builder;

    if (error) return reply.status(500).send({ error: error.message });
    return { data: conflicts };
  });
}

// ─── Token Exchange Helpers ─────────────────────────────────────────

async function exchangeGoogleToken(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; email: string; calendarId: string }> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar credentials not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Get user email from userinfo
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const userInfo = await userInfoResponse.json() as { email: string };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    email: userInfo.email,
    calendarId: 'primary',
  };
}

async function exchangeMicrosoftToken(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; email: string; calendarId: string }> {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft Calendar credentials not configured');
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'Calendars.ReadWrite User.Read offline_access',
    }),
  });

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Get user email
  const meResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const me = await meResponse.json() as { mail: string; userPrincipalName: string };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    email: me.mail || me.userPrincipalName,
    calendarId: 'default',
  };
}
