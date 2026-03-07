import type { FastifyInstance } from 'fastify';
import { SocialDmWebhookSchema } from '@realflow/shared';
import { SocialLeadEngine } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

export async function socialLeadRoutes(fastify: FastifyInstance) {
  // ─── POST /social/dms/ingest ──────────────────────────────────────────────
  // Ingest an inbound DM from Meta or LinkedIn webhook.
  fastify.post('/social/dms/ingest', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const parsed = SocialDmWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    // Get agent's office_id
    const { data: agent, error: agentErr } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', user.id)
      .single();
    if (agentErr || !agent) return reply.status(400).send({ error: 'Agent office not found' });

    const engine = new SocialLeadEngine(supabase);
    try {
      const lead = await engine.ingestDm(parsed.data, user.id, agent.office_id as string);
      return reply.status(201).send({ data: lead });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /social/leads ────────────────────────────────────────────────────
  // List social DM leads for the authenticated agent.
  fastify.get('/social/leads', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const query = request.query as { status?: string; limit?: string; offset?: string };
    const engine = new SocialLeadEngine(supabase);

    try {
      const leads = await engine.listLeads(user.id, {
        status: query.status as 'pending' | 'converted' | 'dismissed' | undefined,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return { data: leads };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /social/leads/:id ────────────────────────────────────────────────
  // Get a single social DM lead by ID.
  fastify.get<{ Params: { id: string } }>('/social/leads/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const engine = new SocialLeadEngine(supabase);
    try {
      const lead = await engine.getById(request.params.id);
      if (lead.agentId !== user.id) return reply.status(403).send({ error: 'Forbidden' });
      return { data: lead };
    } catch {
      return reply.status(404).send({ error: 'Lead not found' });
    }
  });

  // ─── POST /social/leads/:id/convert ──────────────────────────────────────
  // Convert a pending DM lead into a CRM contact.
  fastify.post<{ Params: { id: string } }>('/social/leads/:id/convert', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const body = request.body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    } | undefined;

    const engine = new SocialLeadEngine(supabase);
    try {
      const contactId = await engine.convertToContact(request.params.id, user.id, body ?? {});
      return reply.status(201).send({ data: { contactId } });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── DELETE /social/leads/:id ─────────────────────────────────────────────
  // Dismiss a pending DM lead.
  fastify.delete<{ Params: { id: string } }>('/social/leads/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const engine = new SocialLeadEngine(supabase);
    try {
      await engine.dismissLead(request.params.id);
      return reply.status(204).send();
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /social/leads/stats ──────────────────────────────────────────────
  // Get social lead stats for the authenticated agent.
  fastify.get('/social/leads/stats', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const query = request.query as { from?: string; to?: string };
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const engine = new SocialLeadEngine(supabase);
    try {
      const stats = await engine.getLeadStats(user.id, from, to);
      return { data: stats };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });
}
