import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { pipelineRoutes } from './pipeline';

async function buildApp() {
  const app = Fastify();
  await app.register(pipelineRoutes, { prefix: '/api/v1/pipeline' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List transactions ─────────────────────────────────────

describe('GET /api/v1/pipeline', () => {
  it('returns transactions for buying pipeline by default', async () => {
    const transactions = [{ id: '1', pipeline_type: 'buying', current_stage: 'new-enquiry' }];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: transactions, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/pipeline',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
  });

  it('accepts type query parameter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/pipeline?type=selling',
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/pipeline',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /:id/transition - Stage transition ──────────────────────

describe('POST /api/v1/pipeline/:id/transition', () => {
  it('successfully transitions a valid stage', async () => {
    const transaction = {
      id: 'txn-1',
      pipeline_type: 'buying',
      current_stage: 'new-enquiry',
      contact_id: 'contact-1',
    };

    // First call: get transaction
    const selectMock = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
        }),
      }),
    };

    // Second call: update transaction
    const updateMock = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    // Third call: log transition
    const insertTransitionMock = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    // Fourth call: log activity
    const insertActivityMock = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (callCount === 1) return selectMock; // transactions select
      if (callCount === 2) return updateMock; // transactions update
      if (callCount === 3) return insertTransitionMock; // stage_transitions insert
      return insertActivityMock; // activities insert
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline/txn-1/transition',
      payload: {
        toStage: 'qualified-lead',
        userId: '00000000-0000-0000-0000-000000000001',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.newStage).toBe('qualified-lead');
  });

  it('returns 404 when transaction not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline/nonexistent/transition',
      payload: {
        toStage: 'qualified-lead',
        userId: '00000000-0000-0000-0000-000000000001',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400 for invalid transition', async () => {
    const transaction = {
      id: 'txn-1',
      pipeline_type: 'buying',
      current_stage: 'new-enquiry',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline/txn-1/transition',
      payload: {
        toStage: 'settled', // Can't jump from new-enquiry to settled
        userId: '00000000-0000-0000-0000-000000000001',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toContain('Invalid transition');
    expect(body.validNextStages).toBeDefined();
  });

  it('includes reason in transition log', async () => {
    const transaction = {
      id: 'txn-1',
      pipeline_type: 'buying',
      current_stage: 'new-enquiry',
      contact_id: 'contact-1',
    };

    const insertFn = vi.fn().mockResolvedValue({ error: null });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return { insert: insertFn };
    });

    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline/txn-1/transition',
      payload: {
        toStage: 'qualified-lead',
        reason: 'Budget confirmed by buyer',
        userId: '00000000-0000-0000-0000-000000000001',
      },
    });

    // The stage_transitions insert should include the reason
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Budget confirmed by buyer' }),
    );
  });
});
