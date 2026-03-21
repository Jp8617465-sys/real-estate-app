import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { offMarketRoutes } from './off-market';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OFFICE_ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const PROPERTY_ID = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';
const BRIEF_ID = 'd1b2c3d4-e5f6-7890-abcd-ef1234567893';
const MATCH_ID = 'e1b2c3d4-e5f6-7890-abcd-ef1234567894';

const NOW = new Date().toISOString();

// ─── Engine mock ──────────────────────────────────────────────────────────────

const mockEngine = {
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  getMatches: vi.fn(),
  matchAgainstBriefs: vi.fn(),
  sendToClient: vi.fn(),
  retractFromClient: vi.fn(),
  getSuccessStats: vi.fn(),
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock('@realflow/business-logic', () => {
  function OffMarketEngine() {
    return mockEngine;
  }
  return { OffMarketEngine };
});

import { createSupabaseClient } from '../middleware/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChainFor(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

function makeSupabase(
  user: { id: string } | null = { id: AGENT_ID },
  officeRow: { office_id: string } | null = { office_id: OFFICE_ID },
) {
  return {
    from: vi.fn(() => makeChainFor(officeRow)),
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

function makeProperty(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: PROPERTY_ID,
    agentId: AGENT_ID,
    officeId: OFFICE_ID,
    addressLine1: '42 Test St',
    suburb: 'Paddington',
    state: 'NSW',
    postcode: '2021',
    propertyType: 'house',
    bedrooms: 3,
    bathrooms: 2,
    carSpaces: 1,
    landSizeSqm: 250,
    askingPrice: 1800000,
    source: 'vendor_direct',
    sourceName: null,
    agentNotes: null,
    visibility: 'agent_only',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function makeMatch(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: MATCH_ID,
    offMarketId: PROPERTY_ID,
    clientBriefId: BRIEF_ID,
    matchScore: 75,
    status: 'new',
    sentToClientAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

const VALID_PAYLOAD = {
  addressLine1: '42 Test St',
  suburb: 'Paddington',
  state: 'NSW',
  postcode: '2021',
  propertyType: 'house',
  bedrooms: 3,
  source: 'vendor_direct',
};

async function buildApp() {
  const app = Fastify();
  await app.register(offMarketRoutes);
  return app;
}

// ─── GET /off-market ──────────────────────────────────────────────────────────

describe('GET /off-market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.list.mockResolvedValue([makeProperty()]);
  });

  it('returns 200 with properties list', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/off-market' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(PROPERTY_ID);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/off-market' });

    expect(res.statusCode).toBe(401);
  });
});

// ─── POST /off-market ─────────────────────────────────────────────────────────

describe('POST /off-market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.create.mockResolvedValue({ property: makeProperty(), matches: [] });
  });

  it('returns 201 with created property', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/off-market',
      payload: VALID_PAYLOAD,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.property.id).toBe(PROPERTY_ID);
  });

  it('returns 400 for missing required fields', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/off-market',
      payload: { suburb: 'Paddington' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid postcode', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/off-market',
      payload: { ...VALID_PAYLOAD, postcode: 'ABCD' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/off-market', payload: VALID_PAYLOAD });

    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /off-market/:id ──────────────────────────────────────────────────────

describe('GET /off-market/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getById.mockResolvedValue(makeProperty());
  });

  it('returns 200 for own property', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.id).toBe(PROPERTY_ID);
  });

  it("returns 403 for another agent's property", async () => {
    mockEngine.getById.mockResolvedValue(
      makeProperty({ agentId: 'ffffffff-e5f6-7890-abcd-ef1234567890' }),
    );
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(403);
  });
});

// ─── PATCH /off-market/:id ────────────────────────────────────────────────────

describe('PATCH /off-market/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.update.mockResolvedValue(makeProperty({ status: 'under_offer' }));
  });

  it('returns 200 with updated property', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/off-market/${PROPERTY_ID}`,
      payload: { status: 'under_offer' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('under_offer');
  });
});

// ─── DELETE /off-market/:id ───────────────────────────────────────────────────

describe('DELETE /off-market/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.softDelete.mockResolvedValue(undefined);
  });

  it('returns 204 on success', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(204);
  });
});

// ─── GET /off-market/:id/matches ─────────────────────────────────────────────

describe('GET /off-market/:id/matches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getMatches.mockResolvedValue([makeMatch()]);
  });

  it('returns 200 with matches list', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}/matches` });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].matchScore).toBe(75);
  });
});

// ─── POST /off-market/:id/send-to-client ─────────────────────────────────────

describe('POST /off-market/:id/send-to-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.sendToClient.mockResolvedValue(
      makeMatch({ status: 'sent_to_client', sentToClientAt: NOW }),
    );
  });

  it('returns 200 with updated match', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/off-market/${PROPERTY_ID}/send-to-client`,
      payload: { clientBriefId: BRIEF_ID },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('sent_to_client');
  });

  it('returns 400 when clientBriefId missing', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/off-market/${PROPERTY_ID}/send-to-client`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /off-market/stats ────────────────────────────────────────────────────

describe('GET /off-market/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getSuccessStats.mockResolvedValue({
      totalOffMarket: 5,
      totalOnMarket: 20,
      offMarketClosed: 3,
      onMarketClosed: 8,
      offMarketSuccessRate: 60,
      onMarketSuccessRate: 40,
    });
  });

  it('returns 200 with stats', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/off-market/stats' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.offMarketSuccessRate).toBe(60);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/off-market/stats' });

    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on engine error', async () => {
    mockEngine.getSuccessStats.mockRejectedValue(new Error('DB failure'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/off-market/stats' });

    expect(res.statusCode).toBe(500);
  });
});

// ─── GET /off-market with pagination params ────────────────────────────────────

describe('GET /off-market with pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.list.mockResolvedValue([makeProperty()]);
  });

  it('passes parsed limit and offset to engine', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/off-market?limit=10&offset=20' });

    expect(res.statusCode).toBe(200);
    expect(mockEngine.list).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });

  it('passes status filter to engine', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/off-market?status=active' });

    expect(res.statusCode).toBe(200);
    expect(mockEngine.list).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('returns 500 on engine error', async () => {
    mockEngine.list.mockRejectedValue(new Error('Engine failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/off-market' });

    expect(res.statusCode).toBe(500);
  });
});

// ─── POST /off-market - error branches ────────────────────────────────────────

describe('POST /off-market - error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when agent office not found', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase({ id: AGENT_ID }, null) as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/off-market',
      payload: VALID_PAYLOAD,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('office');
  });

  it('returns 500 on engine create error', async () => {
    mockEngine.create.mockRejectedValue(new Error('Insert failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/off-market',
      payload: VALID_PAYLOAD,
    });

    expect(res.statusCode).toBe(500);
  });
});

// ─── GET /off-market/:id - missing/error branches ─────────────────────────────

describe('GET /off-market/:id - error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when property not found (returns null)', async () => {
    mockEngine.getById.mockResolvedValue(null);
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when engine throws PGRST116 error', async () => {
    mockEngine.getById.mockRejectedValue(new Error('PGRST116: not found'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(404);
  });

  it('returns 500 on generic engine error', async () => {
    mockEngine.getById.mockRejectedValue(new Error('Unexpected DB failure'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(500);
  });
});

// ─── PATCH /off-market/:id - error branches ───────────────────────────────────

describe('PATCH /off-market/:id - error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/off-market/${PROPERTY_ID}`,
      payload: { status: 'under_offer' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/off-market/${PROPERTY_ID}`,
      payload: { status: 'invalid_status_value' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 500 on engine update error', async () => {
    mockEngine.update.mockRejectedValue(new Error('Update failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/off-market/${PROPERTY_ID}`,
      payload: { status: 'under_offer' },
    });

    expect(res.statusCode).toBe(500);
  });
});

// ─── DELETE /off-market/:id - error branches ──────────────────────────────────

describe('DELETE /off-market/:id - error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on engine softDelete error', async () => {
    mockEngine.softDelete.mockRejectedValue(new Error('Delete failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/off-market/${PROPERTY_ID}` });

    expect(res.statusCode).toBe(500);
  });
});

// ─── GET /off-market/:id/matches - error branches ─────────────────────────────

describe('GET /off-market/:id/matches - error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}/matches` });

    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on engine getMatches error', async () => {
    mockEngine.getMatches.mockRejectedValue(new Error('Fetch matches failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/off-market/${PROPERTY_ID}/matches` });

    expect(res.statusCode).toBe(500);
  });
});

// ─── POST /off-market/:id/matches ─────────────────────────────────────────────

describe('POST /off-market/:id/matches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.matchAgainstBriefs.mockResolvedValue([makeMatch()]);
  });

  it('returns 200 with fresh match results', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/off-market/${PROPERTY_ID}/matches` });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/off-market/${PROPERTY_ID}/matches` });

    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on engine error', async () => {
    mockEngine.matchAgainstBriefs.mockRejectedValue(new Error('Match failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/off-market/${PROPERTY_ID}/matches` });

    expect(res.statusCode).toBe(500);
  });
});

// ─── DELETE /off-market/:id/send-to-client ────────────────────────────────────

describe('DELETE /off-market/:id/send-to-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.retractFromClient.mockResolvedValue(
      makeMatch({ status: 'new', sentToClientAt: null }),
    );
  });

  it('returns 200 with retracted match', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/off-market/${PROPERTY_ID}/send-to-client`,
      payload: { clientBriefId: BRIEF_ID },
    });

    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when clientBriefId missing on retract', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/off-market/${PROPERTY_ID}/send-to-client`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/off-market/${PROPERTY_ID}/send-to-client`,
      payload: { clientBriefId: BRIEF_ID },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on engine retractFromClient error', async () => {
    mockEngine.retractFromClient.mockRejectedValue(new Error('Retract failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/off-market/${PROPERTY_ID}/send-to-client`,
      payload: { clientBriefId: BRIEF_ID },
    });

    expect(res.statusCode).toBe(500);
  });
});
