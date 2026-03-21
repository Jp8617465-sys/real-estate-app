import Stripe from 'stripe';
import { env } from '../config/env';
import { createSupabaseServiceClient } from '../middleware/supabase';
import {
  EventBus,
  RealFlowEventType,
} from '@realflow/business-logic';
import type { SubscriptionTier, SubscriptionResponse } from '@realflow/shared';

// Map Stripe price IDs to tiers
function priceIdToTier(priceId: string | null): SubscriptionTier {
  if (!priceId) return 'free';
  if (priceId === env.STRIPE_ENTERPRISE_PRICE_ID) return 'enterprise';
  if (priceId === env.STRIPE_PRO_PRICE_ID) return 'professional';
  return 'free';
}

function getStripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export class SubscriptionService {
  private eventBus = EventBus.getInstance();

  async createCheckoutSession(officeId: string, email: string): Promise<string | null> {
    const stripe = getStripeClient();
    if (!stripe || !env.STRIPE_PRO_PRICE_ID) return null;

    const supabase = createSupabaseServiceClient();

    // Get or create Stripe customer
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('office_id', officeId)
      .single();

    let customerId = sub?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { office_id: officeId } });
      customerId = customer.id;

      // Upsert subscription row with customer ID
      await supabase.from('subscriptions').upsert(
        { office_id: officeId, stripe_customer_id: customerId, tier: 'free', status: 'inactive' },
        { onConflict: 'office_id' }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: env.STRIPE_SUCCESS_URL ?? 'http://localhost:3000/settings?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: env.STRIPE_CANCEL_URL ?? 'http://localhost:3000/settings',
      metadata: { office_id: officeId },
    });

    return session.url;
  }

  async createPortalSession(officeId: string): Promise<string | null> {
    const stripe = getStripeClient();
    if (!stripe) return null;

    const supabase = createSupabaseServiceClient();

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('office_id', officeId)
      .single();

    if (!sub?.stripe_customer_id) return null;

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: env.STRIPE_CANCEL_URL ?? 'http://localhost:3000/settings',
    });

    return session.url;
  }

  async getSubscriptionStatus(officeId: string): Promise<SubscriptionResponse> {
    const supabase = createSupabaseServiceClient();

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('office_id', officeId)
      .single();

    if (!sub) {
      return { subscription: null, tier: 'free', status: 'inactive', isActive: false };
    }

    return {
      subscription: {
        id: sub.id,
        officeId: sub.office_id,
        stripeCustomerId: sub.stripe_customer_id,
        stripeSubscriptionId: sub.stripe_subscription_id,
        stripePriceId: sub.stripe_price_id,
        tier: sub.tier,
        status: sub.status,
        productScope: sub.product_scope,
        seatCount: sub.seat_count,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        createdAt: sub.created_at,
        updatedAt: sub.updated_at,
      },
      tier: sub.tier as SubscriptionTier,
      status: sub.status,
      isActive: sub.status === 'active' || sub.status === 'trialing',
    };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const stripe = getStripeClient();
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe not configured');
    }

    const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    const supabase = createSupabaseServiceClient();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const officeId = session.metadata?.office_id;
        if (!officeId || !session.subscription) break;

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

        // Fetch the subscription to get price info
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const firstItem = stripeSub.items.data[0];
        const priceId = firstItem?.price?.id ?? null;
        const tier = priceIdToTier(priceId);

        await supabase
          .from('subscriptions')
          .upsert(
            {
              office_id: officeId,
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: priceId,
              tier,
              status: 'active',
              current_period_start: firstItem ? new Date(firstItem.current_period_start * 1000).toISOString() : null,
              current_period_end: firstItem ? new Date(firstItem.current_period_end * 1000).toISOString() : null,
            },
            { onConflict: 'office_id' }
          );

        void this.eventBus.publish(RealFlowEventType.SUBSCRIPTION_CREATED, {
          officeId,
          tier,
        }, { sourceService: 'subscription-service' });
        break;
      }

      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const updatedItem = stripeSub.items.data[0];
        const priceId = updatedItem?.price?.id ?? null;
        const tier = priceIdToTier(priceId);

        // Look up office by stripe_subscription_id
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('office_id, tier')
          .eq('stripe_subscription_id', stripeSub.id)
          .single();

        if (!existing) break;

        const statusMap: Record<string, string> = {
          active: 'active',
          trialing: 'trialing',
          past_due: 'past_due',
          canceled: 'canceled',
          incomplete: 'inactive',
          incomplete_expired: 'inactive',
          unpaid: 'past_due',
          paused: 'inactive',
        };

        await supabase
          .from('subscriptions')
          .update({
            stripe_price_id: priceId,
            tier,
            status: statusMap[stripeSub.status] ?? 'inactive',
            current_period_start: updatedItem ? new Date(updatedItem.current_period_start * 1000).toISOString() : null,
            current_period_end: updatedItem ? new Date(updatedItem.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: stripeSub.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', stripeSub.id);

        // Emit upgrade event if tier changed up
        const tierRank: Record<string, number> = { free: 0, professional: 1, enterprise: 2 };
        if ((tierRank[tier] ?? 0) > (tierRank[existing.tier] ?? 0)) {
          void this.eventBus.publish(RealFlowEventType.SUBSCRIPTION_UPGRADED, {
            officeId: existing.office_id,
            fromTier: existing.tier,
            toTier: tier,
          }, { sourceService: 'subscription-service' });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription;

        const { data: existing } = await supabase
          .from('subscriptions')
          .select('office_id')
          .eq('stripe_subscription_id', stripeSub.id)
          .single();

        await supabase
          .from('subscriptions')
          .update({
            tier: 'free',
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('stripe_subscription_id', stripeSub.id);

        if (existing) {
          void this.eventBus.publish(RealFlowEventType.SUBSCRIPTION_CANCELLED, {
            officeId: existing.office_id,
          }, { sourceService: 'subscription-service' });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subDetails = invoice.parent?.subscription_details;
        const subscriptionId =
          subDetails
            ? typeof subDetails.subscription === 'string'
              ? subDetails.subscription
              : subDetails.subscription?.id
            : null;

        if (!subscriptionId) break;

        const { data: existing } = await supabase
          .from('subscriptions')
          .select('office_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId);

        if (existing) {
          void this.eventBus.publish(RealFlowEventType.PAYMENT_FAILED, {
            officeId: existing.office_id,
          }, { sourceService: 'subscription-service' });
        }
        break;
      }
    }
  }
}
