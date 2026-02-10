import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { taskRoutes } from './tasks';

// ─── Test setup ───────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(taskRoutes, { prefix: '/api/v1/tasks' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List tasks ───────────────────────────────────────────

describe('GET /api/v1/tasks', () => {
  it('returns task list', async () => {
    const tasks = [
      { id: '1', title: 'Call client', status: 'pending' },
      { id: '2', title: 'Send email', status: 'pending' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ data: tasks, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('filters by status', async () => {
    const tasks = [{ id: '1', title: 'Call client', status: 'completed' }];

    const mockEq2 = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: (r: (v: unknown) => void) => r({ data: tasks, error: null }),
        }),
      }),
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: mockEq2,
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks?status=completed',
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
      url: '/api/v1/tasks',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get single task ──────────────────────────────────

describe('GET /api/v1/tasks/:id', () => {
  it('returns a single task', async () => {
    const task = { id: '1', title: 'Call client', status: 'pending' };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: task, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.title).toBe('Call client');
  });

  it('returns 404 when task not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found', code: 'PGRST116' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create task ────────────────────────────────────────

describe('POST /api/v1/tasks', () => {
  const validBody = {
    title: 'Call new lead',
    type: 'call',
    priority: 'high',
    status: 'pending',
    assignedTo: '00000000-0000-0000-0000-000000000001',
    dueDate: '2026-02-15T09:00:00.000Z',
    createdBy: '00000000-0000-0000-0000-000000000001',
  };

  it('creates a task successfully', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-1', ...validBody },
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data.title).toBe('Call new lead');
  });

  it('returns 400 for invalid input', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: '' }, // Missing required fields
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
      url: '/api/v1/tasks',
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PATCH /:id - Update task ────────────────────────────────────

describe('PATCH /api/v1/tasks/:id', () => {
  it('updates a task successfully', async () => {
    const updated = { id: '1', title: 'Updated task', priority: 'urgent' };

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
      url: '/api/v1/tasks/1',
      payload: { title: 'Updated task', priority: 'urgent' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.title).toBe('Updated task');
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
      url: '/api/v1/tasks/1',
      payload: { title: 'Updated task' },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /:id/complete - Complete task ──────────────────────────

describe('POST /api/v1/tasks/:id/complete', () => {
  it('marks a task as complete', async () => {
    const completed = { id: '1', title: 'Call client', status: 'completed', completed_at: '2026-02-10T12:00:00.000Z' };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: completed, error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/1/complete',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.status).toBe('completed');
    expect(body.data.completed_at).toBeDefined();
  });

  it('returns 500 on complete error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Task not found' },
              }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/nonexistent/complete',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── DELETE /:id - Soft delete task ──────────────────────────────

describe('DELETE /api/v1/tasks/:id', () => {
  it('soft deletes a task', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/tasks/1',
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
      url: '/api/v1/tasks/1',
    });

    expect(response.statusCode).toBe(500);
  });
});
