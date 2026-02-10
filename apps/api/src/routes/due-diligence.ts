import type { FastifyInstance } from 'fastify';
import { UpdateDueDiligenceItemSchema } from '@realflow/shared';
import { DueDiligenceEngine } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

export async function dueDiligenceRoutes(fastify: FastifyInstance) {
  // Get checklist with items for a transaction
  fastify.get<{ Params: { transactionId: string } }>(
    '/transaction/:transactionId',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { transactionId } = request.params;

      const { data: checklist, error: checklistError } = await supabase
        .from('due_diligence_checklists')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (checklistError || !checklist) {
        return reply.status(404).send({ error: 'Due diligence checklist not found' });
      }

      // Fetch items for this checklist
      const { data: items, error: itemsError } = await supabase
        .from('due_diligence_items')
        .select('*')
        .eq('checklist_id', checklist.id)
        .order('sort_order', { ascending: true });

      if (itemsError) return reply.status(500).send({ error: itemsError.message });

      return {
        data: {
          ...checklist,
          items: items ?? [],
        },
      };
    },
  );

  // Generate checklist for state + propertyType, save to DB
  fastify.post<{
    Body: { transactionId: string; state: string; propertyType: string; createdBy: string };
  }>('/generate', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { transactionId, state, propertyType, createdBy } = request.body;

    if (!transactionId || !state || !propertyType || !createdBy) {
      return reply.status(400).send({
        error: 'transactionId, state, propertyType, and createdBy are required',
      });
    }

    // Generate checklist from template
    const generated = DueDiligenceEngine.generateChecklist(state, propertyType);
    if (!generated) {
      return reply.status(400).send({ error: `No template found for state: ${state}` });
    }

    // Create the checklist record
    const { data: checklist, error: checklistError } = await supabase
      .from('due_diligence_checklists')
      .insert({
        transaction_id: transactionId,
        state: generated.state,
        property_type: generated.propertyType,
        status: 'not_started',
        completion_percentage: 0,
        created_by: createdBy,
      })
      .select()
      .single();

    if (checklistError || !checklist) {
      return reply.status(500).send({ error: checklistError?.message ?? 'Failed to create checklist' });
    }

    // Insert all generated items
    const itemsToInsert = generated.items.map((item) => ({
      checklist_id: checklist.id,
      category: item.category,
      name: item.name,
      description: item.description,
      status: 'not_started',
      assigned_to: item.assignedTo,
      is_blocking: item.isBlocking,
      is_critical: item.isCritical,
      sort_order: item.sortOrder,
      documents: [],
    }));

    const { data: items, error: itemsError } = await supabase
      .from('due_diligence_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) return reply.status(500).send({ error: itemsError.message });

    return reply.status(201).send({
      data: {
        ...checklist,
        items: items ?? [],
      },
    });
  });

  // Update checklist item status
  fastify.put<{ Params: { itemId: string } }>('/items/:itemId', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { itemId } = request.params;
    const parsed = UpdateDueDiligenceItemSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.assignedTo !== undefined) updatePayload.assigned_to = updates.assignedTo;
    if (updates.dueDate !== undefined) updatePayload.due_date = updates.dueDate;
    if (updates.completedDate !== undefined) updatePayload.completed_date = updates.completedDate;
    if (updates.documents !== undefined) updatePayload.documents = updates.documents;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes;
    if (updates.isBlocking !== undefined) updatePayload.is_blocking = updates.isBlocking;
    if (updates.isCritical !== undefined) updatePayload.is_critical = updates.isCritical;

    // If status is being set to completed, set completedDate
    if (updates.status === 'completed' && !updates.completedDate) {
      updatePayload.completed_date = new Date().toISOString();
    }

    const { data: item, error: itemError } = await supabase
      .from('due_diligence_items')
      .update(updatePayload)
      .eq('id', itemId)
      .select()
      .single();

    if (itemError) return reply.status(500).send({ error: itemError.message });

    // Recalculate checklist completion percentage
    if (item) {
      const { data: allItems } = await supabase
        .from('due_diligence_items')
        .select('status, is_blocking')
        .eq('checklist_id', item.checklist_id);

      if (allItems) {
        const statuses = allItems.map((i) => i.status as string);
        const completionPercentage = DueDiligenceEngine.calculateCompletion(statuses);
        const hasBlocking = DueDiligenceEngine.hasBlockingIssues(
          allItems.map((i) => ({ isBlocking: i.is_blocking as boolean, status: i.status as string })),
        );

        let checklistStatus: string = 'in_progress';
        if (completionPercentage === 100) checklistStatus = 'completed';
        else if (hasBlocking) checklistStatus = 'blocked';
        else if (completionPercentage === 0) checklistStatus = 'not_started';

        await supabase
          .from('due_diligence_checklists')
          .update({
            completion_percentage: completionPercentage,
            status: checklistStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.checklist_id);
      }
    }

    return { data: item };
  });

  // Get template items for a state
  fastify.get<{ Params: { state: string } }>('/templates/:state', async (_request, reply) => {
    const { state } = _request.params;

    const checklist = DueDiligenceEngine.generateChecklist(state, 'house');
    if (!checklist) {
      return reply.status(404).send({ error: `No template found for state: ${state}` });
    }

    return {
      data: {
        state: checklist.state,
        supportedStates: DueDiligenceEngine.getSupportedStates(),
        items: checklist.items,
      },
    };
  });
}
