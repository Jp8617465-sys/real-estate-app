import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';
import { UpdateNotificationPreferencesSchema } from '@realflow/shared';

export async function notificationRoutes(fastify: FastifyInstance) {
  // GET / — List notifications for authenticated user
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorized' });
    const userId = user.id;

    const query = request.query as Record<string, string | undefined>;

    let dbQuery = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.category) {
      dbQuery = dbQuery.eq('category', query.category);
    }
    if (query.before) {
      dbQuery = dbQuery.lt('created_at', query.before);
    }

    const limit = query.limit ? Math.min(parseInt(query.limit, 10), 100) : 50;
    dbQuery = dbQuery.limit(limit);

    const { data, error } = await dbQuery;
    if (error) return reply.status(500).send({ error: error.message });

    return { data };
  });

  // GET /unread-count — Fast unread count for bell badge
  fastify.get('/unread-count', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorized' });
    const userId = user.id;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .eq('is_deleted', false);

    if (error) return reply.status(500).send({ error: error.message });
    return { count: count ?? 0 };
  });

  // POST /:id/read — Mark notification as read
  fastify.post<{ Params: { id: string } }>('/:id/read', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('notifications')
      .update({
        status: 'read',
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) return reply.status(404).send({ error: 'Notification not found' });
    return { data };
  });

  // POST /:id/dismiss — Soft-delete a notification
  fastify.post<{ Params: { id: string } }>('/:id/dismiss', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('notifications')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });

  // POST /:id/snooze — Snooze a notification for a period
  fastify.post<{ Params: { id: string } }>('/:id/snooze', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const body = request.body as { minutes?: number };
    const minutes = body?.minutes ?? 60;

    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('notifications')
      .update({
        status: 'snoozed',
        snoozed_until: snoozedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) return reply.status(404).send({ error: 'Notification not found' });
    return { data };
  });

  // GET /preferences — Get notification preferences
  fastify.get('/preferences', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorized' });
    const userId = user.id;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return defaults if no preferences row exists yet
      return {
        data: {
          userId,
          quietHoursStart: '21:00',
          quietHoursEnd: '07:00',
          digestModeEnabled: true,
          digestSendTime: '07:00',
          notifyNewLead: true,
          notifyPropertyMatch: true,
          notifyKeyDateReminder: true,
          notifyPipelineUpdate: true,
          notifyFollowUpDue: true,
          notifyLowPriority: false,
          dailyActionListEnabled: true,
          dailyActionListTime: '07:00',
        },
      };
    }

    return { data };
  });

  // PATCH /preferences — Update notification preferences (upsert)
  fastify.patch('/preferences', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorized' });
    const userId = user.id;

    const parsed = UpdateNotificationPreferencesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.quietHoursStart !== undefined) updatePayload.quiet_hours_start = updates.quietHoursStart;
    if (updates.quietHoursEnd !== undefined) updatePayload.quiet_hours_end = updates.quietHoursEnd;
    if (updates.digestModeEnabled !== undefined) updatePayload.digest_mode_enabled = updates.digestModeEnabled;
    if (updates.digestSendTime !== undefined) updatePayload.digest_send_time = updates.digestSendTime;
    if (updates.notifyNewLead !== undefined) updatePayload.notify_new_lead = updates.notifyNewLead;
    if (updates.notifyPropertyMatch !== undefined) updatePayload.notify_property_match = updates.notifyPropertyMatch;
    if (updates.notifyKeyDateReminder !== undefined) updatePayload.notify_key_date_reminder = updates.notifyKeyDateReminder;
    if (updates.notifyPipelineUpdate !== undefined) updatePayload.notify_pipeline_update = updates.notifyPipelineUpdate;
    if (updates.notifyFollowUpDue !== undefined) updatePayload.notify_follow_up_due = updates.notifyFollowUpDue;
    if (updates.notifyLowPriority !== undefined) updatePayload.notify_low_priority = updates.notifyLowPriority;
    if (updates.dailyActionListEnabled !== undefined) updatePayload.daily_action_list_enabled = updates.dailyActionListEnabled;
    if (updates.dailyActionListTime !== undefined) updatePayload.daily_action_list_time = updates.dailyActionListTime;

    // Try update first, insert if not exists
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('notification_preferences')
        .update(updatePayload)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      result = await supabase
        .from('notification_preferences')
        .insert({ user_id: userId, ...updatePayload })
        .select()
        .single();
    }

    if (result.error) return reply.status(500).send({ error: result.error.message });
    return { data: result.data };
  });
}
