import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────
// Rule: vi.mock factory CANNOT reference top-level const vars — use vi.hoisted()

const hoisted = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();
  const mockPauseExecution = vi.fn().mockResolvedValue({ success: true });
  const mockResumeExecution = vi.fn().mockResolvedValue({ success: true });
  const mockScheduleResume = vi.fn().mockResolvedValue({ success: true });
  const mockEvaluateTrigger = vi.fn().mockReturnValue(false);
  const mockEvaluateConditions = vi.fn().mockReturnValue(true);
  const mockRunWorkflow = vi.fn().mockResolvedValue({ status: 'completed', actionsExecuted: 0 });
  return {
    mockFrom,
    mockGetUser,
    mockPauseExecution,
    mockResumeExecution,
    mockScheduleResume,
    mockEvaluateTrigger,
    mockEvaluateConditions,
    mockRunWorkflow,
  };
});

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => ({
    from: hoisted.mockFrom,
    auth: { getUser: hoisted.mockGetUser },
  }),
}));

vi.mock('@realflow/business-logic', () => ({
  BUYERS_AGENT_WORKFLOW_TEMPLATES: [
    {
      name: 'Instant Lead Response',
      description: 'Responds to new leads within 5 minutes.',
      trigger: { type: 'new_lead' },
      conditions: [],
      actions: [{ type: 'notify_agent', message: 'New lead received' }],
    },
    {
      name: 'Follow Up Sequence',
      description: 'Automated follow up.',
      trigger: { type: 'no_activity', days: 3 },
      conditions: [],
      actions: [{ type: 'send_email', template: 'follow_up' }],
    },
  ],
  evaluateTrigger: (...args: unknown[]) => hoisted.mockEvaluateTrigger(...args),
  evaluateConditions: (...args: unknown[]) => hoisted.mockEvaluateConditions(...args),
  runWorkflow: (...args: unknown[]) => hoisted.mockRunWorkflow(...args),
  pauseExecution: (...args: unknown[]) => hoisted.mockPauseExecution(...args),
  resumeExecution: (...args: unknown[]) => hoisted.mockResumeExecution(...args),
  scheduleResume: (...args: unknown[]) => hoisted.mockScheduleResume(...args),
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { workflowRoutes } from './workflows';

// ─── Test setup ───────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';

async function buildApp() {
  const app = Fastify();
  await app.register(workflowRoutes, { prefix: '/api/v1/workflows' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated user for all tests
  hoisted.mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
  hoisted.mockPauseExecution.mockResolvedValue({ success: true });
  hoisted.mockResumeExecution.mockResolvedValue({ success: true });
  hoisted.mockScheduleResume.mockResolvedValue({ success: true });
  hoisted.mockEvaluateTrigger.mockReturnValue(false);
  hoisted.mockRunWorkflow.mockResolvedValue({ status: 'completed', actionsExecuted: 0 });
});

// ─── GET / - List workflows ───────────────────────────────────────

describe('GET /api/v1/workflows', () => {
  it('returns workflow list', async () => {
    const workflows = [
      { id: '1', name: 'Lead Response', is_active: true },
      { id: '2', name: 'Follow Up', is_active: false },
    ];

    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              then: (r: (v: unknown) => void) => r({ data: workflows, error: null }),
            }),
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

    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                then: (r: (v: unknown) => void) => r({ data: workflows, error: null }),
              }),
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

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on database error', async () => {
    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB connection failed' },
            }),
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
    hoisted.mockFrom.mockReturnValue({
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
        // createdBy removed — derived from JWT via auth.getUser()
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

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/from-template',
      payload: { templateId: 0 },
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── GET /:id - Get single workflow ──────────────────────────────

describe('GET /api/v1/workflows/:id', () => {
  it('returns a single workflow', async () => {
    const workflow = { id: '1', name: 'Lead Response', is_active: true };

    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: workflow, error: null }),
            }),
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
    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
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
  // createdBy removed from body — derived from JWT via auth.getUser()
  const validBody = {
    name: 'Custom Workflow',
    description: 'A test workflow',
    trigger: { type: 'new_lead' },
    conditions: [],
    actions: [{ type: 'notify_agent', message: 'Hello' }],
    isActive: true,
  };

  it('creates a custom workflow', async () => {
    hoisted.mockFrom.mockReturnValue({
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

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      payload: validBody,
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on database error', async () => {
    hoisted.mockFrom.mockReturnValue({
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

    hoisted.mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updated, error: null }),
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
      payload: { name: 'Updated Workflow', isActive: false },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.name).toBe('Updated Workflow');
  });

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/workflows/1',
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on update error', async () => {
    hoisted.mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
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
    hoisted.mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
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

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/workflows/1',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on delete error', async () => {
    hoisted.mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
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

    hoisted.mockFrom.mockReturnValue({
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
    hoisted.mockFrom.mockReturnValue({
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

    hoisted.mockFrom.mockReturnValue({
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
    hoisted.mockFrom.mockReturnValue({
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
    hoisted.mockFrom.mockReturnValue({
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
    hoisted.mockFrom.mockReturnValue({
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

// ─── POST /runs/:runId/pause ──────────────────────────────────────

describe('POST /api/v1/workflows/runs/:runId/pause', () => {
  it('pauses a running execution', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/pause',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('returns 400 when pause fails', async () => {
    hoisted.mockPauseExecution.mockResolvedValue({ success: false, error: 'Run not in progress' });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/pause',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Run not in progress');
  });

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/pause',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /runs/:runId/resume ─────────────────────────────────────

describe('POST /api/v1/workflows/runs/:runId/resume', () => {
  it('resumes a paused execution', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/resume',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('returns 400 when resume fails', async () => {
    hoisted.mockResumeExecution.mockResolvedValue({ success: false, error: 'Run is not paused' });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/resume',
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/resume',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /runs/:runId/schedule-resume ───────────────────────────

describe('POST /api/v1/workflows/runs/:runId/schedule-resume', () => {
  it('schedules a resume at a future time', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/schedule-resume',
      payload: { resumeAt: '2026-04-01T09:00:00.000Z' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('returns 400 for invalid resumeAt format', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/schedule-resume',
      payload: { resumeAt: 'not-a-datetime' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when scheduleResume fails', async () => {
    hoisted.mockScheduleResume.mockResolvedValue({ success: false, error: 'Run not paused' });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/schedule-resume',
      payload: { resumeAt: '2026-04-01T09:00:00.000Z' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/schedule-resume',
      payload: { resumeAt: '2026-04-01T09:00:00.000Z' },
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── GET /dead-letters ────────────────────────────────────────────

describe('GET /api/v1/workflows/dead-letters', () => {
  it('returns list of dead letter entries', async () => {
    const deadLetters = [{ id: 'dl-1', workflow_id: '1', error: 'Timeout', created_at: new Date().toISOString() }];

    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          then: (r: (v: unknown) => void) => r({ data: deadLetters, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/dead-letters',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
  });

  it('filters by workflow_id when query param provided', async () => {
    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/dead-letters?workflow_id=wf-1',
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/dead-letters',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on DB error', async () => {
    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/dead-letters',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /runs/:runId/log ─────────────────────────────────────────

describe('GET /api/v1/workflows/runs/:runId/log', () => {
  it('returns execution log for a run', async () => {
    const runData = {
      id: '00000000-0000-0000-0000-000000000099',
      workflow_id: '1',
      status: 'completed',
      execution_log: [{ step: 1, action: 'notify_agent', result: 'success' }],
      variable_context: { contactId: 'c1' },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      paused_at: null,
      resume_at: null,
    };

    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: runData, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/log',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.status).toBe('completed');
    expect(body.data.executionLog).toHaveLength(1);
  });

  it('returns 404 when run not found', async () => {
    hoisted.mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/log',
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/runs/00000000-0000-0000-0000-000000000099/log',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── GET /:id/runs - Auth branch ──────────────────────────────────

describe('GET /api/v1/workflows/:id/runs - auth branch', () => {
  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows/1/runs',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /from-template - DB error branch ────────────────────────

describe('POST /api/v1/workflows/from-template - DB error', () => {
  it('returns 500 when DB insert fails', async () => {
    hoisted.mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB insert failed' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/from-template',
      payload: { templateId: 0 },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PATCH /:id - validation branch ──────────────────────────────

describe('PATCH /api/v1/workflows/:id - validation', () => {
  it('returns 400 for invalid update body (min 1 action violated)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/workflows/1',
      payload: { actions: [] }, // min(1) violated
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /evaluate - additional branches ─────────────────────────

describe('POST /api/v1/workflows/evaluate - additional branches', () => {
  it('returns 401 when not authenticated', async () => {
    hoisted.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/evaluate',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on DB error fetching workflows for evaluate', async () => {
    hoisted.mockFrom.mockReturnValue({
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
      url: '/api/v1/workflows/evaluate',
    });

    expect(response.statusCode).toBe(500);
  });
});
