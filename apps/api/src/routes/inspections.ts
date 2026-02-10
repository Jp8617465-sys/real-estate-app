import type { FastifyInstance } from 'fastify';
import { CreateInspectionSchema, UpdateInspectionSchema } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function inspectionRoutes(fastify: FastifyInstance) {
  // List inspections (filter by propertyId, clientId, or createdBy)
  fastify.get<{ Querystring: { propertyId?: string; clientId?: string; createdBy?: string } }>(
    '/',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { propertyId, clientId, createdBy } = request.query;

      let query = supabase
        .from('inspections')
        .select('*')
        .eq('is_deleted', false)
        .order('inspection_date', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      if (createdBy) {
        query = query.eq('created_by', createdBy);
      }

      const { data, error } = await query;
      if (error) return reply.status(500).send({ error: error.message });

      return { data };
    },
  );

  // Get single inspection
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) return reply.status(404).send({ error: 'Inspection not found' });
    return { data };
  });

  // Create inspection
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateInspectionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const inspection = parsed.data;

    const { data, error } = await supabase
      .from('inspections')
      .insert({
        property_id: inspection.propertyId,
        client_id: inspection.clientId,
        transaction_id: inspection.transactionId,
        selling_agent_id: inspection.sellingAgentId,
        inspection_date: inspection.inspectionDate,
        time_spent_minutes: inspection.timeSpentMinutes,
        overall_impression: inspection.overallImpression,
        condition_notes: inspection.conditionNotes,
        area_feel_notes: inspection.areaFeelNotes,
        client_suitability: inspection.clientSuitability,
        photos: inspection.photos ?? [],
        voice_note_url: inspection.voiceNoteUrl,
        voice_note_transcript: inspection.voiceNoteTranscript,
        agent_notes: inspection.agentNotes,
        created_by: inspection.createdBy,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update inspection
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateInspectionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.propertyId !== undefined) updatePayload.property_id = updates.propertyId;
    if (updates.clientId !== undefined) updatePayload.client_id = updates.clientId;
    if (updates.transactionId !== undefined) updatePayload.transaction_id = updates.transactionId;
    if (updates.sellingAgentId !== undefined) updatePayload.selling_agent_id = updates.sellingAgentId;
    if (updates.inspectionDate !== undefined) updatePayload.inspection_date = updates.inspectionDate;
    if (updates.timeSpentMinutes !== undefined) updatePayload.time_spent_minutes = updates.timeSpentMinutes;
    if (updates.overallImpression !== undefined) updatePayload.overall_impression = updates.overallImpression;
    if (updates.conditionNotes !== undefined) updatePayload.condition_notes = updates.conditionNotes;
    if (updates.areaFeelNotes !== undefined) updatePayload.area_feel_notes = updates.areaFeelNotes;
    if (updates.clientSuitability !== undefined) updatePayload.client_suitability = updates.clientSuitability;
    if (updates.photos !== undefined) updatePayload.photos = updates.photos;
    if (updates.voiceNoteUrl !== undefined) updatePayload.voice_note_url = updates.voiceNoteUrl;
    if (updates.voiceNoteTranscript !== undefined) updatePayload.voice_note_transcript = updates.voiceNoteTranscript;
    if (updates.agentNotes !== undefined) updatePayload.agent_notes = updates.agentNotes;
    if (updates.createdBy !== undefined) updatePayload.created_by = updates.createdBy;

    const { data, error } = await supabase
      .from('inspections')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Soft delete inspection
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('inspections')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });
}
