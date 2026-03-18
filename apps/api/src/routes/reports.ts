import type { FastifyInstance } from 'fastify';
import {
  CreateReportSchema,
  UpdateReportSchema,
  CreateReportScheduleSchema,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';
import { ReportEngine } from '../services/report-engine';

export async function reportRoutes(fastify: FastifyInstance) {
  // ─── List reports ─────────────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: reports, error } = await supabase
      .from('report_definitions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return { data: reports };
  });

  // ─── Get report by ID ────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: report, error } = await supabase
      .from('report_definitions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'Report not found' });
    return { data: report };
  });

  // ─── Create report ───────────────────────────────────────────────
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateReportSchema.safeParse(request.body);

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

    const report = parsed.data;

    const { data, error } = await supabase
      .from('report_definitions')
      .insert({
        office_id: user.office_id,
        created_by: userId,
        name: report.name,
        description: report.description,
        type: report.type,
        chart_type: report.chartType,
        filters: report.filters,
        date_range: report.dateRange,
        group_by: report.groupBy,
        order_by: report.orderBy,
        order_direction: report.orderDirection,
        is_template: report.isTemplate,
        is_shared: report.isShared,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // ─── Update report ───────────────────────────────────────────────
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateReportSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.type !== undefined) updatePayload.type = updates.type;
    if (updates.chartType !== undefined) updatePayload.chart_type = updates.chartType;
    if (updates.filters !== undefined) updatePayload.filters = updates.filters;
    if (updates.dateRange !== undefined) updatePayload.date_range = updates.dateRange;
    if (updates.groupBy !== undefined) updatePayload.group_by = updates.groupBy;
    if (updates.orderBy !== undefined) updatePayload.order_by = updates.orderBy;
    if (updates.orderDirection !== undefined) updatePayload.order_direction = updates.orderDirection;
    if (updates.isShared !== undefined) updatePayload.is_shared = updates.isShared;

    const { data, error } = await supabase
      .from('report_definitions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Delete report ───────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('report_definitions')
      .delete()
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });

  // ─── Execute report ──────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/execute', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: report, error } = await supabase
      .from('report_definitions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !report) return reply.status(404).send({ error: 'Report not found' });

    const engine = new ReportEngine(supabase);
    const result = await engine.execute(report);

    return { data: result };
  });

  // ─── Get pre-built report templates ──────────────────────────────
  fastify.get('/templates/list', async () => {
    return { data: ReportEngine.getTemplates() };
  });

  // ─── Report schedules ────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/schedule', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateReportScheduleSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const schedule = parsed.data;

    const nextSendAt = new Date();
    switch (schedule.frequency) {
      case 'daily':
        nextSendAt.setDate(nextSendAt.getDate() + 1);
        nextSendAt.setHours(7, 0, 0, 0);
        break;
      case 'weekly':
        nextSendAt.setDate(nextSendAt.getDate() + (8 - nextSendAt.getDay()) % 7);
        nextSendAt.setHours(7, 0, 0, 0);
        break;
      case 'monthly':
        nextSendAt.setMonth(nextSendAt.getMonth() + 1, 1);
        nextSendAt.setHours(7, 0, 0, 0);
        break;
    }

    const { data, error } = await supabase
      .from('report_schedules')
      .insert({
        report_id: schedule.reportId,
        frequency: schedule.frequency,
        recipient_emails: schedule.recipientEmails,
        next_send_at: nextSendAt.toISOString(),
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // ─── Dashboard widgets ───────────────────────────────────────────
  fastify.get('/dashboard/widgets', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: widgets, error } = await supabase
      .from('dashboard_widgets')
      .select('*, report:report_definitions(*)')
      .order('created_at', { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });
    return { data: widgets };
  });

  fastify.post('/dashboard/widgets', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const body = request.body as { reportId: string; title: string; position: Record<string, number> };

    const userId = request.headers['x-user-id'] as string;
    const { data: user } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', userId)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('dashboard_widgets')
      .insert({
        office_id: user.office_id,
        user_id: userId,
        report_id: body.reportId,
        title: body.title,
        position: body.position,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  fastify.delete<{ Params: { widgetId: string } }>(
    '/dashboard/widgets/:widgetId',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { widgetId } = request.params;

      const { error } = await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('id', widgetId);

      if (error) return reply.status(500).send({ error: error.message });
      return reply.status(204).send();
    },
  );
}
