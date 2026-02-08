import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';

export async function webhookRoutes(fastify: FastifyInstance) {
  // Domain.com.au enquiry webhook
  fastify.post('/domain/enquiry', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const body = request.body as Record<string, unknown>;

    fastify.log.info({ body }, 'Received Domain enquiry webhook');

    // Extract enquiry data from Domain webhook payload
    // Domain sends enquiry details including contact info and listing reference
    const enquiry = body as {
      enquirerName?: string;
      enquirerEmail?: string;
      enquirerPhone?: string;
      listingId?: string;
      message?: string;
    };

    if (!enquiry.enquirerPhone && !enquiry.enquirerEmail) {
      return reply.status(400).send({ error: 'Missing contact information' });
    }

    const [firstName, ...lastParts] = (enquiry.enquirerName ?? 'Unknown').split(' ');
    const lastName = lastParts.join(' ') || 'Unknown';

    // Create contact as new lead
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        types: ['buyer'],
        first_name: firstName,
        last_name: lastName,
        email: enquiry.enquirerEmail,
        phone: enquiry.enquirerPhone ?? '',
        source: 'domain',
        source_detail: `Domain listing ${enquiry.listingId ?? 'unknown'}`,
        assigned_agent_id: '00000000-0000-0000-0000-000000000000', // Will be assigned via round-robin
        tags: ['new-lead', 'domain-enquiry'],
        communication_preference: 'any',
      })
      .select()
      .single();

    if (error) {
      fastify.log.error({ error }, 'Failed to create contact from Domain enquiry');
      return reply.status(500).send({ error: error.message });
    }

    return reply.status(201).send({ data, source: 'domain' });
  });

  // Facebook Lead Ads webhook
  fastify.post('/meta/lead', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    fastify.log.info({ body }, 'Received Meta lead webhook');

    // Verify webhook (Meta sends a verification challenge)
    // In production, validate the signature using the app secret
    return { received: true };
  });

  // Generic webhook for testing
  fastify.post('/test', async (request) => {
    return { received: true, body: request.body };
  });
}
