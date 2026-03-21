import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';
import { SubscriptionService } from '../services/subscription-service';

const subscriptionService = new SubscriptionService();

export async function subscriptionRoutes(fastify: FastifyInstance) {
  // POST /checkout — create Stripe Checkout session
  fastify.post('/checkout', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Get user's office
    const { data: profile } = await supabase
      .from('users')
      .select('office_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile?.office_id) {
      return reply.status(400).send({ error: 'No office associated with user' });
    }

    const url = await subscriptionService.createCheckoutSession(
      profile.office_id,
      user.email ?? ''
    );

    if (!url) {
      return reply.status(503).send({ error: 'Billing not configured' });
    }

    return { data: { url } };
  });

  // POST /portal — create Stripe Billing Portal session
  fastify.post('/portal', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('office_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile?.office_id) {
      return reply.status(400).send({ error: 'No office associated with user' });
    }

    const url = await subscriptionService.createPortalSession(profile.office_id);

    if (!url) {
      return reply.status(503).send({ error: 'Billing not configured or no subscription found' });
    }

    return { data: { url } };
  });

  // GET /status — get subscription status for user's office
  fastify.get('/status', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('office_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile?.office_id) {
      return reply.status(400).send({ error: 'No office associated with user' });
    }

    const status = await subscriptionService.getSubscriptionStatus(profile.office_id);
    return { data: status };
  });

  // POST /webhook — Stripe webhook handler (no auth — verified via signature)
  fastify.post('/webhook', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    // Access raw body — stored by Fastify rawBody plugin or custom parser
    const rawBody = (request as unknown as Record<string, unknown>).rawBody as Buffer | undefined;
    if (!rawBody) {
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    try {
      await subscriptionService.handleWebhook(rawBody, signature);
      return { received: true };
    } catch (err) {
      request.log.error(err, 'Stripe webhook processing failed');
      return reply.status(400).send({
        error: err instanceof Error ? err.message : 'Webhook processing failed',
      });
    }
  });
}
