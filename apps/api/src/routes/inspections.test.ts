import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { inspectionRoutes } from './inspections';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(inspectionRoutes, { prefix: '/api/v1/inspections' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List inspections ─────────────────────────────────────

describe('GET /api/v1/inspections', () => {
  it('returns list of inspections', async () => {
    const inspections = [
      { id: '00000000-0000-0000-0000-000000000001', overall_impression: 'positive' },
      { id: '00000000-0000-0000-0000-000000000002', overall_impression: 'neutral' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: inspections, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/inspections',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/inspections',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get single inspection ────────────────────────────

describe('GET /api/v1/inspections/:id', () => {
  const inspectionId = '00000000-0000-0000-0000-000000000001';

  it('returns a single inspection', async () => {
    const inspection = { id: inspectionId, overall_impression: 'positive' };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: inspection, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/inspections/${inspectionId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.id).toBe(inspectionId);
  });

  it('returns 404 when not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/inspections/nonexistent',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create inspection ──────────────────────────────────

describe('POST /api/v1/inspections', () => {
  const validBody = {
    propertyId: '00000000-0000-0000-0000-000000000001',
    inspectionDate: '2026-03-09T10:00:00.000Z',
    overallImpression: 'positive',
    createdBy: '00000000-0000-0000-0000-000000000020',
  };

  it('creates an inspection successfully', async () => {
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
      url: '/api/v1/inspections',
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
      url: '/api/v1/inspections',
      headers: { authorization: BEARER },
      payload: { propertyId: 'not-a-uuid' }, // invalid UUID + missing required fields
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
      url: '/api/v1/inspections',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PUT /:id - Update inspection ────────────────────────────────

describe('PUT /api/v1/inspections/:id', () => {
  const inspectionId = '00000000-0000-0000-0000-000000000001';

  it('updates an inspection successfully', async () => {
    const updated = { id: inspectionId, overall_impression: 'negative' };

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
      url: `/api/v1/inspections/${inspectionId}`,
      headers: { authorization: BEARER },
      payload: { overallImpression: 'negative' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 400 for invalid impression value', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/inspections/${inspectionId}`,
      headers: { authorization: BEARER },
      payload: { overallImpression: 'invalid_value' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── DELETE /:id - Soft delete inspection ────────────────────────

describe('DELETE /api/v1/inspections/:id', () => {
  const inspectionId = '00000000-0000-0000-0000-000000000001';

  it('soft deletes an inspection', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/inspections/${inspectionId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('returns 500 on delete error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/inspections/${inspectionId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});
