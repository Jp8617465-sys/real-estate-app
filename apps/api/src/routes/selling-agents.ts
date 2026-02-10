import type { FastifyInstance } from 'fastify';
import { CreateSellingAgentProfileSchema, UpdateSellingAgentProfileSchema } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function sellingAgentRoutes(fastify: FastifyInstance) {
  // List selling agent profiles (optionally filter by suburb)
  fastify.get<{ Querystring: { suburb?: string } }>('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { suburb } = request.query;

    let query = supabase
      .from('selling_agent_profiles')
      .select('*')
      .order('relationship_score', { ascending: false });

    if (suburb) {
      query = query.contains('suburbs', [suburb]);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });

    return { data };
  });

  // Get profile by contact ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('selling_agent_profiles')
      .select('*')
      .eq('contact_id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'Selling agent profile not found' });
    return { data };
  });

  // Create profile
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateSellingAgentProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const profile = parsed.data;

    const { data, error } = await supabase
      .from('selling_agent_profiles')
      .insert({
        contact_id: profile.contactId,
        agency: profile.agency,
        suburbs: profile.suburbs ?? [],
        relationship_score: profile.relationshipScore,
        last_contact_date: profile.lastContactDate,
        average_response_time: profile.averageResponseTime,
        tags: profile.tags ?? [],
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update profile
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateSellingAgentProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.contactId !== undefined) updatePayload.contact_id = updates.contactId;
    if (updates.agency !== undefined) updatePayload.agency = updates.agency;
    if (updates.suburbs !== undefined) updatePayload.suburbs = updates.suburbs;
    if (updates.relationshipScore !== undefined) updatePayload.relationship_score = updates.relationshipScore;
    if (updates.lastContactDate !== undefined) updatePayload.last_contact_date = updates.lastContactDate;
    if (updates.averageResponseTime !== undefined) updatePayload.average_response_time = updates.averageResponseTime;
    if (updates.tags !== undefined) updatePayload.tags = updates.tags;

    const { data, error } = await supabase
      .from('selling_agent_profiles')
      .update(updatePayload)
      .eq('contact_id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });
}
