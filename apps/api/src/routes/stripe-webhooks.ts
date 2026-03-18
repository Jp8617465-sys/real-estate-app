import type { FastifyInstance } from 'fastify';
import { createSupabaseServiceClient } from '../middleware/supabase';
import { getStripeClient } from '../services/stripe-service';
import type { StripeWebhookEvent } from '@realflow/integrations';

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  // Stripe sends raw body — register raw content type parser
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  fastify.post('/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;
    if (!signature) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    const stripe = getStripeClient();
    let event: StripeWebhookEvent;

    try {
      event = await stripe.constructWebhookEvent(request.body as string, signature);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook verification failed';
      return reply.status(400).send({ error: message });
    }

    const supabase = createSupabaseServiceClient();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Record<string, unknown>;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const metadata = (session.metadata ?? {}) as Record<string, string>;

        if (subscriptionId) {
          const stripeSub = await stripe.getSubscription(subscriptionId);

          await supabase.from('subscriptions').upsert({
            office_id: metadata.office_id,
            plan_id: stripeSub.metadata.plan_id ?? 'starter',
            status: stripeSub.status === 'trialing' ? 'trialing' : 'active',
            billing_interval: stripeSub.items.data[0]?.price.recurring.interval === 'year' ? 'yearly' : 'monthly',
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: stripeSub.cancel_at_period_end,
            trial_ends_at: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null,
            seat_count: stripeSub.items.data[0]?.quantity ?? 1,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'stripe_subscription_id' });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Record<string, unknown>;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;
        const amountPaid = (invoice.amount_paid as number) / 100; // cents to dollars
        const tax = ((invoice.tax as number) ?? 0) / 100;

        // Find office from subscription
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id, office_id')
          .eq('stripe_customer_id', customerId)
          .limit(1)
          .single();

        if (sub) {
          await supabase.from('payment_history').insert({
            office_id: sub.office_id,
            subscription_id: sub.id,
            amount_aud: amountPaid,
            gst_amount_aud: tax,
            status: 'succeeded',
            stripe_payment_intent_id: (invoice.payment_intent as string) ?? '',
            stripe_invoice_id: invoice.id as string,
            description: `Subscription payment - ${invoice.id}`,
            paid_at: new Date().toISOString(),
          });

          // Ensure subscription is active
          await supabase
            .from('subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', sub.id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Record<string, unknown>;
        const customerId = invoice.customer as string;

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id, office_id')
          .eq('stripe_customer_id', customerId)
          .limit(1)
          .single();

        if (sub) {
          await supabase.from('payment_history').insert({
            office_id: sub.office_id,
            subscription_id: sub.id,
            amount_aud: ((invoice.amount_due as number) ?? 0) / 100,
            gst_amount_aud: 0,
            status: 'failed',
            stripe_payment_intent_id: (invoice.payment_intent as string) ?? '',
            stripe_invoice_id: invoice.id as string,
            description: `Payment failed - ${invoice.id}`,
          });

          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', sub.id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Record<string, unknown>;
        const stripeSubId = subscription.id as string;

        const updateData: Record<string, unknown> = {
          status: subscription.status as string,
          cancel_at_period_end: subscription.cancel_at_period_end as boolean,
          current_period_start: new Date((subscription.current_period_start as number) * 1000).toISOString(),
          current_period_end: new Date((subscription.current_period_end as number) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };

        const metadata = (subscription.metadata ?? {}) as Record<string, string>;
        if (metadata.plan_id) {
          updateData.plan_id = metadata.plan_id;
        }

        await supabase
          .from('subscriptions')
          .update(updateData)
          .eq('stripe_subscription_id', stripeSubId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Record<string, unknown>;
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id as string);
        break;
      }
    }

    return reply.status(200).send({ received: true });
  });
}
