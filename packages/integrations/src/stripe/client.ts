import { z } from 'zod';
import type { SubscriptionPlanId, BillingInterval } from '@realflow/shared';

// ─── Configuration ──────────────────────────────────────────────────

const StripeConfigSchema = z.object({
  secretKey: z.string().min(1),
  webhookSecret: z.string().min(1),
  baseUrl: z.string().url().default('https://api.stripe.com'),
});

type StripeConfigInput = z.input<typeof StripeConfigSchema>;
type StripeConfig = z.infer<typeof StripeConfigSchema>;

// ─── Stripe Response Types ──────────────────────────────────────────

export interface StripeCustomer {
  id: string;
  email: string;
  name: string | null;
  metadata: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_end: number | null;
  items: {
    data: Array<{
      id: string;
      price: { id: string; recurring: { interval: string } };
      quantity: number;
    }>;
  };
  metadata: Record<string, string>;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  customer: string;
  subscription: string | null;
}

export interface StripeBillingPortalSession {
  id: string;
  url: string;
}

export interface StripeInvoice {
  id: string;
  customer: string;
  subscription: string | null;
  amount_paid: number;
  tax: number | null;
  status: string;
  payment_intent: string | null;
  hosted_invoice_url: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

// ─── Client ─────────────────────────────────────────────────────────

/**
 * Stripe API client using raw fetch() — no SDK dependency.
 * Follows the same integration pattern as DomainClient, AnthropicClient, etc.
 */
export class StripeClient {
  private config: StripeConfig;

  constructor(config: StripeConfigInput) {
    this.config = StripeConfigSchema.parse(config);
  }

  // ─── Customers ──────────────────────────────────────────────────

  async createCustomer(params: {
    email: string;
    name: string;
    officeId: string;
  }): Promise<StripeCustomer> {
    return this.request<StripeCustomer>('/v1/customers', {
      method: 'POST',
      body: this.encodeFormData({
        email: params.email,
        name: params.name,
        'metadata[office_id]': params.officeId,
        'metadata[platform]': 'realflow',
      }),
    });
  }

  async getCustomer(customerId: string): Promise<StripeCustomer> {
    return this.request<StripeCustomer>(`/v1/customers/${customerId}`);
  }

  // ─── Checkout Sessions ──────────────────────────────────────────

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    quantity: number;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
    officeId: string;
    planId: SubscriptionPlanId;
  }): Promise<StripeCheckoutSession> {
    const formData: Record<string, string> = {
      'customer': params.customerId,
      'mode': 'subscription',
      'line_items[0][price]': params.priceId,
      'line_items[0][quantity]': String(params.quantity),
      'success_url': params.successUrl,
      'cancel_url': params.cancelUrl,
      'subscription_data[metadata][office_id]': params.officeId,
      'subscription_data[metadata][plan_id]': params.planId,
      'automatic_tax[enabled]': 'true',
      'allow_promotion_codes': 'true',
    };

    if (params.trialDays) {
      formData['subscription_data[trial_period_days]'] = String(params.trialDays);
    }

    return this.request<StripeCheckoutSession>('/v1/checkout/sessions', {
      method: 'POST',
      body: this.encodeFormData(formData),
    });
  }

  // ─── Subscriptions ──────────────────────────────────────────────

  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return this.request<StripeSubscription>(`/v1/subscriptions/${subscriptionId}`);
  }

  async updateSubscription(
    subscriptionId: string,
    params: {
      priceId?: string;
      quantity?: number;
      cancelAtPeriodEnd?: boolean;
    },
  ): Promise<StripeSubscription> {
    const formData: Record<string, string> = {};

    if (params.priceId) {
      formData['items[0][price]'] = params.priceId;
    }
    if (params.quantity !== undefined) {
      formData['items[0][quantity]'] = String(params.quantity);
    }
    if (params.cancelAtPeriodEnd !== undefined) {
      formData['cancel_at_period_end'] = String(params.cancelAtPeriodEnd);
    }

    return this.request<StripeSubscription>(`/v1/subscriptions/${subscriptionId}`, {
      method: 'POST',
      body: this.encodeFormData(formData),
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return this.request<StripeSubscription>(`/v1/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  // ─── Billing Portal ────────────────────────────────────────────

  async createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<StripeBillingPortalSession> {
    return this.request<StripeBillingPortalSession>('/v1/billing_portal/sessions', {
      method: 'POST',
      body: this.encodeFormData({
        customer: params.customerId,
        return_url: params.returnUrl,
      }),
    });
  }

  // ─── Invoices ───────────────────────────────────────────────────

  async getInvoice(invoiceId: string): Promise<StripeInvoice> {
    return this.request<StripeInvoice>(`/v1/invoices/${invoiceId}`);
  }

  async listInvoices(customerId: string, limit = 10): Promise<{ data: StripeInvoice[] }> {
    return this.request<{ data: StripeInvoice[] }>(
      `/v1/invoices?customer=${customerId}&limit=${limit}`,
    );
  }

  // ─── Webhook Verification ──────────────────────────────────────

  async constructWebhookEvent(
    payload: string,
    signature: string,
  ): Promise<StripeWebhookEvent> {
    // Verify webhook signature using HMAC-SHA256
    const crypto = await import('node:crypto');
    const elements = signature.split(',');
    const timestampStr = elements.find(e => e.startsWith('t='))?.substring(2);
    const signatureStr = elements.find(e => e.startsWith('v1='))?.substring(3);

    if (!timestampStr || !signatureStr) {
      throw new StripeWebhookError('Invalid signature format');
    }

    const timestamp = parseInt(timestampStr, 10);
    const tolerance = 300; // 5 minutes
    const now = Math.floor(Date.now() / 1000);

    if (now - timestamp > tolerance) {
      throw new StripeWebhookError('Webhook timestamp too old');
    }

    const signedPayload = `${timestampStr}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(signatureStr, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    )) {
      throw new StripeWebhookError('Webhook signature verification failed');
    }

    return JSON.parse(payload) as StripeWebhookEvent;
  }

  // ─── Private Methods ────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: { method?: string; body?: string } = {},
  ): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-12-18.acacia',
      },
      body: options.body,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const message = (error as { error?: { message?: string } }).error?.message ?? response.statusText;
      throw new StripeAPIError(message, response.status);
    }

    return response.json() as Promise<T>;
  }

  private encodeFormData(data: Record<string, string>): string {
    return Object.entries(data)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }
}

// ─── Errors ─────────────────────────────────────────────────────────

export class StripeAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(`Stripe API error (${statusCode}): ${message}`);
    this.name = 'StripeAPIError';
  }
}

export class StripeWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeWebhookError';
  }
}
