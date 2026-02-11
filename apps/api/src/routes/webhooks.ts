import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { createSupabaseClient } from '../middleware/supabase';
import { env } from '../config/env';

/**
 * Verify Domain webhook signature using HMAC SHA-256
 */
function verifyDomainSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) {
    return false;
  }
  try {
    const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify Meta webhook signature using HMAC SHA-256 with sha256= prefix
 */
function verifyMetaSignature(payload: string, signature: string, appSecret: string): boolean {
  if (!appSecret || !signature) {
    return false;
  }
  try {
    const hash = 'sha256=' + crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function webhookRoutes(fastify: FastifyInstance) {
  // Domain.com.au enquiry webhook
  fastify.post('/domain/enquiry', async (request, reply) => {
    // Verify webhook signature
    if (env.DOMAIN_WEBHOOK_SECRET) {
      const signature = request.headers['x-domain-signature'] as string;
      const payload = JSON.stringify(request.body);

      if (!verifyDomainSignature(payload, signature, env.DOMAIN_WEBHOOK_SECRET)) {
        fastify.log.warn('Invalid Domain webhook signature');
        return reply.status(401).send({ error: 'Invalid signature' });
      }
    }

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
    // Verify webhook signature
    if (env.META_APP_SECRET) {
      const signature = request.headers['x-hub-signature-256'] as string;
      const payload = JSON.stringify(request.body);

      if (!verifyMetaSignature(payload, signature, env.META_APP_SECRET)) {
        fastify.log.warn('Invalid Meta webhook signature');
        return reply.status(401).send({ error: 'Invalid signature' });
      }
    }

    const body = request.body as Record<string, unknown>;
    fastify.log.info({ body }, 'Received Meta lead webhook');

    // Implement lead processing logic here
    return { received: true };
  });

  // Generic webhook for testing (development and test only)
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    fastify.post('/test', async (request) => {
      return { received: true, body: request.body };
    });
  }
}
