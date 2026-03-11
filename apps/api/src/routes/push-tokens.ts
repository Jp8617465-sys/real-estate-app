import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';
import { RegisterPushTokenSchema } from '@realflow/shared';

export async function pushTokenRoutes(fastify: FastifyInstance) {
  // POST / — Register a push device token
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = RegisterPushTokenSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { token, platform, deviceId } = parsed.data;
    const userId = user.id;

    // Upsert: update last_seen_at if token already exists for this user
    const { data, error } = await supabase
      .from('push_device_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          device_id: deviceId ?? null,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      )
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // DELETE /:token — Deregister a push token (on logout)
  fastify.delete<{ Params: { token: string } }>('/:token', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { token } = request.params;

    const { error } = await supabase
      .from('push_device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('token', token)
      .eq('user_id', user.id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });
}
