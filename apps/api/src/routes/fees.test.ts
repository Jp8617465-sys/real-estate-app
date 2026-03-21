import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock business-logic ──────────────────────────────────────────

const mockCalculateTotalFees = vi.fn();

vi.mock('@realflow/business-logic', () => ({
  FeeCalculator: {
    calculateTotalFees: (purchasePrice: number, opts: unknown) =>
      mockCalculateTotalFees(purchasePrice, opts),
  },
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { feeRoutes } from './fees';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(feeRoutes, { prefix: '/api/v1/fees' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /client/:clientId ────────────────────────────────────────

describe('GET /api/v1/fees/client/:clientId', () => {
  const clientId = '00000000-0000-0000-0000-000000000001';

  it('returns fee structure with invoices and referral fees', async () => {
    const feeStructure = { id: '00000000-0000-0000-0000-000000000010', client_id: clientId };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: feeStructure, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/fees/client/${clientId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.invoices).toEqual([]);
    expect(body.data.referralFees).toEqual([]);
  });

  it('returns 404 when fee structure not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/fees/client/${clientId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create fee structure ───────────────────────────────

describe('POST /api/v1/fees', () => {
  const validBody = {
    clientId: '00000000-0000-0000-0000-000000000001',
    transactionId: '00000000-0000-0000-0000-000000000002',
    retainerFee: 2500,
    successFeeType: 'percentage',
    successFeePercentage: 1.5,
    gstIncluded: true,
  };

  it('creates a fee structure successfully', async () => {
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
      url: '/api/v1/fees',
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
      url: '/api/v1/fees',
      headers: { authorization: BEARER },
      payload: { clientId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /:id - Update fee structure ─────────────────────────────

describe('PUT /api/v1/fees/:id', () => {
  const feeId = '00000000-0000-0000-0000-000000000010';

  it('updates a fee structure successfully', async () => {
    const updated = { id: feeId, retainer_fee: 3000 };

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
      url: `/api/v1/fees/${feeId}`,
      headers: { authorization: BEARER },
      payload: { retainerFee: 3000 },
    });

    expect(response.statusCode).toBe(200);
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
      url: `/api/v1/fees/${feeId}`,
      headers: { authorization: BEARER },
      payload: { retainerFee: 3000 },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /:id/invoices - Create invoice ─────────────────────────

describe('POST /api/v1/fees/:id/invoices', () => {
  const feeId = '00000000-0000-0000-0000-000000000010';

  const validInvoice = {
    feeStructureId: feeId,
    clientId: '00000000-0000-0000-0000-000000000001',
    type: 'retainer',
    amount: 2500,
    gstAmount: 250,
    status: 'draft',
    dueDate: '2026-04-01T00:00:00.000Z',
  };

  it('creates an invoice successfully', async () => {
    const feeStructure = { id: feeId };
    const created = { id: '00000000-0000-0000-0000-000000000099', ...validInvoice };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: feeStructure, error: null }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: created, error: null }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/fees/${feeId}/invoices`,
      headers: { authorization: BEARER },
      payload: validInvoice,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 404 when fee structure not found', async () => {
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
      url: `/api/v1/fees/${feeId}/invoices`,
      headers: { authorization: BEARER },
      payload: validInvoice,
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /:id/invoices - List invoices ────────────────────────────

describe('GET /api/v1/fees/:id/invoices', () => {
  const feeId = '00000000-0000-0000-0000-000000000010';

  it('returns list of invoices', async () => {
    const invoices = [
      { id: '00000000-0000-0000-0000-000000000020', type: 'retainer', amount: 2500 },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: invoices, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/fees/${feeId}/invoices`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
  });
});

// ─── PUT /invoices/:invoiceId - Update invoice ────────────────────

describe('PUT /api/v1/fees/invoices/:invoiceId', () => {
  const invoiceId = '00000000-0000-0000-0000-000000000020';

  it('updates invoice status to paid', async () => {
    const updated = { id: invoiceId, status: 'paid' };

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
      url: `/api/v1/fees/invoices/${invoiceId}`,
      headers: { authorization: BEARER },
      payload: { status: 'paid' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 400 for invalid status', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/fees/invoices/${invoiceId}`,
      headers: { authorization: BEARER },
      payload: { status: 'invalid_status' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /calculate - Calculate fees ────────────────────────────

describe('POST /api/v1/fees/calculate', () => {
  it('calculates total fees successfully', async () => {
    const result = {
      retainerFee: 2500,
      successFee: 15000,
      totalExGst: 17500,
      totalIncGst: 19250,
    };

    mockCalculateTotalFees.mockReturnValue(result);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/fees/calculate',
      headers: { authorization: BEARER },
      payload: {
        purchasePrice: 1000000,
        retainerFee: 2500,
        successFeeType: 'flat',
        successFeeFlatAmount: 15000,
        gstIncluded: true,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/fees/calculate',
      headers: { authorization: BEARER },
      payload: { purchasePrice: 1000000 }, // missing other required fields
    });

    expect(response.statusCode).toBe(400);
  });
});
