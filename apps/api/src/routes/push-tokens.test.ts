import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { pushTokenRoutes } from './push-tokens';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(pushTokenRoutes, { prefix: '/api/v1/push-tokens' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST / - Register push token ────────────────────────────────

describe('POST /api/v1/push-tokens', () => {
  const validBody = {
    token: 'ExponentPushToken[abc123xyz]',
    platform: 'ios',
    deviceId: 'device-001',
    userId: '00000000-0000-0000-0000-000000000001',
  };

  it('registers a push token successfully', async () => {
    const created = {
      id: '00000000-0000-0000-0000-000000000099',
      user_id: validBody.userId,
      token: validBody.token,
      platform: 'ios',
      is_active: true,
    };

    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: created, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/push-tokens',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data.is_active).toBe(true);
  });

  it('returns 400 for invalid platform value', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/push-tokens',
      headers: { authorization: BEARER },
      payload: {
        ...validBody,
        platform: 'windows', // invalid platform
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when token is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/push-tokens',
      headers: { authorization: BEARER },
      payload: {
        platform: 'ios',
        userId: '00000000-0000-0000-0000-000000000001',
        // missing token
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when userId is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/push-tokens',
      headers: { authorization: BEARER },
      payload: {
        token: 'ExponentPushToken[abc123xyz]',
        platform: 'android',
        // missing userId
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/push-tokens',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── DELETE /:token - Deregister push token ───────────────────────

describe('DELETE /api/v1/push-tokens/:token', () => {
  it('deregisters a push token successfully', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/push-tokens/ExponentPushToken%5Babc123xyz%5D',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/push-tokens/some-token',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});
