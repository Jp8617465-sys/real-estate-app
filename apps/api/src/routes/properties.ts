import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';

export async function propertyRoutes(fastify: FastifyInstance) {
  // List properties
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Get single property
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        vendor:contacts(id, first_name, last_name, phone, email),
        interested_buyers:property_interested_buyers(
          contact:contacts(id, first_name, last_name, phone, buyer_profile)
        )
      `)
      .eq('id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'Property not found' });
    return { data };
  });
}
