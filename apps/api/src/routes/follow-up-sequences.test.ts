import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock business-logic ──────────────────────────────────────────

const mockEnrollContact = vi.fn();

vi.mock('@realflow/business-logic', () => ({
  enrollContact: (opts: unknown) => mockEnrollContact(opts),
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { followUpSequenceRoutes } from './follow-up-sequences';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(followUpSequenceRoutes, { prefix: '/api/v1/sequences' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List sequences ───────────────────────────────────────

describe('GET /api/v1/sequences', () => {
  it('returns list of sequences', async () => {
    const sequences = [
      { id: '00000000-0000-0000-0000-000000000001', name: 'Buyer Onboarding', is_template: false },
      { id: '00000000-0000-0000-0000-000000000002', name: 'New Buyer Template', is_template: true },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: sequences, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/sequences',
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
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/sequences',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /templates - List templates ─────────────────────────────

describe('GET /api/v1/sequences/templates', () => {
  it('returns template sequences', async () => {
    const templates = [
      { id: '00000000-0000-0000-0000-000000000001', name: 'New Buyer Template', is_template: true },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: templates, error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/sequences/templates',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
  });
});

// ─── POST / - Create sequence ─────────────────────────────────────

describe('POST /api/v1/sequences', () => {
  const validBody = {
    name: 'My Follow-up Sequence',
    category: 'buyer_nurture',
    triggerType: 'manual',
    triggerConfig: {},
    steps: [
      {
        index: 0,
        dayOffset: 1,
        action: { type: 'notify_agent', message: 'Follow up with client' },
        skipIfResponded: false,
      },
    ],
  };

  it('creates a sequence successfully', async () => {
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
      url: '/api/v1/sequences',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 400 for invalid body', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sequences',
      headers: { authorization: BEARER },
      payload: { name: '' }, // invalid: empty name, missing required fields
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /:id/enroll - Enroll contact ───────────────────────────

describe('POST /api/v1/sequences/:id/enroll', () => {
  const sequenceId = '00000000-0000-0000-0000-000000000001';

  const validBody = {
    sequenceId: '00000000-0000-0000-0000-000000000001',
    contactId: '00000000-0000-0000-0000-000000000010',
    enrolledBy: '00000000-0000-0000-0000-000000000020',
  };

  it('enrolls a contact successfully', async () => {
    const enrollment = { id: '00000000-0000-0000-0000-000000000099', status: 'active' };
    mockEnrollContact.mockResolvedValue(enrollment);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/sequences/${sequenceId}/enroll`,
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 400 for invalid body', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/sequences/${sequenceId}/enroll`,
      headers: { authorization: BEARER },
      payload: { contactId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 409 when already enrolled', async () => {
    mockEnrollContact.mockRejectedValue(new Error('Contact already enrolled in this sequence'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/sequences/${sequenceId}/enroll`,
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(409);
  });

  it('returns 500 on general enrollment error', async () => {
    mockEnrollContact.mockRejectedValue(new Error('Database error'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/sequences/${sequenceId}/enroll`,
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id/enrollments ─────────────────────────────────────────

describe('GET /api/v1/sequences/:id/enrollments', () => {
  const sequenceId = '00000000-0000-0000-0000-000000000001';

  it('returns enrollments for a sequence', async () => {
    const enrollments = [
      { id: '00000000-0000-0000-0000-000000000050', status: 'active' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: enrollments, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/sequences/${sequenceId}/enrollments`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
  });
});

// ─── POST /enrollments/:id/pause ─────────────────────────────────

describe('POST /api/v1/sequences/enrollments/:id/pause', () => {
  const enrollmentId = '00000000-0000-0000-0000-000000000050';

  it('pauses an active enrollment', async () => {
    const paused = { id: enrollmentId, status: 'paused' };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: paused, error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/sequences/enrollments/${enrollmentId}/pause`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 404 when active enrollment not found', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/sequences/enrollments/${enrollmentId}/pause`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── DELETE /enrollments/:id - Cancel enrollment ─────────────────

describe('DELETE /api/v1/sequences/enrollments/:id', () => {
  const enrollmentId = '00000000-0000-0000-0000-000000000050';

  it('cancels an enrollment', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sequences/enrollments/${enrollmentId}`,
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
      url: `/api/v1/sequences/enrollments/${enrollmentId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});
