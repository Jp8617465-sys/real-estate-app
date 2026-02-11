import type { FastifyInstance } from 'fastify';
import { CreateTaskSchema, UpdateTaskSchema } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function taskRoutes(fastify: FastifyInstance) {
  // GET / - List tasks with filters
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const query = request.query as Record<string, string | undefined>;

    let dbQuery = supabase
      .from('tasks')
      .select('*')
      .eq('is_deleted', false)
      .order('due_date', { ascending: true });

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    if (query.priority) {
      dbQuery = dbQuery.eq('priority', query.priority);
    }

    if (query.assigned_to) {
      dbQuery = dbQuery.eq('assigned_to', query.assigned_to);
    }

    if (query.contact_id) {
      dbQuery = dbQuery.eq('contact_id', query.contact_id);
    }

    if (query.due_date_from) {
      dbQuery = dbQuery.gte('due_date', query.due_date_from);
    }

    if (query.due_date_to) {
      dbQuery = dbQuery.lte('due_date', query.due_date_to);
    }

    const { data, error } = await dbQuery;
    if (error) return reply.status(500).send({ error: error.message });

    return { data };
  });

  // GET /:id - Single task
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) return reply.status(404).send({ error: 'Task not found' });
    return { data };
  });

  // POST / - Create task
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateTaskSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const task = parsed.data;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: task.title,
        description: task.description,
        type: task.type,
        priority: task.priority,
        status: task.status,
        contact_id: task.contactId,
        property_id: task.propertyId,
        transaction_id: task.transactionId,
        assigned_to: task.assignedTo,
        due_date: task.dueDate,
        reminder_at: task.reminderAt,
        workflow_id: task.workflowId,
        is_automated: task.isAutomated,
        created_by: task.createdBy,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // PATCH /:id - Update task
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateTaskSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {};

    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.type !== undefined) updatePayload.type = updates.type;
    if (updates.priority !== undefined) updatePayload.priority = updates.priority;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.contactId !== undefined) updatePayload.contact_id = updates.contactId;
    if (updates.propertyId !== undefined) updatePayload.property_id = updates.propertyId;
    if (updates.transactionId !== undefined) updatePayload.transaction_id = updates.transactionId;
    if (updates.assignedTo !== undefined) updatePayload.assigned_to = updates.assignedTo;
    if (updates.dueDate !== undefined) updatePayload.due_date = updates.dueDate;
    if (updates.reminderAt !== undefined) updatePayload.reminder_at = updates.reminderAt;
    if (updates.workflowId !== undefined) updatePayload.workflow_id = updates.workflowId;
    if (updates.isAutomated !== undefined) updatePayload.is_automated = updates.isAutomated;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // POST /:id/complete - Mark task complete
  fastify.post<{ Params: { id: string } }>('/:id/complete', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // DELETE /:id - Soft delete
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('tasks')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });
}
