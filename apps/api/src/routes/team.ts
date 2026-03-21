import type { FastifyInstance } from 'fastify';
import {
  CreateLeadAssignmentRuleSchema,
  UpdateLeadAssignmentRuleSchema,
  TestAssignmentRuleSchema,
} from '@realflow/shared';
import { TeamEngine } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

/** Resolve the office_id for the current user. */
async function getOfficeId(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase.from('users').select('office_id').eq('id', userId).single();
  return (data?.office_id as string) ?? null;
}

export async function teamRoutes(fastify: FastifyInstance) {
  // ─── GET /team/members ────────────────────────────────────────────────────
  fastify.get('/team/members', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const officeId = await getOfficeId(supabase, user.id);
    if (!officeId)
      return reply.status(400).send({ error: 'No office associated with this account' });

    const engine = new TeamEngine(supabase);
    try {
      const members = await engine.getTeamMembers(officeId);
      return { data: members };
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /team/performance ────────────────────────────────────────────────
  fastify.get('/team/performance', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const officeId = await getOfficeId(supabase, user.id);
    if (!officeId)
      return reply.status(400).send({ error: 'No office associated with this account' });

    const query = request.query as { from?: string; to?: string };
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const engine = new TeamEngine(supabase);
    try {
      const performance = await engine.getTeamPerformance(officeId, from, to);
      return { data: performance };
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /team/assignment-rules ───────────────────────────────────────────
  fastify.get('/team/assignment-rules', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const officeId = await getOfficeId(supabase, user.id);
    if (!officeId)
      return reply.status(400).send({ error: 'No office associated with this account' });

    const engine = new TeamEngine(supabase);
    try {
      const rules = await engine.listAssignmentRules(officeId);
      return { data: rules };
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── POST /team/assignment-rules ──────────────────────────────────────────
  fastify.post('/team/assignment-rules', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const parsed = CreateLeadAssignmentRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const officeId = await getOfficeId(supabase, user.id);
    if (!officeId)
      return reply.status(400).send({ error: 'No office associated with this account' });

    const engine = new TeamEngine(supabase);
    try {
      const rule = await engine.createAssignmentRule(officeId, parsed.data, user.id);
      return reply.status(201).send({ data: rule });
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── PATCH /team/assignment-rules/:id ────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/team/assignment-rules/:id',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

      const parsed = UpdateLeadAssignmentRuleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const engine = new TeamEngine(supabase);
      try {
        const rule = await engine.updateAssignmentRule(request.params.id, parsed.data);
        return { data: rule };
      } catch (err) {
        request.log.error(err, 'handler failed');
        return reply
          .status(500)
          .send({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    },
  );

  // ─── DELETE /team/assignment-rules/:id ───────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/team/assignment-rules/:id',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

      const engine = new TeamEngine(supabase);
      try {
        await engine.deleteAssignmentRule(request.params.id);
        return reply.status(204).send();
      } catch (err) {
        request.log.error(err, 'handler failed');
        return reply
          .status(500)
          .send({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    },
  );

  // ─── POST /team/assignment-rules/test ────────────────────────────────────
  // Test which agent would be assigned to a given contact under current rules.
  fastify.post('/team/assignment-rules/test', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const parsed = TestAssignmentRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const officeId = await getOfficeId(supabase, user.id);
    if (!officeId)
      return reply.status(400).send({ error: 'No office associated with this account' });

    const engine = new TeamEngine(supabase);
    try {
      const assigneeId = await engine.assignLead(parsed.data.contactId, officeId);
      return { data: { assigneeId } };
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── GET /team/workflow-templates ─────────────────────────────────────────
  fastify.get('/team/workflow-templates', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

    const officeId = await getOfficeId(supabase, user.id);
    if (!officeId)
      return reply.status(400).send({ error: 'No office associated with this account' });

    const engine = new TeamEngine(supabase);
    try {
      const templates = await engine.listTeamTemplates(officeId);
      return { data: templates };
    } catch (err) {
      request.log.error(err, 'handler failed');
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // ─── POST /team/workflow-templates/:id/share ──────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/team/workflow-templates/:id/share',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

      const engine = new TeamEngine(supabase);
      try {
        await engine.shareWorkflowTemplate(request.params.id, user.id);
        return reply.status(204).send();
      } catch (err) {
        request.log.error(err, 'handler failed');
        return reply
          .status(500)
          .send({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    },
  );

  // ─── DELETE /team/workflow-templates/:id/share ────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/team/workflow-templates/:id/share',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return reply.status(401).send({ error: 'Unauthorised' });

      const engine = new TeamEngine(supabase);
      try {
        await engine.unshareWorkflowTemplate(request.params.id, user.id);
        return reply.status(204).send();
      } catch (err) {
        request.log.error(err, 'handler failed');
        return reply
          .status(500)
          .send({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    },
  );
}
