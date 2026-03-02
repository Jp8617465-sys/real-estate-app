import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';
import { CreateFollowUpSequenceSchema, CreateEnrollmentSchema } from '@realflow/shared';
import { enrollContact, type FSESupabaseClient } from '@realflow/business-logic';

export async function followUpSequenceRoutes(fastify: FastifyInstance) {
  // GET / — List sequences (own + templates)
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const query = request.query as Record<string, string | undefined>;

    let dbQuery = supabase
      .from('follow_up_sequences')
      .select('*')
      .eq('is_deleted', false)
      .order('is_template', { ascending: false })
      .order('created_at', { ascending: false });

    if (query.category) {
      dbQuery = dbQuery.eq('category', query.category);
    }

    const { data, error } = await dbQuery;
    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // GET /templates — Pre-built templates only
  fastify.get('/templates', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data, error } = await supabase
      .from('follow_up_sequences')
      .select('*')
      .eq('is_template', true)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // POST / — Create a custom sequence
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateFollowUpSequenceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const seq = parsed.data;
    const body = request.body as Record<string, string | undefined>;
    const createdBy = body?.createdBy;

    const { data, error } = await supabase
      .from('follow_up_sequences')
      .insert({
        name: seq.name,
        description: seq.description ?? null,
        category: seq.category,
        trigger_type: seq.triggerType,
        trigger_config: seq.triggerConfig,
        steps: seq.steps,
        is_template: false,
        is_active: true,
        created_by: createdBy ?? null,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // POST /:id/enroll — Enroll a contact in a sequence
  fastify.post<{ Params: { id: string } }>('/:id/enroll', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = CreateEnrollmentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { contactId, transactionId, enrolledBy } = parsed.data;

    try {
      const result = await enrollContact({
        sequenceId: id,
        contactId,
        transactionId,
        enrolledBy,
        supabase: supabase as unknown as FSESupabaseClient,
      });

      return reply.status(201).send({ data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enrollment failed';
      const status = message.includes('already enrolled') ? 409 : 500;
      return reply.status(status).send({ error: message });
    }
  });

  // GET /:id/enrollments — List enrollments for a sequence
  fastify.get<{ Params: { id: string } }>('/:id/enrollments', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const query = request.query as Record<string, string | undefined>;

    let dbQuery = supabase
      .from('sequence_enrollments')
      .select('*, contacts(first_name, last_name, email)')
      .eq('sequence_id', id)
      .order('created_at', { ascending: false });

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const { data, error } = await dbQuery;
    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // POST /enrollments/:id/pause — Pause an active enrollment
  fastify.post<{ Params: { id: string } }>('/enrollments/:id/pause', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('sequence_enrollments')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single();

    if (error) return reply.status(404).send({ error: 'Active enrollment not found' });
    return { data };
  });

  // POST /enrollments/:id/resume — Resume a paused enrollment
  fastify.post<{ Params: { id: string } }>('/enrollments/:id/resume', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: enrollment, error: fetchError } = await supabase
      .from('sequence_enrollments')
      .select('sequence_id, current_step_index')
      .eq('id', id)
      .eq('status', 'paused')
      .single();

    if (fetchError || !enrollment) {
      return reply.status(404).send({ error: 'Paused enrollment not found' });
    }

    // Recalculate next_step_due_at from now
    const nextStepDueAt = new Date().toISOString();

    const { data, error } = await supabase
      .from('sequence_enrollments')
      .update({
        status: 'active',
        next_step_due_at: nextStepDueAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // DELETE /enrollments/:id — Cancel an enrollment
  fastify.delete<{ Params: { id: string } }>('/enrollments/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('sequence_enrollments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });
}
