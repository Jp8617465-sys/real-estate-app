import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock Integration Registry ─────────────────────────────────────

vi.mock('../services/integration-registry', () => ({
  IntegrationRegistry: vi.fn(function (this: Record<string, unknown>) {
    this.getMetaClient = vi.fn().mockResolvedValue(null);
    this.getLinkedInClient = vi.fn().mockResolvedValue(null);
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { socialPostRoutes } from './social-posts';

async function buildApp() {
  const app = Fastify();
  await app.register(socialPostRoutes, { prefix: '/api/v1/social-posts' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List social posts ────────────────────────────────────

describe('GET /api/v1/social-posts', () => {
  it('returns social post list', async () => {
    const posts = [
      { id: '1', platform: 'facebook', content: 'Hello world', status: 'draft' },
      { id: '2', platform: 'instagram', content: 'Check this out', status: 'scheduled' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: posts, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts',
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
            error: { message: 'DB connection failed' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get single post ───────────────────────────────────

describe('GET /api/v1/social-posts/:id', () => {
  it('returns a single post', async () => {
    const post = { id: '1', platform: 'facebook', content: 'Test post', status: 'draft' };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: post, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.platform).toBe('facebook');
  });

  it('returns 404 when post not found', async () => {
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
      url: '/api/v1/social-posts/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create social post ──────────────────────────────────

describe('POST /api/v1/social-posts', () => {
  it('creates a post successfully', async () => {
    const validBody = {
      platforms: ['facebook'],
      content: 'New listing at 42 Ocean St, Bondi!',
    };

    // Mock user lookup
    const userMock = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1' },
          error: null,
        }),
      }),
    };

    // Mock insert
    const insertMock = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-1', ...validBody },
          error: null,
        }),
      }),
    };

    const socialPostMock = {
      insert: vi.fn().mockReturnValue(insertMock),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return userMock; // users table
      return socialPostMock; // social_posts table
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts',
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 400 for invalid input', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts',
      payload: { platform: 'invalid_platform' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── DELETE /:id - Soft delete post ───────────────────────────────

describe('DELETE /api/v1/social-posts/:id', () => {
  it('soft deletes a post', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // select status lookup
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
              }),
            }),
          }),
        };
      }
      // update call
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/social-posts/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('returns 500 on delete error', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/social-posts/1',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET / - List with filters ────────────────────────────────────

describe('GET /api/v1/social-posts with filters', () => {
  it('applies status filter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts?status=scheduled',
    });

    expect(response.statusCode).toBe(200);
  });

  it('applies platform filter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            contains: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts?platform=instagram',
    });

    expect(response.statusCode).toBe(200);
  });

  it('applies dateFrom filter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts?dateFrom=2026-01-01',
    });

    expect(response.statusCode).toBe(200);
  });

  it('applies dateTo filter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts?dateTo=2026-03-31',
    });

    expect(response.statusCode).toBe(200);
  });

  it('applies propertyId filter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts?propertyId=00000000-0000-0000-0000-000000000099',
    });

    expect(response.statusCode).toBe(200);
  });
});

// ─── POST / - Create with character limit violation ───────────────

describe('POST /api/v1/social-posts character limit', () => {
  it('returns 400 when content exceeds platform character limit', async () => {
    // Twitter has a 280-char limit — send content that exceeds it
    const longContent = 'x'.repeat(300);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts',
      payload: {
        platforms: ['twitter'],
        content: longContent,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when user lookup returns no user', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts',
      payload: {
        platforms: ['facebook'],
        content: 'Short post',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on insert error', async () => {
    const userMock = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null }),
      }),
    };
    const insertMock = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
        }),
      }),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return userMock;
      return insertMock;
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts',
      payload: { platforms: ['facebook'], content: 'Test post' },
    });

    expect(response.statusCode).toBe(500);
  });

  it('sets status to scheduled when scheduledAt is provided', async () => {
    const userMock = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null }),
      }),
    };
    const insertMock = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: '00000000-0000-0000-0000-000000000002', status: 'scheduled' },
            error: null,
          }),
        }),
      }),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return userMock;
      return insertMock;
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts',
      payload: {
        platforms: ['facebook'],
        content: 'Scheduled post',
        scheduledAt: '2026-04-01T09:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(201);
  });
});

// ─── PUT /:id - Update post ────────────────────────────────────────

describe('PUT /api/v1/social-posts/:id', () => {
  it('returns 400 for invalid body', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/social-posts/1',
      payload: { status: 'invalid_status_value' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when post not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/social-posts/missing-id',
      payload: { content: 'Updated content' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400 when trying to update a published post', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { status: 'published' }, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/social-posts/1',
      payload: { content: 'Try to update published post' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toContain('draft or scheduled');
  });

  it('returns 500 on update database error', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
              }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/social-posts/1',
      payload: { content: 'Updated content' },
    });

    expect(response.statusCode).toBe(500);
  });

  it('updates successfully for a draft post', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: '1', content: 'Updated content', status: 'draft' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/social-posts/1',
      payload: { content: 'Updated content' },
    });

    expect(response.statusCode).toBe(200);
  });
});

// ─── DELETE /:id - with scheduled status ──────────────────────────

describe('DELETE /api/v1/social-posts/:id (scheduled branch)', () => {
  it('returns 404 when post not found on delete', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/social-posts/missing',
    });

    expect(response.statusCode).toBe(404);
  });

  it('cancels scheduled post on delete (sets status to draft)', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { status: 'scheduled' }, error: null }),
              }),
            }),
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
      method: 'DELETE',
      url: '/api/v1/social-posts/1',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).success).toBe(true);
  });
});

// ─── GET /:id/analytics ───────────────────────────────────────────

describe('GET /api/v1/social-posts/:id/analytics', () => {
  it('returns analytics for a post', async () => {
    const analyticsData = {
      id: '1',
      analytics: { views: 100, likes: 20 },
      platform_results: [],
      status: 'published',
      platforms: ['facebook'],
      published_at: '2026-03-01T09:00:00Z',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: analyticsData, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts/1/analytics',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.analytics.views).toBe(100);
  });

  it('returns 404 when post not found for analytics', async () => {
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
      url: '/api/v1/social-posts/missing/analytics',
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /accounts ────────────────────────────────────────────────

describe('GET /api/v1/social-posts/accounts', () => {
  it('returns connected social accounts', async () => {
    const accounts = [{ id: 'acc-1', platform: 'facebook', is_active: true }];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: accounts, error: null }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts/accounts',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
  });

  it('returns 401 when user not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts/accounts',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on accounts DB error', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/social-posts/accounts',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /accounts/connect ───────────────────────────────────────

describe('POST /api/v1/social-posts/accounts/connect', () => {
  it('returns 400 for invalid payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts/accounts/connect',
      payload: { platform: 'invalid_platform' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when user not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts/accounts/connect',
      payload: {
        platform: 'facebook',
        authCode: 'oauth-code-123',
        redirectUri: 'https://app.realflow.com/oauth/callback',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('connects a social account successfully', async () => {
    const userMock = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null }),
      }),
    };
    const insertMock = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'acc-new', platform: 'facebook', is_active: true },
            error: null,
          }),
        }),
      }),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return userMock;
      return insertMock;
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts/accounts/connect',
      payload: {
        platform: 'facebook',
        authCode: 'oauth-code-abc',
        redirectUri: 'https://app.realflow.com/oauth/callback',
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 500 on insert error when connecting account', async () => {
    const userMock = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null }),
      }),
    };
    const insertMock = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
        }),
      }),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return userMock;
      return insertMock;
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts/accounts/connect',
      payload: {
        platform: 'facebook',
        authCode: 'oauth-code-abc',
        redirectUri: 'https://app.realflow.com/oauth/callback',
      },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /:id/publish - Publish post ─────────────────────────────

describe('POST /api/v1/social-posts/:id/publish', () => {
  it('returns 404 when post not found', async () => {
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
      method: 'POST',
      url: '/api/v1/social-posts/nonexistent/publish',
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400 when post is already published', async () => {
    const post = {
      id: '1',
      platforms: ['facebook'],
      content: 'Test post',
      status: 'published',
      media_urls: [],
      created_by: '00000000-0000-0000-0000-000000000001',
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: post, error: null }),
              }),
            }),
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
      method: 'POST',
      url: '/api/v1/social-posts/1/publish',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Post is already published');
  });

  it('returns 400 when post is currently being published', async () => {
    const post = {
      id: '1',
      platforms: ['facebook'],
      content: 'Test post',
      status: 'publishing',
      media_urls: [],
      created_by: '00000000-0000-0000-0000-000000000001',
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: post, error: null }),
              }),
            }),
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
      method: 'POST',
      url: '/api/v1/social-posts/1/publish',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Post is currently being published');
  });

  it('returns 400 when Meta integration not connected', async () => {
    const post = {
      id: '1',
      platforms: ['facebook'],
      content: 'Test post',
      status: 'draft',
      media_urls: [],
      created_by: 'user-1',
    };

    // Post lookup, then status revert update
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // social_posts lookup
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: post, error: null }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // social_posts update (mark as publishing)
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      // social_posts update (revert to draft) or other calls
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts/1/publish',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Meta integration not connected');
  });

  it('returns 400 when LinkedIn integration not connected', async () => {
    const post = {
      id: '1',
      platforms: ['linkedin'],
      content: 'LinkedIn post',
      status: 'draft',
      media_urls: [],
      created_by: '00000000-0000-0000-0000-000000000001',
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: post, error: null }),
              }),
            }),
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
      method: 'POST',
      url: '/api/v1/social-posts/1/publish',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('LinkedIn integration not connected');
  });
});

// ─── POST /publish-scheduled ──────────────────────────────────────

describe('POST /api/v1/social-posts/publish-scheduled', () => {
  it('returns 500 on fetch error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts/publish-scheduled',
    });

    expect(response.statusCode).toBe(500);
  });

  it('returns success when no due posts exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/social-posts/publish-scheduled',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.processed).toBe(0);
  });
});
