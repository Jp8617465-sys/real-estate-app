import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { workflowRoutes } from './workflows';

// ─── Test setup ───────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(workflowRoutes, { prefix: '/api/v1/workflows' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List workflows ───────────────────────────────────────

describe('GET /api/v1/workflows', () => {
  it('returns workflow list', async () => {
    const workflows = [
      { id: '1', name: 'Lead Response', is_active: true },
      { id: '2', name: 'Follow Up', is_active: false },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ data: workflows, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('filters by is_active', async () => {
    const workflows = [{ id: '1', name: 'Lead Response', is_active: true }];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (r: (v: unknown) => void) => r({ data: workflows, error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows?is_active=true',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB connection failed' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /templates - Get templates ───────────────────────────────

describe('GET /api/v1/workflows/templates', () => {
  it('returns workflow templates', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/templates',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].name).toBe('Instant Lead Response');
    expect(body.data[0].id).toBe(0);
  });
});

// ─── POST /from-template - Create from template ──────────────────

describe('POST /api/v1/workflows/from-template', () => {
  it('creates a workflow from a valid template', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-wf-1', name: 'Instant Lead Response', is_active: true },
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/from-template',
      payload: {
        templateId: 0,
        createdBy: '00000000-0000-0000-0000-000000000001',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data.name).toBe('Instant Lead Response');
  });

  it('returns 404 for invalid template ID', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/from-template',
      payload: {
        templateId: 999,
        createdBy: '00000000-0000-0000-0000-000000000001',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400 for invalid body', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/from-template',
      payload: { templateId: 'not-a-number' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /:id - Get single workflow ──────────────────────────────

describe('GET /api/v1/workflows/:id', () => {
  it('returns a single workflow', async () => {
    const workflow = { id: '1', name: 'Lead Response', is_active: true };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: workflow, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.name).toBe('Lead Response');
  });

  it('returns 404 when workflow not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create custom workflow ──────────────────────────────

describe('POST /api/v1/workflows', () => {
  const validBody = {
    name: 'Custom Workflow',
    description: 'A test workflow',
    trigger: { type: 'new_lead' },
    conditions: [],
    actions: [{ type: 'notify_agent', message: 'Hello' }],
    isActive: true,
    createdBy: '00000000-0000-0000-0000-000000000001',
  };

  it('creates a custom workflow', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-wf-1', ...validBody },
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 400 for invalid input (missing name)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      payload: {
        trigger: { type: 'new_lead' },
        conditions: [],
        actions: [{ type: 'notify_agent', message: 'Hello' }],
        createdBy: '00000000-0000-0000-0000-000000000001',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for empty actions array', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      payload: { ...validBody, actions: [] },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PATCH /:id - Update workflow ────────────────────────────────

describe('PATCH /api/v1/workflows/:id', () => {
  it('updates a workflow', async () => {
    const updated = { id: '1', name: 'Updated Workflow', is_active: false };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/workflows/1',
      payload: { name: 'Updated Workflow', isActive: false },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.name).toBe('Updated Workflow');
  });

  it('returns 500 on update error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB error' },
              }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/workflows/1',
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── DELETE /:id - Soft delete ───────────────────────────────────

describe('DELETE /api/v1/workflows/:id', () => {
  it('soft deletes a workflow', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/workflows/1',
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
      url: '/api/v1/workflows/1',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id/runs - List runs ───────────────────────────────────

describe('GET /api/v1/workflows/:id/runs', () => {
  it('returns workflow runs', async () => {
    const runs = [
      { id: 'run-1', workflow_id: '1', status: 'completed' },
      { id: 'run-2', workflow_id: '1', status: 'failed' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ data: runs, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/1/runs',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/1/runs',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /evaluate - Scheduler evaluation ────────────────────────

describe('POST /api/v1/workflows/evaluate', () => {
  it('evaluates scheduler-based workflows', async () => {
    const workflows = [
      { id: '1', trigger: { type: 'time_based', schedule: '0 9 * * *' }, is_active: true },
      { id: '2', trigger: { type: 'new_lead' }, is_active: true },
      { id: '3', trigger: { type: 'no_activity', days: 2 }, is_active: true },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ data: workflows, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/evaluate',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.evaluated).toBe(2); // time_based + no_activity
  });

  it('returns zero when no active workflows', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/evaluate',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.evaluated).toBe(0);
  });
});

// ─── POST /dispatch - Event dispatch ──────────────────────────────

describe('POST /api/v1/workflows/dispatch', () => {
  it('returns 400 for invalid event', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/dispatch',
      payload: { type: 'invalid_type', data: {} },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 0 dispatched when no workflows exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/dispatch',
      payload: {
        type: 'new_lead',
        data: { source: 'domain' },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.dispatched).toBe(0);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/dispatch',
      payload: {
        type: 'new_lead',
        data: {},
      },
    });

    expect(response.statusCode).toBe(500);
  });
});
