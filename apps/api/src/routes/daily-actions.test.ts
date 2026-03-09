import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockSupabase = {
  from: mockFrom,
  auth: { getUser: mockGetUser },
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock business-logic ──────────────────────────────────────────

const mockGenerateDailyActions = vi.fn();

vi.mock('@realflow/business-logic', () => ({
  generateDailyActions: (opts: unknown) => mockGenerateDailyActions(opts),
}));

// ─── Mock notification dispatcher ────────────────────────────────

const mockCreateAndDispatch = vi.fn();

vi.mock('../services/notification-dispatcher', () => ({
  getNotificationDispatcher: () => ({
    createAndDispatch: mockCreateAndDispatch,
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { dailyActionRoutes } from './daily-actions';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

async function buildApp() {
  const app = Fastify();
  await app.register(dailyActionRoutes, { prefix: '/api/v1/daily-actions' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: MOCK_USER_ID } },
    error: null,
  });
  mockCreateAndDispatch.mockResolvedValue(undefined);
});

// ─── GET / - List daily actions ───────────────────────────────────

describe('GET /api/v1/daily-actions', () => {
  it('returns cached daily action list', async () => {
    const cachedItems = [
      { id: '00000000-0000-0000-0000-000000000010', composite_score: 90, is_completed: false, rank: 1 },
      { id: '00000000-0000-0000-0000-000000000011', composite_score: 60, is_completed: false, rank: 2 },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: cachedItems, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/daily-actions',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
    expect(body.meta.cached).toBe(true);
    expect(body.meta.urgentCount).toBe(1);
  });

  it('generates fresh list when no cached items', async () => {
    const freshItems = [
      { id: '00000000-0000-0000-0000-000000000010', composite_score: 85, is_completed: false, rank: 1 },
    ];

    const generatedResult = {
      items: [{ compositeScore: 85 }],
      totalCandidates: 1,
      generatedAt: new Date().toISOString(),
    };

    mockGenerateDailyActions.mockResolvedValue(generatedResult);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      // First call: check for existing cached items (returns empty)
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      // Second call: fetch fresh persisted rows
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: freshItems, error: null }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/daily-actions',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
    expect(body.meta.cached).toBe(false);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/daily-actions',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/daily-actions',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /:id/complete ───────────────────────────────────────────

describe('POST /api/v1/daily-actions/:id/complete', () => {
  const itemId = '00000000-0000-0000-0000-000000000010';

  it('marks an action item as completed', async () => {
    const completed = { id: itemId, is_completed: true };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: completed, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/daily-actions/${itemId}/complete`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.is_completed).toBe(true);
  });

  it('returns 404 when item not found', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/daily-actions/${itemId}/complete`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST /regenerate ─────────────────────────────────────────────

describe('POST /api/v1/daily-actions/regenerate', () => {
  it('regenerates the daily action list', async () => {
    const generatedResult = {
      items: [{ compositeScore: 85 }, { compositeScore: 60 }],
      generatedAt: new Date().toISOString(),
    };

    mockGenerateDailyActions.mockResolvedValue(generatedResult);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/daily-actions/regenerate',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.itemCount).toBe(2);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/daily-actions/regenerate',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 when generation fails', async () => {
    mockGenerateDailyActions.mockRejectedValue(new Error('Generation failed'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/daily-actions/regenerate',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});
