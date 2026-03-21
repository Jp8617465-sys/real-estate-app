import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

vi.mock('../plugins/product-guard', () => ({
  productGuardHook: () => async () => {},
}));

// ─── Mock business-logic ──────────────────────────────────────────

vi.mock('@realflow/business-logic', () => ({
  fromDbSchema: (data: unknown) => data,
  toDbSchema: (data: unknown) => data,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { clientBriefRoutes } from './client-briefs';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(clientBriefRoutes, { prefix: '/api/v1/client-briefs' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List client briefs ───────────────────────────────────

describe('GET /api/v1/client-briefs', () => {
  it('returns list of client briefs', async () => {
    const briefs = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        contact_id: '00000000-0000-0000-0000-000000000010',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        contact_id: '00000000-0000-0000-0000-000000000011',
      },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: briefs, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/client-briefs',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('filters by contactId when provided', async () => {
    const contactId = '00000000-0000-0000-0000-000000000010';
    const briefs = [{ id: '00000000-0000-0000-0000-000000000001', contact_id: contactId }];

    const mockEq2 = vi.fn().mockResolvedValue({ data: briefs, error: null });
    const mockEq1 = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        eq: mockEq2,
        then: (r: Function) => r({ data: briefs, error: null }),
      }),
    });
    const mockOrderFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: briefs, error: null }),
      then: (r: Function) => r({ data: briefs, error: null }),
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: mockOrderFn,
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/client-briefs?contactId=${contactId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
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
      url: '/api/v1/client-briefs',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get single brief ──────────────────────────────────

describe('GET /api/v1/client-briefs/:id', () => {
  const briefId = '00000000-0000-0000-0000-000000000001';

  it('returns a single client brief', async () => {
    const brief = { id: briefId, contact_id: '00000000-0000-0000-0000-000000000010' };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: brief, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/client-briefs/${briefId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.id).toBe(briefId);
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
      url: '/api/v1/client-briefs/nonexistent',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create brief ────────────────────────────────────────

describe('POST /api/v1/client-briefs', () => {
  const validBody = {
    contactId: '00000000-0000-0000-0000-000000000010',
    purchaseType: 'owner_occupier',
    enquiryType: 'home_buyer',
    budget: {
      min: 500000,
      max: 800000,
      stampDutyBudgeted: true,
    },
    finance: {
      preApproved: true,
      firstHomeBuyer: false,
    },
    requirements: {
      propertyTypes: ['house'],
      bedrooms: { min: 3 },
      bathrooms: { min: 2 },
      carSpaces: { min: 1 },
      suburbs: [{ suburb: 'Mosman', state: 'NSW', postcode: '2088' }],
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    },
    timeline: {
      urgency: '3_6_months',
    },
    communication: {},
    createdBy: '00000000-0000-0000-0000-000000000020',
    clientSignedOff: false,
  };

  it('creates a client brief successfully', async () => {
    const createdBrief = { id: '00000000-0000-0000-0000-000000000099', ...validBody };

    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: createdBrief, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/client-briefs',
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
      url: '/api/v1/client-briefs',
      headers: { authorization: BEARER },
      payload: { contactId: 'not-a-uuid' }, // invalid UUID, missing required fields
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
      url: '/api/v1/client-briefs',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PUT /:id - Update brief ──────────────────────────────────────

describe('PUT /api/v1/client-briefs/:id', () => {
  const briefId = '00000000-0000-0000-0000-000000000001';

  it('updates a client brief successfully', async () => {
    const currentBrief = {
      id: briefId,
      brief_version: 1,
      budget_min: 500000,
      budget_max: 800000,
      requirements: {
        suburbs: [],
        propertyTypes: [],
        bedrooms: { min: 3 },
        bathrooms: { min: 2 },
        carSpaces: { min: 1 },
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: [],
      },
      budget: { min: 500000, max: 800000, stampDutyBudgeted: true },
      finance: { preApproved: true, firstHomeBuyer: false },
      timeline: { urgency: '3_6_months' },
      communication: {},
    };

    const updatedBrief = { ...currentBrief, brief_version: 2 };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: currentBrief, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedBrief, error: null }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/client-briefs/${briefId}`,
      headers: { authorization: BEARER },
      payload: { clientSignedOff: true },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 404 when brief not found', async () => {
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
      method: 'PUT',
      url: `/api/v1/client-briefs/${briefId}`,
      headers: { authorization: BEARER },
      payload: { clientSignedOff: true },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST /:id/sign-off ───────────────────────────────────────────

describe('POST /api/v1/client-briefs/:id/sign-off', () => {
  const briefId = '00000000-0000-0000-0000-000000000001';

  it('signs off a client brief', async () => {
    const signedBrief = { id: briefId, client_signed_off: true };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: signedBrief, error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/client-briefs/${briefId}/sign-off`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/client-briefs/${briefId}/sign-off`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── DELETE /:id - Soft delete brief ─────────────────────────────

describe('DELETE /api/v1/client-briefs/:id', () => {
  const briefId = '00000000-0000-0000-0000-000000000001';

  it('soft deletes a client brief', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/client-briefs/${briefId}`,
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
      url: `/api/v1/client-briefs/${briefId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});
