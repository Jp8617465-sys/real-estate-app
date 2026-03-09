import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock business-logic ──────────────────────────────────────────

const mockScoreProperty = vi.fn();

vi.mock('@realflow/business-logic', () => ({
  PropertyMatchEngine: {
    scoreProperty: (property: unknown, brief: unknown) => mockScoreProperty(property, brief),
  },
  fromDbSchema: (data: unknown) => data,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { propertyMatchRoutes } from './property-matches';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(propertyMatchRoutes, { prefix: '/api/v1/property-matches' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List matches ─────────────────────────────────────────

describe('GET /api/v1/property-matches', () => {
  it('returns list of property matches', async () => {
    const matches = [
      { id: '00000000-0000-0000-0000-000000000001', overall_score: 90 },
      { id: '00000000-0000-0000-0000-000000000002', overall_score: 75 },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: matches, error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/property-matches',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('filters by clientBriefId', async () => {
    const clientBriefId = '00000000-0000-0000-0000-000000000010';
    const matches = [{ id: '00000000-0000-0000-0000-000000000001', client_brief_id: clientBriefId }];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: matches, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/property-matches?clientBriefId=${clientBriefId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/property-matches',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get single match ──────────────────────────────────

describe('GET /api/v1/property-matches/:id', () => {
  const matchId = '00000000-0000-0000-0000-000000000001';

  it('returns a single property match', async () => {
    const match = { id: matchId, overall_score: 85 };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: match, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/property-matches/${matchId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.id).toBe(matchId);
  });

  it('returns 404 when not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/property-matches/nonexistent',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create match ────────────────────────────────────────

describe('POST /api/v1/property-matches', () => {
  const validBody = {
    propertyId: '00000000-0000-0000-0000-000000000001',
    clientBriefId: '00000000-0000-0000-0000-000000000002',
    clientId: '00000000-0000-0000-0000-000000000003',
    overallScore: 85,
    scoreBreakdown: {
      priceMatch: 90,
      locationMatch: 80,
      sizeMatch: 85,
      featureMatch: 75,
    },
    status: 'new',
  };

  it('creates a property match successfully', async () => {
    const created = { id: '00000000-0000-0000-0000-000000000099', ...validBody };

    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: created, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/property-matches',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
  });

  it('returns 400 for invalid body', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/property-matches',
      headers: { authorization: BEARER },
      payload: { propertyId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/property-matches',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PUT /:id - Update match ──────────────────────────────────────

describe('PUT /api/v1/property-matches/:id', () => {
  const matchId = '00000000-0000-0000-0000-000000000001';

  it('updates a property match successfully', async () => {
    const updated = { id: matchId, status: 'client_interested' };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updated, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/property-matches/${matchId}`,
      headers: { authorization: BEARER },
      payload: { status: 'client_interested' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.status).toBe('client_interested');
  });

  it('returns 400 for invalid status value', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/property-matches/${matchId}`,
      headers: { authorization: BEARER },
      payload: { status: 'invalid_status' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /score - Score property against brief ───────────────────

describe('POST /api/v1/property-matches/score', () => {
  const propertyId = '00000000-0000-0000-0000-000000000001';
  const clientBriefId = '00000000-0000-0000-0000-000000000002';

  it('returns score for a property against a brief', async () => {
    const mockProperty = { id: propertyId, bedrooms: 3 };
    const mockBrief = { id: clientBriefId };
    const mockResult = { overallScore: 85, breakdown: {} };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProperty, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockBrief, error: null }),
            }),
          }),
        }),
      };
    });

    mockScoreProperty.mockReturnValue(mockResult);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/property-matches/score',
      headers: { authorization: BEARER },
      payload: { propertyId, clientBriefId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
  });

  it('returns 400 when propertyId is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/property-matches/score',
      headers: { authorization: BEARER },
      payload: { clientBriefId },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when property not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/property-matches/score',
      headers: { authorization: BEARER },
      payload: { propertyId, clientBriefId },
    });

    expect(response.statusCode).toBe(404);
  });
});
