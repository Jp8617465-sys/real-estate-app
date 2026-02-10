import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock Integration Registry ─────────────────────────────────────

vi.mock('../services/integration-registry', () => ({
  IntegrationRegistry: vi.fn().mockImplementation(() => ({
    getMetaClient: vi.fn().mockResolvedValue(null),
  })),
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
      platform: 'facebook',
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
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
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
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/social-posts/1',
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

  it('returns 400 when Meta integration not connected', async () => {
    const post = {
      id: '1',
      platform: 'facebook',
      content: 'Test post',
      status: 'draft',
      image_url: null,
      created_by: 'user-1',
    };

    // Post lookup, then user lookup
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
      // users lookup
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-1' },
            error: null,
          }),
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
});
