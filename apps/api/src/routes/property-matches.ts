import type { FastifyInstance } from 'fastify';
import { CreatePropertyMatchSchema, UpdatePropertyMatchSchema } from '@realflow/shared';
import { PropertyMatchEngine, fromDbSchema } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

export async function propertyMatchRoutes(fastify: FastifyInstance) {
  // List matches (filter by clientBriefId or clientId)
  fastify.get<{ Querystring: { clientBriefId?: string; clientId?: string } }>(
    '/',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { clientBriefId, clientId } = request.query;

      let query = supabase
        .from('property_matches')
        .select('*')
        .order('overall_score', { ascending: false });

      if (clientBriefId) {
        query = query.eq('client_brief_id', clientBriefId);
      }

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) return reply.status(500).send({ error: error.message });

      return { data };
    },
  );

  // Get single match
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('property_matches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'Property match not found' });
    return { data };
  });

  // Create match
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreatePropertyMatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const match = parsed.data;

    const { data, error } = await supabase
      .from('property_matches')
      .insert({
        property_id: match.propertyId,
        client_brief_id: match.clientBriefId,
        client_id: match.clientId,
        overall_score: match.overallScore,
        score_breakdown: match.scoreBreakdown,
        status: match.status,
        rejection_reason: match.rejectionReason,
        agent_notes: match.agentNotes,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update match status/notes
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdatePropertyMatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.rejectionReason !== undefined) updatePayload.rejection_reason = updates.rejectionReason;
    if (updates.agentNotes !== undefined) updatePayload.agent_notes = updates.agentNotes;

    const { data, error } = await supabase
      .from('property_matches')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Score a property against a brief
  fastify.post<{ Body: { propertyId: string; clientBriefId: string } }>(
    '/score',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { propertyId, clientBriefId } = request.body;

      if (!propertyId || !clientBriefId) {
        return reply.status(400).send({ error: 'propertyId and clientBriefId are required' });
      }

      // Fetch property
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (propertyError || !property) {
        return reply.status(404).send({ error: 'Property not found' });
      }

      // Fetch client brief
      const { data: briefData, error: briefError } = await supabase
        .from('client_briefs')
        .select('*')
        .eq('id', clientBriefId)
        .eq('is_deleted', false)
        .single();

      if (briefError || !briefData) {
        return reply.status(404).send({ error: 'Client brief not found' });
      }

      // Transform DB row to nested structure for business logic
      const brief = fromDbSchema(briefData);

      const result = PropertyMatchEngine.scoreProperty(property, brief);

      return { data: result };
    },
  );
}
