import type { FastifyInstance } from 'fastify';
import {
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
  BillingPortalRequestSchema,
  SUBSCRIPTION_PLANS,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';
import { getStripeClient } from '../services/stripe-service';

export async function subscriptionRoutes(fastify: FastifyInstance) {
  // ─── Get subscription plans ───────────────────────────────────────
  fastify.get('/plans', async () => {
    return { data: SUBSCRIPTION_PLANS };
  });

  // ─── Get current subscription ─────────────────────────────────────
  fastify.get('/current', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: user } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', request.headers['x-user-id'] as string)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('office_id', user.office_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return reply.status(404).send({ error: 'No subscription found' });

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.plan_id);

    return { data: { ...subscription, plan } };
  });

  // ─── Create checkout session ──────────────────────────────────────
  fastify.post('/checkout', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateSubscriptionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { planId, billingInterval, seatCount, successUrl, cancelUrl } = parsed.data;

    // Get user and office
    const { data: user } = await supabase
      .from('users')
      .select('id, email, office_id, first_name, last_name')
      .eq('id', request.headers['x-user-id'] as string)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) return reply.status(400).send({ error: 'Invalid plan' });

    if (planId === 'enterprise') {
      return reply.status(400).send({ error: 'Enterprise plans require contacting sales' });
    }

    const stripe = getStripeClient();

    // Check if customer already exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('office_id', user.office_id)
      .limit(1)
      .single();

    let customerId: string;

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      const customer = await stripe.createCustomer({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        officeId: user.office_id,
      });
      customerId = customer.id;
    }

    // Determine price ID from plan and interval
    const priceId = billingInterval === 'yearly'
      ? plan.stripePriceIdYearly
      : plan.stripePriceIdMonthly;

    if (!priceId) {
      return reply.status(400).send({ error: 'Price not configured for this plan' });
    }

    const session = await stripe.createCheckoutSession({
      customerId,
      priceId,
      quantity: seatCount,
      successUrl,
      cancelUrl,
      trialDays: 14,
      officeId: user.office_id,
      planId,
    });

    return { data: { checkoutUrl: session.url, sessionId: session.id } };
  });

  // ─── Update subscription ──────────────────────────────────────────
  fastify.put('/current', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = UpdateSubscriptionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { data: user } = await supabase
      .from('users')
      .select('office_id, role')
      .eq('id', request.headers['x-user-id'] as string)
      .single();

    if (!user || !['admin', 'principal'].includes(user.role)) {
      return reply.status(403).send({ error: 'Only admins and principals can manage subscriptions' });
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('office_id', user.office_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) return reply.status(404).send({ error: 'No subscription found' });

    const stripe = getStripeClient();
    const updates = parsed.data;

    if (updates.cancelAtPeriodEnd !== undefined) {
      await stripe.updateSubscription(subscription.stripe_subscription_id, {
        cancelAtPeriodEnd: updates.cancelAtPeriodEnd,
      });

      const { data: updated, error } = await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: updates.cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return { data: updated };
    }

    if (updates.seatCount) {
      await stripe.updateSubscription(subscription.stripe_subscription_id, {
        quantity: updates.seatCount,
      });

      const { data: updated, error } = await supabase
        .from('subscriptions')
        .update({
          seat_count: updates.seatCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return { data: updated };
    }

    return { data: subscription };
  });

  // ─── Billing portal redirect ──────────────────────────────────────
  fastify.post('/billing-portal', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = BillingPortalRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { data: user } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', request.headers['x-user-id'] as string)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('office_id', user.office_id)
      .limit(1)
      .single();

    if (!subscription) return reply.status(404).send({ error: 'No subscription found' });

    const stripe = getStripeClient();
    const session = await stripe.createBillingPortalSession({
      customerId: subscription.stripe_customer_id,
      returnUrl: parsed.data.returnUrl,
    });

    return { data: { portalUrl: session.url } };
  });

  // ─── Payment history ──────────────────────────────────────────────
  fastify.get('/payments', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: user } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', request.headers['x-user-id'] as string)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: payments, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('office_id', user.office_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return reply.status(500).send({ error: error.message });
    return { data: payments };
  });
}
