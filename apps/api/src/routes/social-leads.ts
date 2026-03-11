import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { SocialDmWebhookSchema } from '@realflow/shared';
import { SocialLeadEngine } from '@realflow/business-logic';
import { createSupabaseClient, createSupabaseServiceClient } from '../middleware/supabase';
import { env } from '../config/env';

export async function socialLeadRoutes(fastify: FastifyInstance) {
  // ─── POST /social/dms/ingest ──────────────────────────────────────────────
  // Ingest an inbound DM from Meta or LinkedIn webhook.
  // This is a server-to-server webhook — no user JWT required.
  fastify.post('/social/dms/ingest', async (request, reply) => {
    // Verify Meta/LinkedIn HMAC-SHA256 signature — mandatory
    if (!env.META_APP_SECRET) {
      fastify.log.error('META_APP_SECRET is not configured — rejecting webhook');
      return reply.status(500).send({ error: 'Webhook signature verification not configured' });
    }

    const signature = (request.headers['x-hub-signature-256'] as string | undefined) ?? '';
    const bodyBuf = Buffer.from(JSON.stringify(request.body));
    const expected = `sha256=${crypto.createHmac('sha256', env.META_APP_SECRET).update(bodyBuf).digest('hex')}`;
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }

    const parsed = SocialDmWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const supabase = createSupabaseServiceClient();

    // Verify agentId is a real user in our system (prevent privilege escalation)
    const { data: agentUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', parsed.data.agentId)
      .single();
    if (!agentUser) {
      return reply.status(400).send({ error: 'Invalid agentId' });
    }

    const engine = new SocialLeadEngine(supabase);
    try {
      const lead = await engine.ingestDm(parsed.data, parsed.data.agentId, parsed.data.officeId);
      return reply.status(201).send({ data: lead });
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
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
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
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
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });
      if (lead.agentId !== user.id) return reply.status(403).send({ error: 'Forbidden' });
      return { data: lead };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      if (message.includes('PGRST116') || message.includes('not found')) {
        return reply.status(404).send({ error: 'Lead not found' });
      }
      request.log.error(err, 'handler failed');
      return reply.status(500).send({ error: message });
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

    const body = request.body as
      | {
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
        }
      | undefined;

    const engine = new SocialLeadEngine(supabase);
    try {
      const contactId = await engine.convertToContact(request.params.id, user.id, body ?? {});
      return reply.status(201).send({ data: { contactId } });
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
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
      await engine.dismissLead(request.params.id, user.id);
      return reply.status(204).send();
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
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
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const engine = new SocialLeadEngine(supabase);
    try {
      const stats = await engine.getLeadStats(user.id, from, to);
      return { data: stats };
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });
}
