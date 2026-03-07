import type { FastifyInstance } from 'fastify';
import {
  CreateAlertSubscriptionSchema,
  UpdateAlertSubscriptionSchema,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';
import { makeAlertEngine } from '../lib/make-alert-engine';

export async function alertsRoutes(fastify: FastifyInstance) {
  // ─── GET /alerts/subscriptions ────────────────────────────────────────────
  // List all alert subscriptions for the authenticated agent.
  fastify.get('/alerts/subscriptions', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const engine = makeAlertEngine(supabase);

    try {
      const subs = await engine.getSubscriptions(user.id);
      return { data: subs };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── POST /alerts/subscriptions ───────────────────────────────────────────
  // Create a new alert subscription for the authenticated agent.
  fastify.post('/alerts/subscriptions', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const parsed = CreateAlertSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const engine = makeAlertEngine(supabase);

    try {
      const sub = await engine.createSubscription(user.id, parsed.data);
      return reply.status(201).send({ data: sub });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── PATCH /alerts/subscriptions/:id ─────────────────────────────────────
  // Update an existing alert subscription. Only the owning agent may update.
  fastify.patch<{ Params: { id: string } }>('/alerts/subscriptions/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const { id } = request.params;
    const parsed = UpdateAlertSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const engine = makeAlertEngine(supabase);

    try {
      const sub = await engine.updateSubscription(id, user.id, parsed.data);
      return { data: sub };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error';
      if (msg.includes('not found')) return reply.status(404).send({ error: msg });
      if (msg.includes('Unauthorised')) return reply.status(403).send({ error: msg });
      return reply.status(500).send({ error: msg });
    }
  });

  // ─── DELETE /alerts/subscriptions/:id ────────────────────────────────────
  // Soft-delete an alert subscription. Only the owning agent may delete.
  fastify.delete<{ Params: { id: string } }>('/alerts/subscriptions/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const { id } = request.params;

    const engine = makeAlertEngine(supabase);

    try {
      await engine.deleteSubscription(id, user.id);
      return reply.status(204).send();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error';
      if (msg.includes('not found')) return reply.status(404).send({ error: msg });
      if (msg.includes('Unauthorised')) return reply.status(403).send({ error: msg });
      return reply.status(500).send({ error: msg });
    }
  });

  // ─── POST /alerts/matches/:matchId/send-to-client ─────────────────────────
  // Mark a property match as sent to the portal client.
  fastify.post<{ Params: { matchId: string } }>(
    '/alerts/matches/:matchId/send-to-client',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

      const { matchId } = request.params;

      const engine = makeAlertEngine(supabase);

      try {
        await engine.sendMatchToClient(matchId, user.id);
        return { data: { matchId, status: 'sent_to_client' } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal error';
        if (msg.includes('not found')) return reply.status(404).send({ error: msg });
        if (msg.includes('Unauthorised')) return reply.status(403).send({ error: msg });
        return reply.status(500).send({ error: msg });
      }
    },
  );

  // ─── DELETE /alerts/matches/:matchId/send-to-client ──────────────────────
  // Retract a match from the portal client — set status back to 'reviewed'.
  fastify.delete<{ Params: { matchId: string } }>(
    '/alerts/matches/:matchId/send-to-client',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

      const { matchId } = request.params;

      // Verify agent owns the match via brief
      const { data: matchRow, error: matchError } = await supabase
        .from('property_matches')
        .select('id, brief_id')
        .eq('id', matchId)
        .single();

      if (matchError || !matchRow) {
        return reply.status(404).send({ error: 'Property match not found' });
      }

      const match = matchRow as { id: string; brief_id: string };

      const { data: briefRow, error: briefError } = await supabase
        .from('client_briefs')
        .select('id, created_by')
        .eq('id', match.brief_id)
        .single();

      if (briefError || !briefRow) {
        return reply.status(404).send({ error: 'Client brief not found' });
      }

      const brief = briefRow as { id: string; created_by: string };

      if (brief.created_by !== user.id) {
        return reply.status(403).send({ error: 'Unauthorised: you do not own this match' });
      }

      const { error: updateError } = await supabase
        .from('property_matches')
        .update({ status: 'reviewed', updated_at: new Date().toISOString() })
        .eq('id', matchId);

      if (updateError) {
        return reply.status(500).send({ error: updateError.message });
      }

      return { data: { matchId, status: 'reviewed' } };
    },
  );

  // ─── GET /alerts/events ───────────────────────────────────────────────────
  // List recent alert events for the authenticated agent.
  // Query params: limit (default 50, max 100)
  fastify.get<{
    Querystring: { limit?: string };
  }>('/alerts/events', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const rawLimit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
    const limit = isNaN(rawLimit) ? 50 : Math.min(rawLimit, 100);

    const engine = makeAlertEngine(supabase);

    try {
      const events = await engine.getAlertEvents(user.id, limit);
      return { data: events };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });
}
