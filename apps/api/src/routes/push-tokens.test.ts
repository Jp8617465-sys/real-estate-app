import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────
// Rule: vi.mock factory CANNOT reference top-level const vars — use vi.hoisted()

const hoisted = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();
  return { mockFrom, mockGetUser };
});

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => ({
    from: hoisted.mockFrom,
    auth: { getUser: hoisted.mockGetUser },
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { pushTokenRoutes } from './push-tokens';

// ─── Test setup ───────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';
const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(pushTokenRoutes, { prefix: '/api/v1/push-tokens' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated user
  hoisted.mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
});

// ─── POST / - Register push token ────────────────────────────────

describe('POST /api/v1/push-tokens', () => {
  // userId is no longer part of the schema — it is derived from the JWT via auth.getUser()
  const validBody = {
    token: 'ExponentPushToken[abc123xyz]',
    platform: 'ios',
    deviceId: 'device-001',
  };

  it('registers a push token successfully', async () => {
    const created = {
      id: '00000000-0000-0000-0000-000000000099',
      user_id: USER_ID,
      token: validBody.token,
      platform: 'ios',
      is_active: true,
    };

    hoisted.mockFrom.mockReturnValue({
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
        // missing token
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/push-tokens',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on database error', async () => {
    hoisted.mockFrom.mockReturnValue({
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
    hoisted.mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
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

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/push-tokens/some-token',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on database error', async () => {
    hoisted.mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
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
