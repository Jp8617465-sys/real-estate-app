import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockSupabase = {
  from: mockFrom,
  auth: { getUser: mockGetUser },
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { notificationRoutes } from './notifications';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

async function buildApp() {
  const app = Fastify();
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: MOCK_USER_ID } },
    error: null,
  });
});

// ─── GET / - List notifications ───────────────────────────────────

describe('GET /api/v1/notifications', () => {
  it('returns notifications for authenticated user', async () => {
    const notifications = [
      { id: '00000000-0000-0000-0000-000000000010', type: 'new_lead', status: 'sent' },
      { id: '00000000-0000-0000-0000-000000000011', type: 'property_match', status: 'read' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: notifications, error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /unread-count ────────────────────────────────────────────

describe('GET /api/v1/notifications/unread-count', () => {
  it('returns unread count', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.count).toBe(5);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /:id/read ───────────────────────────────────────────────

describe('POST /api/v1/notifications/:id/read', () => {
  const notificationId = '00000000-0000-0000-0000-000000000010';

  it('marks notification as read', async () => {
    const updated = { id: notificationId, status: 'read' };

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
      method: 'POST',
      url: `/api/v1/notifications/${notificationId}/read`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 404 when notification not found', async () => {
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
      url: `/api/v1/notifications/${notificationId}/read`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST /:id/dismiss ────────────────────────────────────────────

describe('POST /api/v1/notifications/:id/dismiss', () => {
  const notificationId = '00000000-0000-0000-0000-000000000010';

  it('dismisses a notification', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${notificationId}/dismiss`,
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
      method: 'POST',
      url: `/api/v1/notifications/${notificationId}/dismiss`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /:id/snooze ─────────────────────────────────────────────

describe('POST /api/v1/notifications/:id/snooze', () => {
  const notificationId = '00000000-0000-0000-0000-000000000010';

  it('snoozes a notification', async () => {
    const updated = { id: notificationId, status: 'snoozed' };

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
      method: 'POST',
      url: `/api/v1/notifications/${notificationId}/snooze`,
      headers: { authorization: BEARER },
      payload: { minutes: 30 },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 404 when notification not found', async () => {
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
      url: `/api/v1/notifications/${notificationId}/snooze`,
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /preferences ────────────────────────────────────────────

describe('GET /api/v1/notifications/preferences', () => {
  it('returns notification preferences', async () => {
    const prefs = {
      id: '00000000-0000-0000-0000-000000000020',
      user_id: MOCK_USER_ID,
      notify_new_lead: true,
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: prefs, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns default preferences when none exist', async () => {
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
      url: '/api/v1/notifications/preferences',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.notifyNewLead).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── PATCH /preferences - Update preferences ──────────────────────

describe('PATCH /api/v1/notifications/preferences', () => {
  it('updates notification preferences (upsert — existing)', async () => {
    const existing = { id: '00000000-0000-0000-0000-000000000020' };
    const updated = { id: '00000000-0000-0000-0000-000000000020', notify_new_lead: false };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: existing, error: null }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: BEARER },
      payload: { notifyNewLead: false },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: BEARER },
      payload: { notifyNewLead: false },
    });

    expect(response.statusCode).toBe(401);
  });
});
