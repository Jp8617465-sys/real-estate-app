import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { sellingAgentRoutes } from './selling-agents';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(sellingAgentRoutes, { prefix: '/api/v1/selling-agents' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List selling agent profiles ─────────────────────────

describe('GET /api/v1/selling-agents', () => {
  it('returns list of selling agent profiles', async () => {
    const profiles = [
      { id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0000-000000000010', relationship_score: 5 },
      { id: '00000000-0000-0000-0000-000000000002', contact_id: '00000000-0000-0000-0000-000000000011', relationship_score: 4 },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: profiles, error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/selling-agents',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('filters by suburb when provided', async () => {
    const profiles = [
      { id: '00000000-0000-0000-0000-000000000001', suburbs: ['Mosman'] },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          contains: vi.fn().mockResolvedValue({ data: profiles, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/selling-agents?suburb=Mosman',
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
      url: '/api/v1/selling-agents',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get profile by contact ID ────────────────────────

describe('GET /api/v1/selling-agents/:id', () => {
  const contactId = '00000000-0000-0000-0000-000000000010';

  it('returns a selling agent profile', async () => {
    const profile = { id: '00000000-0000-0000-0000-000000000001', contact_id: contactId };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/selling-agents/${contactId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.contact_id).toBe(contactId);
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
      url: '/api/v1/selling-agents/nonexistent',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create profile ──────────────────────────────────────

describe('POST /api/v1/selling-agents', () => {
  const validBody = {
    contactId: '00000000-0000-0000-0000-000000000010',
    agency: 'Ray White Mosman',
    suburbs: ['Mosman', 'Cremorne'],
    relationshipScore: 4,
    tags: ['responsive', 'auction-specialist'],
  };

  it('creates a selling agent profile successfully', async () => {
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
      url: '/api/v1/selling-agents',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
  });

  it('returns 400 for invalid body (invalid UUID)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/selling-agents',
      headers: { authorization: BEARER },
      payload: { contactId: 'not-a-valid-uuid' },
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
      url: '/api/v1/selling-agents',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PUT /:id - Update profile ────────────────────────────────────

describe('PUT /api/v1/selling-agents/:id', () => {
  const contactId = '00000000-0000-0000-0000-000000000010';

  it('updates a selling agent profile successfully', async () => {
    const updated = { id: '00000000-0000-0000-0000-000000000001', relationship_score: 5 };

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
      url: `/api/v1/selling-agents/${contactId}`,
      headers: { authorization: BEARER },
      payload: { relationshipScore: 5 },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.relationship_score).toBe(5);
  });

  it('returns 400 for invalid relationship score', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/selling-agents/${contactId}`,
      headers: { authorization: BEARER },
      payload: { relationshipScore: 10 }, // max is 5
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/selling-agents/${contactId}`,
      headers: { authorization: BEARER },
      payload: { agency: 'New Agency' },
    });

    expect(response.statusCode).toBe(500);
  });
});
