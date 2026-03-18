import { StripeClient } from '@realflow/integrations';

let stripeClient: StripeClient | null = null;

/**
 * Returns the singleton StripeClient instance.
 * Configured via environment variables.
 */
export function getStripeClient(): StripeClient {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey || !webhookSecret) {
      throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set');
    }

    stripeClient = new StripeClient({
      secretKey,
      webhookSecret,
    });
  }

  return stripeClient;
}

/**
 * Check if Stripe is configured and available.
 */
export function isStripeEnabled(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
