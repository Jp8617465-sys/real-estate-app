import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock Stripe ───────────────────────────────────────────────────

const mockStripeClient = {
  createCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
  updateSubscription: vi.fn(),
  createBillingPortalSession: vi.fn(),
};

vi.mock('../services/stripe-service', () => ({
  getStripeClient: () => mockStripeClient,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { subscriptionRoutes } from './subscriptions';

async function buildApp() {
  const app = Fastify();
  await app.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/subscriptions/plans', () => {
  it('returns subscription plans', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/subscriptions/plans' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBe(4);
    expect(body.data[0].id).toBe('starter');
    expect(body.data[0].priceMonthlyAud).toBe(49);
  });
});

describe('GET /api/v1/subscriptions/current', () => {
  it('returns current subscription', async () => {
    const app = await buildApp();

    // Mock user lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { office_id: 'office-1' }, error: null }),
        }),
      }),
    });

    // Mock subscription lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'sub-1', plan_id: 'starter', status: 'active', seat_count: 1 },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/subscriptions/current',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.plan_id).toBe('starter');
  });

  it('returns 404 when no subscription exists', async () => {
    const app = await buildApp();

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { office_id: 'office-1' }, error: null }),
        }),
      }),
    });

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      }),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/subscriptions/current',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/v1/subscriptions/checkout', () => {
  it('rejects invalid plan', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/subscriptions/checkout',
      payload: {
        planId: 'nonexistent',
        billingInterval: 'monthly',
        seatCount: 1,
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects enterprise plan for self-service', async () => {
    const app = await buildApp();

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-1', email: 'test@test.com', office_id: 'office-1', first_name: 'Test', last_name: 'User' },
            error: null,
          }),
        }),
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/subscriptions/checkout',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        planId: 'enterprise',
        billingInterval: 'monthly',
        seatCount: 1,
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('Enterprise');
  });
});

describe('GET /api/v1/subscriptions/payments', () => {
  it('returns payment history', async () => {
    const app = await buildApp();

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { office_id: 'office-1' }, error: null }),
        }),
      }),
    });

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: 'pay-1', amount_aud: 49, status: 'succeeded' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/subscriptions/payments',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].amount_aud).toBe(49);
  });
});
