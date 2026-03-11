import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mocks via vi.hoisted ──────────────────────────────────────────────
// Rule: vi.mock factory CANNOT reference top-level const vars — use vi.hoisted()

const hoisted = vi.hoisted(() => {
  // Engine method mocks — these are shared across all tests and reset in beforeEach
  const acknowledgeBrief = vi.fn().mockResolvedValue(undefined);
  const getSentMatches = vi.fn().mockResolvedValue([]);
  const recordMatchFeedback = vi.fn().mockResolvedValue(undefined);
  const recordInspectionFeedback = vi.fn().mockResolvedValue(undefined);
  const getPortalClient = vi.fn();

  // Supabase mocks
  const from = vi.fn();
  const getUser = vi.fn();

  return {
    acknowledgeBrief,
    getSentMatches,
    recordMatchFeedback,
    recordInspectionFeedback,
    getPortalClient,
    from,
    getUser,
  };
});

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => ({
    from: hoisted.from,
    auth: { getUser: hoisted.getUser },
  }),
}));

vi.mock('@realflow/business-logic', () => {
  // Must use function keyword so vitest can call it with `new`
  function PortalEngine() {
    return {
      getPortalClient: hoisted.getPortalClient,
      acknowledgeBrief: hoisted.acknowledgeBrief,
      getSentMatches: hoisted.getSentMatches,
      recordMatchFeedback: hoisted.recordMatchFeedback,
      recordInspectionFeedback: hoisted.recordInspectionFeedback,
    };
  }
  return { PortalEngine };
});

// ─── Import after mocks ────────────────────────────────────────────────────────

import Fastify from 'fastify';
import { portalRoutes } from './portal';

// ─── UUIDs ────────────────────────────────────────────────────────────────────

const BRIEF_ID = '00000000-0000-4000-a000-000000000005';
const MATCH_ID = '00000000-0000-4000-a000-000000000006';
const INSPECTION_ID = '00000000-0000-4000-a000-000000000007';

const NOW = new Date().toISOString();

// ─── Test setup ───────────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(portalRoutes, { prefix: '/api/v1/portal' });
  return app;
}

function resetAuthUser(id = 'auth-user-1') {
  hoisted.getUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  });
}

function setUnauthenticated() {
  hoisted.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthUser();
  // Reset engine method defaults after clearAllMocks
  hoisted.acknowledgeBrief.mockResolvedValue(undefined);
  hoisted.getSentMatches.mockResolvedValue([]);
  hoisted.recordMatchFeedback.mockResolvedValue(undefined);
  hoisted.recordInspectionFeedback.mockResolvedValue(undefined);
});

// ─── Chain builder for Supabase mocks ─────────────────────────────────────────

function makeChain(data: unknown, error: unknown = null): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.update = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

// ─── GET /me ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/portal/me', () => {
  it('returns portal client with joined contact and agent', async () => {
    const portalClient = {
      id: 'pc-1',
      auth_id: 'auth-user-1',
      contact_id: 'contact-1',
      agent_id: 'agent-1',
      is_active: true,
      contact: {
        id: 'contact-1',
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah@test.com',
        phone: '0400000000',
      },
      agent: { id: 'agent-1', full_name: 'Alex Morgan', email: 'alex@test.com' },
    };

    hoisted.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/me' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.contact.first_name).toBe('Sarah');
    expect(body.data.agent.full_name).toBe('Alex Morgan');
  });

  it('returns 401 when not authenticated', async () => {
    setUnauthenticated();

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/me' });

    expect(response.statusCode).toBe(401);
  });

  it('returns 404 when portal client not found', async () => {
    // The portal route checks error.code === 'PGRST116' (Supabase "no rows" code) to return 404.
    hoisted.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/me' });

    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /transaction ─────────────────────────────────────────────────────────

describe('GET /api/v1/portal/transaction', () => {
  it('returns the active transaction', async () => {
    const portalClient = { contact_id: 'contact-1' };
    const transaction = {
      id: 'tx-1',
      contact_id: 'contact-1',
      current_stage: 'active-search',
    };

    let callCount = 0;
    hoisted.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
              }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/transaction' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.current_stage).toBe('active-search');
  });

  it('returns 401 when not authenticated', async () => {
    setUnauthenticated();

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/transaction' });

    expect(response.statusCode).toBe(401);
  });
});

// ─── GET /agent ───────────────────────────────────────────────────────────────

describe('GET /api/v1/portal/agent', () => {
  it('returns the assigned agent', async () => {
    const portalClient = { agent_id: 'agent-1' };
    const agent = {
      id: 'agent-1',
      full_name: 'Alex Morgan',
      email: 'alex@test.com',
      phone: '0400111222',
      avatar_url: null,
    };

    let callCount = 0;
    hoisted.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: agent, error: null }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/agent' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.full_name).toBe('Alex Morgan');
  });

  it('returns 401 when not authenticated', async () => {
    setUnauthenticated();

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/agent' });

    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /brief/acknowledge ──────────────────────────────────────────────────

describe('POST /api/v1/portal/brief/acknowledge', () => {
  it('acknowledges a brief and returns 200', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/portal/brief/acknowledge',
      payload: {
        clientBriefId: BRIEF_ID,
        acknowledgedAt: NOW,
        ipAddress: '203.0.113.1',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { acknowledged: boolean } };
    expect(body.data.acknowledged).toBe(true);
    expect(hoisted.acknowledgeBrief).toHaveBeenCalledWith(BRIEF_ID, 'auth-user-1', '203.0.113.1');
  });

  it('returns 401 when not authenticated', async () => {
    setUnauthenticated();

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/portal/brief/acknowledge',
      payload: { clientBriefId: BRIEF_ID, acknowledgedAt: NOW },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 400 when clientBriefId is not a valid UUID', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/portal/brief/acknowledge',
      payload: { clientBriefId: 'not-a-uuid', acknowledgedAt: NOW },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when engine throws a not-found error', async () => {
    hoisted.acknowledgeBrief.mockRejectedValue(new Error('Brief not found: some-id'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/portal/brief/acknowledge',
      payload: { clientBriefId: BRIEF_ID, acknowledgedAt: NOW },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /properties ──────────────────────────────────────────────────────────

describe('GET /api/v1/portal/properties', () => {
  it('returns sent matches for a brief', async () => {
    const matches = [
      {
        id: MATCH_ID,
        propertyId: '11b2c3d4-e5f6-7890-abcd-ef1234567897',
        clientBriefId: BRIEF_ID,
        clientId: '00000000-0000-4000-a000-000000000003',
        overallScore: 85,
        scoreBreakdown: { priceMatch: 85, locationMatch: 85, sizeMatch: 85, featureMatch: 85 },
        status: 'sent_to_client',
        matchedAt: NOW,
        updatedAt: NOW,
      },
    ];
    hoisted.getSentMatches.mockResolvedValue(matches);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/portal/properties?briefId=${BRIEF_ID}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    setUnauthenticated();

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/portal/properties?briefId=${BRIEF_ID}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 400 when briefId query param is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/properties',
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /properties/:id/feedback ───────────────────────────────────────────

describe('POST /api/v1/portal/properties/:id/feedback', () => {
  it('records "interested" feedback and returns 200', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/properties/${MATCH_ID}/feedback`,
      payload: { feedback: 'interested' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { recorded: boolean } };
    expect(body.data.recorded).toBe(true);
    expect(hoisted.recordMatchFeedback).toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    setUnauthenticated();

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/properties/${MATCH_ID}/feedback`,
      payload: { feedback: 'interested' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 400 for invalid feedback value', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/properties/${MATCH_ID}/feedback`,
      payload: { feedback: 'maybe' }, // invalid enum value
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when engine throws a not-found error', async () => {
    hoisted.recordMatchFeedback.mockRejectedValue(new Error('Property match not found: some-id'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/properties/${MATCH_ID}/feedback`,
      payload: { feedback: 'not_interested' },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /inspections ─────────────────────────────────────────────────────────

describe('GET /api/v1/portal/inspections', () => {
  it('returns a list of inspections for the portal client', async () => {
    const inspections = [
      {
        id: INSPECTION_ID,
        inspection_date: NOW,
        overall_impression: 'positive',
        client_rating: null,
        client_feedback: null,
        client_feedback_at: null,
        agent_notes: null,
        property: { id: '21b2c3d4-e5f6-7890-abcd-ef1234567898', address: {} },
      },
    ];

    hoisted.from.mockImplementation((table: string) => {
      if (table === 'portal_clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { contact_id: '00000000-0000-4000-a000-000000000003' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      // inspections table — list query uses .then
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn(self);
      chain.eq = vi.fn(self);
      chain.order = vi.fn(self);
      chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
        Promise.resolve({ data: inspections, error: null }).then(resolve);
      return chain;
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/inspections' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    setUnauthenticated();

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/inspections' });

    expect(response.statusCode).toBe(401);
  });

  it('returns 404 when portal client is not found', async () => {
    hoisted.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/inspections' });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST /inspections/:id/feedback ──────────────────────────────────────────

describe('POST /api/v1/portal/inspections/:id/feedback', () => {
  it('records inspection feedback and returns 200', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/inspections/${INSPECTION_ID}/feedback`,
      payload: { rating: 4, feedback: 'Great property, loved the kitchen' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { recorded: boolean } };
    expect(body.data.recorded).toBe(true);
    expect(hoisted.recordInspectionFeedback).toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    setUnauthenticated();

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/inspections/${INSPECTION_ID}/feedback`,
      payload: { rating: 4 },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 400 for invalid rating above max', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/inspections/${INSPECTION_ID}/feedback`,
      payload: { rating: 10 }, // invalid — max is 5
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for rating below min', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/inspections/${INSPECTION_ID}/feedback`,
      payload: { rating: 0 }, // invalid — min is 1
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when engine throws a not-found error', async () => {
    hoisted.recordInspectionFeedback.mockRejectedValue(new Error('Inspection not found: some-id'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/inspections/${INSPECTION_ID}/feedback`,
      payload: { rating: 3 },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 403 when engine throws a Forbidden error', async () => {
    hoisted.recordInspectionFeedback.mockRejectedValue(new Error('Forbidden: inspection does not belong to this portal client'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/inspections/${INSPECTION_ID}/feedback`,
      payload: { rating: 3 },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 500 on generic engine error', async () => {
    hoisted.recordInspectionFeedback.mockRejectedValue(new Error('DB connection lost'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/inspections/${INSPECTION_ID}/feedback`,
      payload: { rating: 3 },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /me - additional branches ────────────────────────────────────────────

describe('GET /api/v1/portal/me - additional branches', () => {
  it('returns 500 on non-PGRST116 database error', async () => {
    hoisted.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'OTHER_ERROR', message: 'Connection failed' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/me' });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /transaction - additional branches ────────────────────────────────────

describe('GET /api/v1/portal/transaction - additional branches', () => {
  it('returns 404 when portal client not found', async () => {
    hoisted.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/transaction' });

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when no active transaction (PGRST116)', async () => {
    const portalClient = { contact_id: '00000000-0000-4000-a000-000000000003' };

    let callCount = 0;
    hoisted.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'No rows' },
                }),
              }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/transaction' });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('No active transaction found');
  });

  it('returns 500 on non-PGRST116 transaction fetch error', async () => {
    const portalClient = { contact_id: '00000000-0000-4000-a000-000000000003' };

    let callCount = 0;
    hoisted.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'OTHER_ERROR', message: 'DB failure' },
                }),
              }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/transaction' });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /agent - additional branches ─────────────────────────────────────────

describe('GET /api/v1/portal/agent - additional branches', () => {
  it('returns 404 when portal client not found', async () => {
    hoisted.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/agent' });

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when agent not found (PGRST116)', async () => {
    const portalClient = { agent_id: '00000000-0000-4000-a000-000000000009' };

    let callCount = 0;
    hoisted.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows' },
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/agent' });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Agent not found');
  });

  it('returns 500 on non-PGRST116 agent fetch error', async () => {
    const portalClient = { agent_id: '00000000-0000-4000-a000-000000000009' };

    let callCount = 0;
    hoisted.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'OTHER_ERROR', message: 'DB error' },
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/agent' });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /brief/acknowledge - additional branches ────────────────────────────

describe('POST /api/v1/portal/brief/acknowledge - additional branches', () => {
  it('returns 403 when engine throws a Forbidden error', async () => {
    hoisted.acknowledgeBrief.mockRejectedValue(
      new Error('Forbidden: brief does not belong to this portal client'),
    );

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/portal/brief/acknowledge',
      payload: { clientBriefId: BRIEF_ID, acknowledgedAt: NOW },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 500 on generic engine error', async () => {
    hoisted.acknowledgeBrief.mockRejectedValue(new Error('DB connection lost'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/portal/brief/acknowledge',
      payload: { clientBriefId: BRIEF_ID, acknowledgedAt: NOW },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /properties - error branches ─────────────────────────────────────────

describe('GET /api/v1/portal/properties - error branches', () => {
  it('returns 500 when getSentMatches engine throws', async () => {
    hoisted.getSentMatches.mockRejectedValue(new Error('DB failure'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/portal/properties?briefId=${BRIEF_ID}`,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /properties/:id/feedback - additional branches ──────────────────────

describe('POST /api/v1/portal/properties/:id/feedback - additional branches', () => {
  it('returns 403 when engine throws a Forbidden error', async () => {
    hoisted.recordMatchFeedback.mockRejectedValue(
      new Error('Forbidden: match does not belong to this portal client'),
    );

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/properties/${MATCH_ID}/feedback`,
      payload: { feedback: 'interested' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 500 on generic engine error', async () => {
    hoisted.recordMatchFeedback.mockRejectedValue(new Error('DB connection lost'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/portal/properties/${MATCH_ID}/feedback`,
      payload: { feedback: 'interested' },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /inspections - additional branches ───────────────────────────────────

describe('GET /api/v1/portal/inspections - additional branches', () => {
  it('returns 500 on inspections DB error', async () => {
    hoisted.from.mockImplementation((table: string) => {
      if (table === 'portal_clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { contact_id: '00000000-0000-4000-a000-000000000003' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      // inspections table — return DB error
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn(self);
      chain.eq = vi.fn(self);
      chain.order = vi.fn(self);
      chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
        Promise.resolve({ data: null, error: { message: 'DB error' } }).then(resolve);
      return chain;
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/portal/inspections' });

    expect(response.statusCode).toBe(500);
  });
});
