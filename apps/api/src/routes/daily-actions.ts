import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';
import { generateDailyActions, type DAESupabaseClient } from '@realflow/business-logic';
import { getNotificationDispatcher } from '../services/notification-dispatcher';

export async function dailyActionRoutes(fastify: FastifyInstance) {
  // GET / — Return today's action list for the authenticated agent.
  // Generates on demand if not already cached for today.
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorized' });
    const agentId = user.id;

    const query = request.query as Record<string, string | undefined>;
    const date = query.date ?? new Date().toISOString().split('T')[0]!;

    // Check for cached list
    const { data: existing, error: existingError } = await supabase
      .from('daily_action_items')
      .select('*')
      .eq('user_id', agentId)
      .eq('date', date)
      .order('rank', { ascending: true });

    if (existingError) {
      return reply.status(500).send({ error: existingError.message });
    }

    if (existing && existing.length > 0) {
      const urgentCount = existing.filter(
        (i) => (i.composite_score as number) >= 80 && !(i.is_completed as boolean),
      ).length;
      return {
        data: existing,
        meta: {
          date,
          totalCount: existing.length,
          urgentCount,
          completedCount: existing.filter((i) => i.is_completed).length,
          cached: true,
        },
      };
    }

    // Generate fresh list
    try {
      const result = await generateDailyActions({
        agentId,
        date,
        supabase: supabase as unknown as DAESupabaseClient,
      });

      // Fetch persisted rows
      const { data: fresh } = await supabase
        .from('daily_action_items')
        .select('*')
        .eq('user_id', agentId)
        .eq('date', date)
        .order('rank', { ascending: true });

      return {
        data: fresh ?? [],
        meta: {
          date,
          totalCount: result.totalCandidates,
          urgentCount: result.items.filter((i) => i.compositeScore >= 80).length,
          completedCount: 0,
          cached: false,
          generatedAt: result.generatedAt,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate action list';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /:id/complete — Mark an action item as completed
  fastify.post<{ Params: { id: string } }>('/:id/complete', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('daily_action_items')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(404).send({ error: 'Action item not found' });
    return { data };
  });

  // POST /regenerate — Force-regenerate the daily action list (dev/test helper)
  fastify.post('/regenerate', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorized' });
    const agentId = user.id;

    const body = request.body as Record<string, string | undefined>;
    const date = body?.date ?? new Date().toISOString().split('T')[0]!;

    try {
      const result = await generateDailyActions({
        agentId,
        date,
        supabase: supabase as unknown as DAESupabaseClient,
      });

      // Send push notification
      const dispatcher = getNotificationDispatcher();
      await dispatcher.createAndDispatch({
        userId: agentId,
        title: 'Daily action list regenerated',
        body: `${result.items.length} actions for today.`,
        priority: 'medium',
        category: 'daily_action_list',
        actionPrimary: 'view_daily_actions',
        dedupKey: `daily_action_list:${agentId}:${date}:regen:${Date.now()}`,
        isDigestItem: false,
      });

      return { success: true, itemCount: result.items.length, generatedAt: result.generatedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Regeneration failed';
      return reply.status(500).send({ error: message });
    }
  });
}
