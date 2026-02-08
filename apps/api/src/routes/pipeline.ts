import type { FastifyInstance } from 'fastify';
import { PipelineEngine } from '@realflow/business-logic';
import { PipelineTypeSchema } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function pipelineRoutes(fastify: FastifyInstance) {
  // Get transactions by pipeline type
  fastify.get<{ Querystring: { type?: string } }>('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const pipelineType = request.query.type ?? 'buying';

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, phone, email, buyer_profile, lead_score),
        property:properties(id, address_street_number, address_street_name, address_suburb, address_state)
      `)
      .eq('pipeline_type', pipelineType)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Transition stage
  fastify.post<{
    Params: { id: string };
    Body: { toStage: string; reason?: string; userId: string };
  }>('/:id/transition', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const { toStage, reason, userId } = request.body;

    // Get current transaction
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !transaction) {
      return reply.status(404).send({ error: 'Transaction not found' });
    }

    const pipelineType = PipelineTypeSchema.parse(transaction.pipeline_type);

    // Validate transition
    if (!PipelineEngine.isValidTransition(pipelineType, transaction.current_stage, toStage)) {
      return reply.status(400).send({
        error: `Invalid transition from ${transaction.current_stage} to ${toStage}`,
        validNextStages: PipelineEngine.getValidNextStages(pipelineType, transaction.current_stage),
      });
    }

    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ current_stage: toStage })
      .eq('id', id);

    if (updateError) return reply.status(500).send({ error: updateError.message });

    // Log transition
    await supabase.from('stage_transitions').insert({
      transaction_id: id,
      from_stage: transaction.current_stage,
      to_stage: toStage,
      triggered_by: userId,
      reason,
    });

    // Log activity
    if (transaction.contact_id) {
      await supabase.from('activities').insert({
        contact_id: transaction.contact_id,
        transaction_id: id,
        type: 'stage-change',
        title: `Stage changed to ${toStage}`,
        description: reason,
        created_by: userId,
      });
    }

    return { success: true, newStage: toStage };
  });
}
