import type { FastifyInstance } from 'fastify';
import { CreateOffMarketPropertySchema, UpdateOffMarketPropertySchema } from '@realflow/shared';
import { OffMarketEngine } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

export async function offMarketRoutes(fastify: FastifyInstance) {
  // ─── GET /off-market ──────────────────────────────────────────────────────
  fastify.get('/off-market', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const query = request.query as { status?: string; limit?: string; offset?: string };
    const engine = new OffMarketEngine(supabase);

    try {
      const properties = await engine.list(user.id, {
        status: query.status as 'active' | 'under_offer' | 'sold' | 'withdrawn' | undefined,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return { data: properties };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── POST /off-market ─────────────────────────────────────────────────────
  fastify.post('/off-market', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const parsed = CreateOffMarketPropertySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { data: agent, error: agentErr } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', user.id)
      .single();
    if (agentErr || !agent) return reply.status(400).send({ error: 'Agent office not found' });

    const engine = new OffMarketEngine(supabase);
    try {
      const result = await engine.create(parsed.data, user.id, agent.office_id as string);
      return reply.status(201).send({ data: result });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /off-market/stats ────────────────────────────────────────────────
  fastify.get('/off-market/stats', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const engine = new OffMarketEngine(supabase);
    try {
      const stats = await engine.getSuccessStats(user.id);
      return { data: stats };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /off-market/:id ──────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/off-market/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const engine = new OffMarketEngine(supabase);
    try {
      const property = await engine.getById(request.params.id);
      if (property.agentId !== user.id) return reply.status(403).send({ error: 'Forbidden' });
      return { data: property };
    } catch {
      return reply.status(404).send({ error: 'Off-market property not found' });
    }
  });

  // ─── PATCH /off-market/:id ────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>('/off-market/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const parsed = UpdateOffMarketPropertySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const engine = new OffMarketEngine(supabase);
    try {
      const property = await engine.update(request.params.id, parsed.data, user.id);
      return { data: property };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── DELETE /off-market/:id ───────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/off-market/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const engine = new OffMarketEngine(supabase);
    try {
      await engine.softDelete(request.params.id, user.id);
      return reply.status(204).send();
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /off-market/:id/matches ─────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/off-market/:id/matches', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const engine = new OffMarketEngine(supabase);
    try {
      const matches = await engine.getMatches(request.params.id);
      return { data: matches };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── POST /off-market/:id/matches ────────────────────────────────────────
  // Re-run matching for an off-market property.
  fastify.post<{ Params: { id: string } }>('/off-market/:id/matches', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const engine = new OffMarketEngine(supabase);
    try {
      const matches = await engine.matchAgainstBriefs(request.params.id, user.id);
      return { data: matches };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── POST /off-market/:id/send-to-client ─────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/off-market/:id/send-to-client', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const body = request.body as { clientBriefId?: string };
    if (!body?.clientBriefId) {
      return reply.status(400).send({ error: 'clientBriefId is required' });
    }

    const engine = new OffMarketEngine(supabase);
    try {
      const match = await engine.sendToClient(request.params.id, body.clientBriefId);
      return { data: match };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── DELETE /off-market/:id/send-to-client ───────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/off-market/:id/send-to-client', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const body = request.body as { clientBriefId?: string };
    if (!body?.clientBriefId) {
      return reply.status(400).send({ error: 'clientBriefId is required' });
    }

    const engine = new OffMarketEngine(supabase);
    try {
      const match = await engine.retractFromClient(request.params.id, body.clientBriefId);
      return { data: match };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });
}
