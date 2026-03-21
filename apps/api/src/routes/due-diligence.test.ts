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

const mockGenerateChecklist = vi.fn();
const mockCalculateCompletion = vi.fn();
const mockHasBlockingIssues = vi.fn();
const mockGetSupportedStates = vi.fn();

vi.mock('@realflow/business-logic', () => ({
  DueDiligenceEngine: {
    generateChecklist: (state: string, propertyType: string) =>
      mockGenerateChecklist(state, propertyType),
    calculateCompletion: (statuses: string[]) => mockCalculateCompletion(statuses),
    hasBlockingIssues: (items: unknown[]) => mockHasBlockingIssues(items),
    getSupportedStates: () => mockGetSupportedStates(),
  },
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { dueDiligenceRoutes } from './due-diligence';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';

async function buildApp() {
  const app = Fastify();
  await app.register(dueDiligenceRoutes, { prefix: '/api/v1/due-diligence' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /transaction/:transactionId ─────────────────────────────

describe('GET /api/v1/due-diligence/transaction/:transactionId', () => {
  const transactionId = '00000000-0000-0000-0000-000000000001';

  it('returns checklist with items', async () => {
    const checklist = { id: '00000000-0000-0000-0000-000000000010', transaction_id: transactionId };
    const items = [{ id: '00000000-0000-0000-0000-000000000020', status: 'not_started' }];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: checklist, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: items, error: null }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/due-diligence/transaction/${transactionId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.items).toHaveLength(1);
  });

  it('returns 404 when checklist not found', async () => {
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
      url: `/api/v1/due-diligence/transaction/${transactionId}`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST /generate ───────────────────────────────────────────────

describe('POST /api/v1/due-diligence/generate', () => {
  const validBody = {
    transactionId: '00000000-0000-0000-0000-000000000001',
    state: 'NSW',
    propertyType: 'house',
    createdBy: '00000000-0000-0000-0000-000000000020',
  };

  it('generates and saves a checklist', async () => {
    const generatedChecklist = {
      state: 'NSW',
      propertyType: 'house',
      items: [
        {
          category: 'legal',
          name: 'Contract Review',
          description: 'Review contract',
          assignedTo: 'solicitor',
          isBlocking: true,
          isCritical: true,
          sortOrder: 1,
        },
      ],
    };

    mockGenerateChecklist.mockReturnValue(generatedChecklist);

    const checklist = { id: '00000000-0000-0000-0000-000000000010', ...validBody };
    const items = [{ id: '00000000-0000-0000-0000-000000000020' }];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: checklist, error: null }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: items, error: null }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/due-diligence/generate',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/due-diligence/generate',
      headers: { authorization: BEARER },
      payload: { transactionId: '00000000-0000-0000-0000-000000000001' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when no template found for state', async () => {
    mockGenerateChecklist.mockReturnValue(null);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/due-diligence/generate',
      headers: { authorization: BEARER },
      payload: { ...validBody, state: 'INVALID_STATE' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /items/:itemId ───────────────────────────────────────────

describe('PUT /api/v1/due-diligence/items/:itemId', () => {
  const itemId = '00000000-0000-0000-0000-000000000020';

  it('updates a due diligence item', async () => {
    const updatedItem = {
      id: itemId,
      checklist_id: '00000000-0000-0000-0000-000000000010',
      status: 'completed',
      is_blocking: false,
    };
    const allItems = [{ status: 'completed', is_blocking: false }];

    mockCalculateCompletion.mockReturnValue(100);
    mockHasBlockingIssues.mockReturnValue(false);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedItem, error: null }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: allItems, error: null }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/due-diligence/items/${itemId}`,
      headers: { authorization: BEARER },
      payload: { status: 'completed' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 400 for invalid status', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/due-diligence/items/${itemId}`,
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
      url: `/api/v1/due-diligence/items/${itemId}`,
      headers: { authorization: BEARER },
      payload: { status: 'completed' },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /templates/:state ────────────────────────────────────────

describe('GET /api/v1/due-diligence/templates/:state', () => {
  it('returns template for valid state', async () => {
    const template = {
      state: 'NSW',
      propertyType: 'house',
      items: [{ name: 'Contract Review', category: 'legal', sortOrder: 1 }],
    };

    mockGenerateChecklist.mockReturnValue(template);
    mockGetSupportedStates.mockReturnValue(['NSW', 'VIC', 'QLD']);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/due-diligence/templates/NSW',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.state).toBe('NSW');
    expect(body.data.supportedStates).toContain('NSW');
  });

  it('returns 404 for unsupported state', async () => {
    mockGenerateChecklist.mockReturnValue(null);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/due-diligence/templates/INVALID',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});
