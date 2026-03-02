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
  // mockReset clears both call history AND the mockReturnValueOnce queue.
  // vi.clearAllMocks() only clears call history, leaving stale queued returns
  // that would contaminate later tests if a previous test fails early.
  mockFrom.mockReset();
  mockRpc.mockReset();
});

// ─── Mock Transaction Data ─────────────────────────────────────────

const mockTransaction = {
  id: 'trans-123',
  contact_id: 'contact-456',
  pipeline_type: 'buying',
  current_stage: 'active-search',
  office_id: 'office-789',
  assigned_agent_id: 'agent-001',
  property_id: null,
  is_deleted: false,
  contacts: { buyer_profile: null },
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

// ─── Helper: mock the 5 per-transaction fetchMigrationContext calls ─

/**
 * fetchMigrationContext makes 5 sequential .from() calls per transaction:
 *   1. transactions  → .eq('id').eq('pipeline_type').eq('is_deleted').single()
 *   2. client_briefs → .eq('transaction_id').eq('is_deleted').maybeSingle()
 *   3. offers        → .eq('transaction_id').eq('is_deleted').order().limit(1)
 *   4. contracts     → .eq('transaction_id').eq('is_deleted').order().limit(1)
 *   5. fee_structures → .eq('transaction_id').eq('is_deleted').order().limit(1)
 */
function mockFetchMigrationContext(txData: typeof mockTransaction) {
  // 1. transactions
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: txData, error: null }),
          }),
        }),
      }),
    }),
  });
  // 2. client_briefs
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  });
  // 3. offers
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  });
  // 4. contracts
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  });
  // 5. fee_structures
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  });
}

// ─── POST /preview - Dry-run migration preview ─────────────────────

describe('POST /api/v1/pipeline-migration/preview', () => {
  it('returns migration preview for all buying transactions', async () => {
    // When no transactionIds are provided, the route first lists all buying
    // transactions, then calls fetchMigrationContext per transaction (5 calls each).

    // Mock 1: list buying transactions
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ id: 'trans-123' }], error: null }),
        }),
      }),
    });

    // Mocks 2–6: fetchMigrationContext for trans-123
    mockFetchMigrationContext(mockTransaction);

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
    // When transactionIds are provided, the list query is skipped —
    // fetchMigrationContext is called directly (5 calls).
    mockFetchMigrationContext(mockTransaction);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/preview',
      payload: {
        transactionIds: ['00000000-0000-0000-0000-000000000123'],
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
    // fetchMigrationContext: 5 calls for trans-123
    mockFetchMigrationContext(mockTransaction);

    // SQL function call
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
        transactionIds: ['00000000-0000-0000-0000-000000000123'],
        userId: '00000000-0000-0000-0000-000000000001',
        reason: 'Migration to buyers-agent pipeline',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.migrationBatchId).toBeDefined();
    expect(body.successful).toBe(1);
    expect(body.failed).toBe(0);
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
        userId: '00000000-0000-0000-0000-000000000001',
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
        transactionIds: ['00000000-0000-0000-0000-000000000001'],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('continues on individual transaction failures', async () => {
    // Two transactions: each needs 5 fetchMigrationContext calls = 10 total
    mockFetchMigrationContext({ ...mockTransaction, id: '00000000-0000-0000-0000-000000000001' });
    mockFetchMigrationContext({ ...mockTransaction, id: '00000000-0000-0000-0000-000000000002' });

    // First RPC succeeds, second fails
    mockRpc
      .mockResolvedValueOnce({
        data: { success: true, transaction_id: '00000000-0000-0000-0000-000000000001' },
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
        transactionIds: [
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
        ],
        userId: '00000000-0000-0000-0000-000000000099',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.successful).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.errors).toHaveLength(1);
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
        new_stage: 'active-search',
      },
    ];

    // 1. Fetch history batch
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockMigrations, error: null }),
        }),
      }),
    });

    // 2. Restore transaction to original pipeline/stage
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // 3. Mark migration record as rolled back
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // 4. Fetch transaction contact_id for activity creation
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { contact_id: 'contact-456', property_id: null },
            error: null,
          }),
        }),
      }),
    });

    // 5. Insert activity log
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/rollback',
      payload: {
        migrationBatchId: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000099',
        reason: 'Incorrect mapping',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.rolledBack).toBe(1);
  });

  it('requires migrationBatchId in payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/rollback',
      payload: {
        userId: '00000000-0000-0000-0000-000000000099',
        reason: 'Test',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when batch not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pipeline-migration/rollback',
      payload: {
        migrationBatchId: '00000000-0000-0000-0000-000000000999',
        userId: '00000000-0000-0000-0000-000000000099',
        reason: 'Test',
      },
    });

    expect(response.statusCode).toBe(404);

  });
});
