import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { alertsRoutes } from './alerts';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BRIEF_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const MATCH_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const SUB_ID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const EVENT_ID = 'e5f6a7b8-c9d0-1234-efab-345678901234';

const NOW = new Date().toISOString();

// ─── Shared mutable engine mock state ─────────────────────────────────────────
// MUST be declared before vi.mock() factories so they can reference this object.
// Following the compliance.test.ts pattern: use hoisted mutable state.

const mockEngine = {
  getSubscriptions: vi.fn().mockResolvedValue([]),
  createSubscription: vi.fn().mockResolvedValue(null),
  updateSubscription: vi.fn().mockResolvedValue(null),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
  sendMatchToClient: vi.fn().mockResolvedValue(undefined),
  getAlertEvents: vi.fn().mockResolvedValue([]),
  isQuietHours: vi.fn().mockReturnValue(false),
};

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: vi.fn(),
}));

// Mock the entire business-logic module. PropertyAlertEngine constructor always
// returns the mutable mockEngine object so tests can override individual methods.
vi.mock('@realflow/business-logic', () => {
  // Use a regular function so `new PropertyAlertEngine()` works correctly.
  function PropertyAlertEngine() {
    return mockEngine;
  }
  return { PropertyAlertEngine };
});

import { createSupabaseClient } from '../middleware/supabase';

// ─── Supabase mock helpers ─────────────────────────────────────────────────────

function makeChainFor(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.not = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

function makeSupabase(
  user: { id: string } | null = { id: AGENT_ID },
  tableData: Record<string, { single?: unknown; list?: unknown; error?: unknown }> = {},
) {
  return {
    from: vi.fn((table: string) => {
      const entry = tableData[table] ?? { list: [], error: null };
      return makeChainFor(entry.single ?? entry.list ?? null, entry.error ?? null);
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user },
          error: user ? null : { message: 'Not authenticated' },
        }),
      ),
    },
  };
}

// ─── GET /api/v1/alerts/subscriptions ────────────────────────────────────────

describe('GET /api/v1/alerts/subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default engine method implementations after clearAllMocks
    mockEngine.getSubscriptions.mockResolvedValue([]);
    mockEngine.createSubscription.mockResolvedValue(null);
    mockEngine.updateSubscription.mockResolvedValue(null);
    mockEngine.deleteSubscription.mockResolvedValue(undefined);
    mockEngine.sendMatchToClient.mockResolvedValue(undefined);
    mockEngine.getAlertEvents.mockResolvedValue([]);
  });

  it('returns list of subscriptions with 200', async () => {
    const subData = [
      {
        id: SUB_ID,
        agentId: AGENT_ID,
        briefId: BRIEF_ID,
        scoreThreshold: 70,
        channels: ['push'],
        digestMode: false,
        digestTime: '07:00',
        quietHoursStart: '21:00',
        quietHoursEnd: '07:00',
        isActive: true,
        deletedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    mockEngine.getSubscriptions.mockResolvedValue(subData);

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/v1/alerts/subscriptions' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('returns 401 when user is not authenticated', async () => {
    const supabase = makeSupabase(null);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/v1/alerts/subscriptions' });
    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /api/v1/alerts/subscriptions ───────────────────────────────────────

describe('POST /api/v1/alerts/subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getSubscriptions.mockResolvedValue([]);
    mockEngine.createSubscription.mockResolvedValue(null);
    mockEngine.updateSubscription.mockResolvedValue(null);
    mockEngine.deleteSubscription.mockResolvedValue(undefined);
    mockEngine.sendMatchToClient.mockResolvedValue(undefined);
    mockEngine.getAlertEvents.mockResolvedValue([]);
  });

  it('creates a subscription and returns 201', async () => {
    const createdSub = {
      id: SUB_ID,
      agentId: AGENT_ID,
      briefId: BRIEF_ID,
      scoreThreshold: 70,
      channels: ['push'],
      digestMode: false,
      digestTime: '07:00',
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
      isActive: true,
      deletedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };

    mockEngine.createSubscription.mockResolvedValue(createdSub);

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/subscriptions',
      payload: {
        briefId: BRIEF_ID,
        scoreThreshold: 70,
        channels: ['push'],
        digestMode: false,
        digestTime: '07:00',
        quietHoursStart: '21:00',
        quietHoursEnd: '07:00',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { data: { id: string } };
    expect(body.data.id).toBe(SUB_ID);
  });

  it('returns 400 on invalid body (briefId not a UUID)', async () => {
    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/subscriptions',
      payload: { briefId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 on scoreThreshold below 50', async () => {
    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/subscriptions',
      payload: {
        briefId: BRIEF_ID,
        scoreThreshold: 30,
        channels: ['push'],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const supabase = makeSupabase(null);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/subscriptions',
      payload: { briefId: BRIEF_ID },
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── PATCH /api/v1/alerts/subscriptions/:id ──────────────────────────────────

describe('PATCH /api/v1/alerts/subscriptions/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getSubscriptions.mockResolvedValue([]);
    mockEngine.createSubscription.mockResolvedValue(null);
    mockEngine.updateSubscription.mockResolvedValue(null);
    mockEngine.deleteSubscription.mockResolvedValue(undefined);
    mockEngine.sendMatchToClient.mockResolvedValue(undefined);
    mockEngine.getAlertEvents.mockResolvedValue([]);
  });

  it('updates a subscription and returns 200', async () => {
    const updatedSub = {
      id: SUB_ID,
      agentId: AGENT_ID,
      briefId: BRIEF_ID,
      scoreThreshold: 80,
      channels: ['push'],
      digestMode: false,
      digestTime: '07:00',
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
      isActive: true,
      deletedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };

    mockEngine.updateSubscription.mockResolvedValue(updatedSub);

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/alerts/subscriptions/${SUB_ID}`,
      payload: { scoreThreshold: 80 },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { scoreThreshold: number } };
    expect(body.data.scoreThreshold).toBe(80);
  });

  it('returns 404 when subscription not found', async () => {
    mockEngine.updateSubscription.mockRejectedValue(new Error('Subscription not found'));

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/alerts/subscriptions/${SUB_ID}`,
      payload: { scoreThreshold: 80 },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 403 when agent does not own subscription', async () => {
    mockEngine.updateSubscription.mockRejectedValue(
      new Error('Unauthorised: agent does not own this subscription'),
    );

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/alerts/subscriptions/${SUB_ID}`,
      payload: { scoreThreshold: 80 },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ─── DELETE /api/v1/alerts/subscriptions/:id ─────────────────────────────────

describe('DELETE /api/v1/alerts/subscriptions/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getSubscriptions.mockResolvedValue([]);
    mockEngine.createSubscription.mockResolvedValue(null);
    mockEngine.updateSubscription.mockResolvedValue(null);
    mockEngine.deleteSubscription.mockResolvedValue(undefined);
    mockEngine.sendMatchToClient.mockResolvedValue(undefined);
    mockEngine.getAlertEvents.mockResolvedValue([]);
  });

  it('soft-deletes subscription and returns 204', async () => {
    mockEngine.deleteSubscription.mockResolvedValue(undefined);

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/alerts/subscriptions/${SUB_ID}`,
    });

    expect(response.statusCode).toBe(204);
    expect(mockEngine.deleteSubscription).toHaveBeenCalledWith(SUB_ID, AGENT_ID);
  });

  it('returns 404 when subscription not found', async () => {
    mockEngine.deleteSubscription.mockRejectedValue(new Error('Subscription not found'));

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/alerts/subscriptions/${SUB_ID}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const supabase = makeSupabase(null);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/alerts/subscriptions/${SUB_ID}`,
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /api/v1/alerts/matches/:matchId/send-to-client ─────────────────────

describe('POST /api/v1/alerts/matches/:matchId/send-to-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getSubscriptions.mockResolvedValue([]);
    mockEngine.createSubscription.mockResolvedValue(null);
    mockEngine.updateSubscription.mockResolvedValue(null);
    mockEngine.deleteSubscription.mockResolvedValue(undefined);
    mockEngine.sendMatchToClient.mockResolvedValue(undefined);
    mockEngine.getAlertEvents.mockResolvedValue([]);
  });

  it('sends match to client and returns 200', async () => {
    mockEngine.sendMatchToClient.mockResolvedValue(undefined);

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/matches/${MATCH_ID}/send-to-client`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { matchId: string; status: string } };
    expect(body.data.matchId).toBe(MATCH_ID);
    expect(body.data.status).toBe('sent_to_client');
    expect(mockEngine.sendMatchToClient).toHaveBeenCalledWith(MATCH_ID, AGENT_ID);
  });

  it('returns 404 when match not found', async () => {
    mockEngine.sendMatchToClient.mockRejectedValue(new Error('Property match not found'));

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/matches/${MATCH_ID}/send-to-client`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 403 when agent does not own the match', async () => {
    mockEngine.sendMatchToClient.mockRejectedValue(
      new Error('Unauthorised: agent does not own this match'),
    );

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/matches/${MATCH_ID}/send-to-client`,
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const supabase = makeSupabase(null);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/matches/${MATCH_ID}/send-to-client`,
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── GET /api/v1/alerts/events ───────────────────────────────────────────────

describe('GET /api/v1/alerts/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getSubscriptions.mockResolvedValue([]);
    mockEngine.createSubscription.mockResolvedValue(null);
    mockEngine.updateSubscription.mockResolvedValue(null);
    mockEngine.deleteSubscription.mockResolvedValue(undefined);
    mockEngine.sendMatchToClient.mockResolvedValue(undefined);
    mockEngine.getAlertEvents.mockResolvedValue([]);
  });

  it('returns alert events for authenticated agent', async () => {
    const eventData = [
      {
        id: EVENT_ID,
        subscriptionId: SUB_ID,
        propertyMatchId: MATCH_ID,
        alertType: 'new_match',
        channelsAttempted: ['push'],
        channelsDelivered: ['push'],
        matchScore: 85,
        sentAt: NOW,
        actionedAt: null,
        action: null,
        snoozeUntil: null,
        createdAt: NOW,
      },
    ];

    mockEngine.getAlertEvents.mockResolvedValue(eventData);

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/v1/alerts/events' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    const supabase = makeSupabase(null);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/v1/alerts/events' });
    expect(response.statusCode).toBe(401);
  });

  it('passes limit query parameter to engine', async () => {
    mockEngine.getAlertEvents.mockResolvedValue([]);

    const supabase = makeSupabase({ id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(alertsRoutes, { prefix: '/api/v1' });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/v1/alerts/events?limit=20' });
    expect(response.statusCode).toBe(200);
    expect(mockEngine.getAlertEvents).toHaveBeenCalledWith(AGENT_ID, 20);
  });
});
