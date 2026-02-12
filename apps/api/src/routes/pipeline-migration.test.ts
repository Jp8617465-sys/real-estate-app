import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockSupabase = { from: mockFrom, rpc: mockRpc };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { pipelineMigrationRoutes } from './pipeline-migration';

async function buildApp() {
  const app = Fastify();
  await app.register(pipelineMigrationRoutes, { prefix: '/api/v1/pipeline-migration' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Mock Transaction Data ─────────────────────────────────────────

const mockTransaction = {
  id: 'trans-123',
  contact_id: 'contact-456',
  pipeline_type: 'buying',
  current_stage: 'active-search',
  office_id: 'office-789',
  assigned_agent_id: 'agent-001',
  is_deleted: false,
};

const mockContact = {
  id: 'contact-456',
  first_name: 'John',
  last_name: 'Doe',
  buyer_profile: {
    budget: { min: 500000, max: 700000 },
    suburbs: [{ name: 'Bondi', state: 'NSW', postcode: '2026', priority: 1 }],
  },
};

const mockClientBrief = {
  id: 'brief-789',
  contact_id: 'contact-456',
  transaction_id: 'trans-123',
  client_signed_off: true,
  is_deleted: false,
};

// ─── POST /preview - Dry-run migration preview ─────────────────────

describe('POST /api/v1/pipeline-migration/preview', () => {
  it('returns migration preview for all buying transactions', async () => {
    // Mock transactions query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [mockTransaction],
            error: null,
          }),
        }),
      }),
    });

    // Mock contacts query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockContact],
          error: null,
        }),
      }),
    });

    // Mock client briefs query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    // Mock offers query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    // Mock contracts query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    // Mock fee structures query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/preview',
      payload: { dryRun: true },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.totalTransactions).toBe(1);
    expect(body.previews).toHaveLength(1);
    expect(body.previews[0].transactionId).toBe('trans-123');
    expect(body.previews[0].targetStage).toBeDefined();
  });

  it('accepts specific transaction IDs for preview', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [mockTransaction],
              error: null,
            }),
          }),
        }),
      }),
    });

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockContact],
          error: null,
        }),
      }),
    });

    // Mock other queries
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/preview',
      payload: {
        transactionIds: ['trans-123'],
        dryRun: true,
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/preview',
      payload: { dryRun: true },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /execute - Execute migration ─────────────────────────────

describe('POST /api/v1/pipeline-migration/execute', () => {
  it('executes migration for specified transactions', async () => {
    // Mock transactions query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [mockTransaction],
              error: null,
            }),
          }),
        }),
      }),
    });

    // Mock contacts query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockContact],
          error: null,
        }),
      }),
    });

    // Mock other context queries
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    // Mock SQL function call
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        transaction_id: 'trans-123',
        migration_history_id: 'history-001',
      },
      error: null,
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/execute',
      payload: {
        transactionIds: ['trans-123'],
        userId: 'user-001',
        reason: 'Migration to buyers-agent pipeline',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.migrationBatchId).toBeDefined();
    expect(body.successfulCount).toBe(1);
    expect(body.failedCount).toBe(0);
    expect(mockRpc).toHaveBeenCalledWith(
      'migrate_transaction_to_buyers_agent',
      expect.any(Object)
    );
  });

  it('requires transactionIds in payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/execute',
      payload: {
        userId: 'user-001',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('requires userId in payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/execute',
      payload: {
        transactionIds: ['trans-123'],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('continues on individual transaction failures', async () => {
    // Mock transactions query with 2 transactions
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { ...mockTransaction, id: 'trans-1' },
                { ...mockTransaction, id: 'trans-2' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    // Mock contacts query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockContact],
          error: null,
        }),
      }),
    });

    // Mock other queries
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    // Mock SQL function - first succeeds, second fails
    mockRpc
      .mockResolvedValueOnce({
        data: { success: true, transaction_id: 'trans-1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Transaction locked' },
      });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/execute',
      payload: {
        transactionIds: ['trans-1', 'trans-2'],
        userId: 'user-001',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.successfulCount).toBe(1);
    expect(body.failedCount).toBe(1);
    expect(body.results).toHaveLength(2);
  });
});

// ─── GET /history - View migration history ─────────────────────────

describe('GET /api/v1/pipeline-migration/history', () => {
  it('returns migration history records', async () => {
    const mockHistory = [
      {
        id: 'history-001',
        transaction_id: 'trans-123',
        original_pipeline_type: 'buying',
        new_pipeline_type: 'buyers-agent',
        original_stage: 'active-search',
        new_stage: 'active-search',
        migrated_at: '2026-02-12T10:00:00Z',
        migrated_by: 'user-001',
        migration_batch_id: 'batch-001',
        rolled_back: false,
      },
    ];

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockHistory,
              error: null,
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/pipeline-migration/history',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('history-001');
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/pipeline-migration/history',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /rollback - Rollback migration batch ─────────────────────

describe('POST /api/v1/pipeline-migration/rollback', () => {
  it('rolls back migration batch', async () => {
    const mockMigrations = [
      {
        id: 'history-001',
        transaction_id: 'trans-123',
        original_pipeline_type: 'buying',
        original_stage: 'active-search',
      },
    ];

    // Mock history query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockMigrations,
            error: null,
          }),
        }),
      }),
    });

    // Mock transaction update
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockTransaction,
          error: null,
        }),
      }),
    });

    // Mock history update
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      }),
    });

    // Mock activity insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: {},
        error: null,
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/rollback',
      payload: {
        migrationBatchId: 'batch-001',
        userId: 'user-001',
        reason: 'Incorrect mapping',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.rolledBackCount).toBe(1);
  });

  it('requires migrationBatchId in payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/rollback',
      payload: {
        userId: 'user-001',
        reason: 'Test',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when batch not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/rollback',
      payload: {
        migrationBatchId: 'batch-999',
        userId: 'user-001',
        reason: 'Test',
      },
    });

    expect(response.statusCode).toBe(404);
  });
});
