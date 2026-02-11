import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';

export async function portalRoutes(fastify: FastifyInstance) {
  // Get authenticated portal client profile
  fastify.get('/me', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { data, error } = await supabase
      .from('portal_clients')
      .select(
        `
        id,
        auth_id,
        contact_id,
        agent_id,
        is_active,
        contact:contacts!contact_id (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        agent:users!agent_id (
          id,
          full_name,
          email
        )
      `,
      )
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (error) {
      return reply.status(404).send({ error: 'Portal client not found' });
    }

    return { data };
  });

  // Get the active transaction for this portal client
  fastify.get('/transaction', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    // Get portal client to find contact_id
    const { data: portalClient, error: pcError } = await supabase
      .from('portal_clients')
      .select('contact_id')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (pcError || !portalClient) {
      return reply.status(404).send({ error: 'Portal client not found' });
    }

    // Get active transaction for this contact
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('contact_id', portalClient.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return reply.status(404).send({ error: 'No active transaction found' });
    }

    return { data };
  });

  // Get the client's assigned agent info
  fastify.get('/agent', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { data: portalClient, error: pcError } = await supabase
      .from('portal_clients')
      .select('agent_id')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (pcError || !portalClient) {
      return reply.status(404).send({ error: 'Portal client not found' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, avatar_url')
      .eq('id', portalClient.agent_id)
      .single();

    if (error) {
      return reply.status(404).send({ error: 'Agent not found' });
    }

    return { data };
  });
}
