import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { settingsRoutes } from './settings';

async function buildApp() {
  const app = Fastify();
  await app.register(settingsRoutes, { prefix: '/api/v1/settings' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /profile - Get user profile ──────────────────────────────

describe('GET /api/v1/settings/profile', () => {
  it('returns the current user profile', async () => {
    const user = {
      id: 'user-1',
      first_name: 'Sarah',
      last_name: 'Mitchell',
      email: 'sarah@realflow.com.au',
      phone: '0412000001',
      role: 'principal',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: user, error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/profile',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.first_name).toBe('Sarah');
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/profile',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PATCH /profile - Update profile ──────────────────────────────

describe('PATCH /api/v1/settings/profile', () => {
  it('updates the user profile successfully', async () => {
    const updatedUser = {
      id: 'user-1',
      first_name: 'Sarah',
      last_name: 'Chen',
      email: 'sarah@realflow.com.au',
    };

    // Mock user lookup + update
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: get user ID
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'user-1' },
              error: null,
            }),
          }),
        };
      }
      // Second call: update
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedUser,
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings/profile',
      payload: { lastName: 'Chen' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.last_name).toBe('Chen');
  });

  it('returns 400 for invalid email', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings/profile',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /integrations - List integrations ────────────────────────

describe('GET /api/v1/settings/integrations', () => {
  it('returns integration list with statuses', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Users table
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'user-1' },
              error: null,
            }),
          }),
        };
      }
      if (callCount === 2) {
        // Integration connections
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { provider: 'gmail', is_active: true, last_sync_at: '2026-01-01T00:00:00Z' },
              ],
              error: null,
            }),
          }),
        };
      }
      // OAuth tokens
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { provider: 'gmail', account_email: 'sarah@gmail.com', expires_at: '2026-12-31T00:00:00Z' },
            ],
            error: null,
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/integrations',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 401 when user not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/integrations',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /integrations/:provider/connect ─────────────────────────

describe('POST /api/v1/settings/integrations/:provider/connect', () => {
  it('returns OAuth URL for Gmail', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/integrations/gmail/connect',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.oauthUrl).toContain('accounts.google.com');
  });

  it('returns 400 for unsupported provider', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/integrations/unsupported/connect',
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── DELETE /integrations/:provider ───────────────────────────────

describe('DELETE /api/v1/settings/integrations/:provider', () => {
  it('disconnects an integration', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Users table
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'user-1' },
              error: null,
            }),
          }),
        };
      }
      if (callCount === 2) {
        // Delete OAuth tokens
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      // Update integration_connections
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/settings/integrations/gmail',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });
});
