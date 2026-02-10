import type { FastifyInstance } from 'fastify';
import {
  WorkflowTriggerSchema,
  WorkflowConditionSchema,
  WorkflowActionSchema,
} from '@realflow/shared';
import {
  BUYERS_AGENT_WORKFLOW_TEMPLATES,
  evaluateTrigger,
  evaluateConditions,
  runWorkflow,
} from '@realflow/business-logic';
import type { WorkflowEvent, WorkflowContext } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';
import { z } from 'zod';

// ─── Request Body Schemas ─────────────────────────────────────────

const CreateWorkflowBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: WorkflowTriggerSchema,
  conditions: z.array(WorkflowConditionSchema),
  actions: z.array(WorkflowActionSchema).min(1),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid(),
});

const UpdateWorkflowBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  trigger: WorkflowTriggerSchema.optional(),
  conditions: z.array(WorkflowConditionSchema).optional(),
  actions: z.array(WorkflowActionSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

const CreateFromTemplateBodySchema = z.object({
  templateId: z.number().int().nonnegative(),
  createdBy: z.string().uuid(),
});

const DispatchEventBodySchema = z.object({
  type: z.enum(['stage_change', 'new_lead', 'field_change', 'form_submitted']),
  contactId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

// ─── Routes ───────────────────────────────────────────────────────

export async function workflowRoutes(fastify: FastifyInstance) {
  // GET / - List workflows
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const query = request.query as Record<string, string | undefined>;

    let dbQuery = supabase
      .from('workflows')
      .select('*')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (query.is_active !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.is_active === 'true');
    }

    const { data, error } = await dbQuery;
    if (error) return reply.status(500).send({ error: error.message });

    return { data };
  });

  // GET /templates - Return pre-built workflow templates
  fastify.get('/templates', async () => {
    return {
      data: BUYERS_AGENT_WORKFLOW_TEMPLATES.map((template, index) => ({
        id: index,
        ...template,
      })),
    };
  });

  // POST /from-template - Create workflow from template
  fastify.post('/from-template', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateFromTemplateBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { templateId, createdBy } = parsed.data;
    const template = BUYERS_AGENT_WORKFLOW_TEMPLATES[templateId];

    if (!template) {
      return reply.status(404).send({ error: `Template with ID ${templateId} not found` });
    }

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        name: template.name,
        description: template.description,
        trigger: template.trigger,
        conditions: template.conditions,
        actions: template.actions,
        is_active: true,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // GET /:id - Single workflow
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) return reply.status(404).send({ error: 'Workflow not found' });
    return { data };
  });

  // POST / - Create custom workflow
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateWorkflowBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const body = parsed.data;

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        name: body.name,
        description: body.description,
        trigger: body.trigger,
        conditions: body.conditions,
        actions: body.actions,
        is_active: body.isActive,
        created_by: body.createdBy,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // PATCH /:id - Update workflow
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateWorkflowBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {};

    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.trigger !== undefined) updatePayload.trigger = updates.trigger;
    if (updates.conditions !== undefined) updatePayload.conditions = updates.conditions;
    if (updates.actions !== undefined) updatePayload.actions = updates.actions;
    if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('workflows')
      .update(updatePayload)
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
      .from('workflows')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });

  // GET /:id/runs - List runs for a workflow
  fastify.get<{ Params: { id: string } }>('/:id/runs', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('workflow_runs')
      .select('*')
      .eq('workflow_id', id)
      .order('started_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // POST /evaluate - Scheduler endpoint for time-based triggers
  fastify.post('/evaluate', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    // Get all active workflows with scheduler-based triggers
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (error) return reply.status(500).send({ error: error.message });
    if (!workflows || workflows.length === 0) {
      return { evaluated: 0, triggered: 0 };
    }

    // Filter to time-based, no_activity, and date_approaching triggers
    const schedulerWorkflows = workflows.filter(
      (wf: Record<string, unknown>) => {
        const trigger = wf.trigger as Record<string, unknown>;
        return ['time_based', 'no_activity', 'date_approaching'].includes(trigger.type as string);
      },
    );

    return {
      evaluated: schedulerWorkflows.length,
      triggered: 0, // Actual evaluation would be done by a scheduled job
      workflows: schedulerWorkflows.map((wf: Record<string, unknown>) => wf.id),
    };
  });

  // POST /dispatch - Event endpoint: find and run matching workflows
  fastify.post('/dispatch', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = DispatchEventBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const eventData = parsed.data;
    const event: WorkflowEvent = {
      type: eventData.type,
      contactId: eventData.contactId,
      transactionId: eventData.transactionId,
      data: eventData.data,
    };

    // Get all active workflows
    const { data: workflows, error: wfError } = await supabase
      .from('workflows')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (wfError) return reply.status(500).send({ error: wfError.message });
    if (!workflows || workflows.length === 0) {
      return { dispatched: 0, results: [] };
    }

    // Find matching workflows and execute them
    const results = [];
    for (const wf of workflows) {
      const workflow = {
        id: wf.id as string,
        name: wf.name as string,
        description: wf.description as string | undefined,
        trigger: wf.trigger as WorkflowEvent['type'] extends string ? typeof wf.trigger : never,
        conditions: wf.conditions as { field: string; operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'; value?: unknown }[],
        actions: wf.actions as { type: string }[],
        isActive: wf.is_active as boolean,
        createdBy: wf.created_by as string,
        createdAt: wf.created_at as string,
        updatedAt: wf.updated_at as string,
      };

      // Check if trigger matches
      if (!evaluateTrigger(workflow.trigger, event)) continue;

      // Fetch entity data for condition evaluation
      let entityData: Record<string, unknown> = {};
      if (event.contactId) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', event.contactId)
          .single();
        if (contact) entityData = contact as Record<string, unknown>;
      }

      const context: WorkflowContext = {
        contactId: event.contactId,
        transactionId: event.transactionId,
        entityData,
        supabase: supabase as unknown as WorkflowContext['supabase'],
      };

      if (!evaluateConditions(workflow.conditions, context)) continue;

      // Run the workflow
      const result = await runWorkflow(
        workflow as Parameters<typeof runWorkflow>[0],
        event,
        context,
      );
      results.push(result);
    }

    return { dispatched: results.length, results };
  });
}
