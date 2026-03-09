import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock business-logic ──────────────────────────────────────────

const mockGenerateKeyDates = vi.fn();

vi.mock('@realflow/business-logic', () => ({
  KeyDatesEngine: {
    generateKeyDates: (contractDetails: unknown, state: string) =>
      mockGenerateKeyDates(contractDetails, state),
  },
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { keyDateRoutes } from './key-dates';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(keyDateRoutes, { prefix: '/api/v1/key-dates' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /transaction/:transactionId ─────────────────────────────

describe('GET /api/v1/key-dates/transaction/:transactionId', () => {
  const transactionId = '00000000-0000-0000-0000-000000000001';

  it('returns key dates for a transaction', async () => {
    const keyDates = [
      { id: '00000000-0000-0000-0000-000000000010', label: 'Settlement', status: 'upcoming' },
      { id: '00000000-0000-0000-0000-000000000011', label: 'Finance Approval', status: 'upcoming' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: keyDates, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/key-dates/transaction/${transactionId}`,
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
      url: `/api/v1/key-dates/transaction/${transactionId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST / - Create key date ─────────────────────────────────────

describe('POST /api/v1/key-dates', () => {
  const validBody = {
    transactionId: '00000000-0000-0000-0000-000000000001',
    label: 'Settlement Date',
    date: '2026-06-01T00:00:00.000Z',
    isCritical: true,
    reminderDaysBefore: [7, 3, 1],
    status: 'upcoming',
  };

  it('creates a key date successfully', async () => {
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
      url: '/api/v1/key-dates',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
  });

  it('returns 400 for invalid body (missing transactionId)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/key-dates',
      headers: { authorization: BEARER },
      payload: { label: 'Settlement' }, // missing required fields
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
      url: '/api/v1/key-dates',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /generate - Auto-generate key dates ─────────────────────

describe('POST /api/v1/key-dates/generate', () => {
  const validBody = {
    transactionId: '00000000-0000-0000-0000-000000000001',
    exchangeDate: '2026-03-15',
    settlementDate: '2026-06-15',
    state: 'NSW',
  };

  it('generates key dates from contract details', async () => {
    const generatedDates = [
      { label: 'Settlement', date: new Date('2026-06-15'), isCritical: true, reminderDaysBefore: [7, 3] },
      { label: 'Finance Approval', date: new Date('2026-04-15'), isCritical: true, reminderDaysBefore: [3] },
    ];

    mockGenerateKeyDates.mockReturnValue(generatedDates);

    const savedDates = generatedDates.map((d, i) => ({
      id: `00000000-0000-0000-0000-00000000000${i}`,
      label: d.label,
    }));

    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: savedDates, error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/key-dates/generate',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/key-dates/generate',
      headers: { authorization: BEARER },
      payload: { transactionId: '00000000-0000-0000-0000-000000000001' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /:id - Update key date ───────────────────────────────────

describe('PUT /api/v1/key-dates/:id', () => {
  const keyDateId = '00000000-0000-0000-0000-000000000010';

  it('updates a key date successfully', async () => {
    const updated = { id: keyDateId, status: 'completed' };

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
      url: `/api/v1/key-dates/${keyDateId}`,
      headers: { authorization: BEARER },
      payload: { status: 'completed' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 400 for invalid status', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/key-dates/${keyDateId}`,
      headers: { authorization: BEARER },
      payload: { status: 'invalid_status' },
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
      url: `/api/v1/key-dates/${keyDateId}`,
      headers: { authorization: BEARER },
      payload: { status: 'completed' },
    });

    expect(response.statusCode).toBe(500);
  });
});
