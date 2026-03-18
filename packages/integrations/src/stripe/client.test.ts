import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripeClient, StripeAPIError, StripeWebhookError } from './client';

// ─── Mock fetch ─────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  };
}

describe('StripeClient', () => {
  let client: StripeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new StripeClient({
      secretKey: 'sk_test_123',
      webhookSecret: 'whsec_test_456',
    });
  });

  describe('createCustomer', () => {
    it('creates a customer with correct params', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: { office_id: 'office-1' },
      }));

      const customer = await client.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
        officeId: 'office-1',
      });

      expect(customer.id).toBe('cus_123');
      expect(customer.email).toBe('test@example.com');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/customers',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws StripeAPIError on failure', async () => {
      mockFetch.mockResolvedValue(mockResponse(
        { error: { message: 'Invalid email' } },
        false,
        400,
      ));

      await expect(client.createCustomer({
        email: '',
        name: 'Test',
        officeId: 'office-1',
      })).rejects.toThrow(StripeAPIError);
    });
  });

  describe('createCheckoutSession', () => {
    it('creates a checkout session', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/session/cs_123',
        customer: 'cus_123',
        subscription: null,
      }));

      const session = await client.createCheckoutSession({
        customerId: 'cus_123',
        priceId: 'price_123',
        quantity: 1,
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
        trialDays: 14,
        officeId: 'office-1',
        planId: 'starter',
      });

      expect(session.id).toBe('cs_123');
      expect(session.url).toContain('checkout.stripe.com');
    });
  });

  describe('getSubscription', () => {
    it('retrieves a subscription', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: 1710000000,
        current_period_end: 1712678400,
        cancel_at_period_end: false,
        trial_end: null,
        items: { data: [{ id: 'si_1', price: { id: 'price_1', recurring: { interval: 'month' } }, quantity: 1 }] },
        metadata: { plan_id: 'starter' },
      }));

      const sub = await client.getSubscription('sub_123');
      expect(sub.status).toBe('active');
      expect(sub.cancel_at_period_end).toBe(false);
    });
  });

  describe('updateSubscription', () => {
    it('updates cancel_at_period_end', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: 'sub_123',
        cancel_at_period_end: true,
        status: 'active',
        current_period_start: 1710000000,
        current_period_end: 1712678400,
        trial_end: null,
        items: { data: [] },
        metadata: {},
        customer: 'cus_123',
      }));

      const sub = await client.updateSubscription('sub_123', { cancelAtPeriodEnd: true });
      expect(sub.cancel_at_period_end).toBe(true);
    });
  });

  describe('createBillingPortalSession', () => {
    it('creates a portal session', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: 'bps_123',
        url: 'https://billing.stripe.com/session/bps_123',
      }));

      const session = await client.createBillingPortalSession({
        customerId: 'cus_123',
        returnUrl: 'https://app.com/settings',
      });

      expect(session.url).toContain('billing.stripe.com');
    });
  });

  describe('constructWebhookEvent', () => {
    it('rejects invalid signature format', async () => {
      await expect(
        client.constructWebhookEvent('{}', 'invalid-signature'),
      ).rejects.toThrow(StripeWebhookError);
    });

    it('rejects expired timestamp', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      await expect(
        client.constructWebhookEvent('{}', `t=${oldTimestamp},v1=abc123`),
      ).rejects.toThrow('Webhook timestamp too old');
    });
  });

  describe('config validation', () => {
    it('rejects empty secret key', () => {
      expect(() => new StripeClient({ secretKey: '', webhookSecret: 'whsec_123' })).toThrow();
    });

    it('rejects empty webhook secret', () => {
      expect(() => new StripeClient({ secretKey: 'sk_test_123', webhookSecret: '' })).toThrow();
    });
  });
});
