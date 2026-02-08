import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { webhookRoutes } from './webhooks';

async function buildApp() {
  const app = Fastify();
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /domain/enquiry ──────────────────────────────────────────

describe('POST /api/v1/webhooks/domain/enquiry', () => {
  it('creates a contact from Domain enquiry', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-contact-1',
              first_name: 'John',
              last_name: 'Smith',
              source: 'domain',
            },
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/domain/enquiry',
      payload: {
        enquirerName: 'John Smith',
        enquirerEmail: 'john@example.com',
        enquirerPhone: '0412345678',
        listingId: 'DOM-123',
        message: 'I am interested in this property',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.source).toBe('domain');
    expect(body.data.first_name).toBe('John');
  });

  it('handles enquiry with only email (no phone)', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-2', first_name: 'Jane' },
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/domain/enquiry',
      payload: {
        enquirerName: 'Jane Doe',
        enquirerEmail: 'jane@example.com',
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 400 when missing both phone and email', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/domain/enquiry',
      payload: {
        enquirerName: 'Unknown Person',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Missing contact information');
  });

  it('handles enquiry with no name gracefully', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-3', first_name: 'Unknown', last_name: 'Unknown' },
            error: null,
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/domain/enquiry',
      payload: {
        enquirerPhone: '0400000000',
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 500 on database insert failure', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert failed' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/domain/enquiry',
      payload: {
        enquirerName: 'Test User',
        enquirerEmail: 'test@example.com',
      },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /meta/lead ───────────────────────────────────────────────

describe('POST /api/v1/webhooks/meta/lead', () => {
  it('acknowledges receipt of Meta lead webhook', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/meta/lead',
      payload: {
        entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id: '123' } }] }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
  });
});

// ─── POST /test ────────────────────────────────────────────────────

describe('POST /api/v1/webhooks/test', () => {
  it('echoes back the request body', async () => {
    const app = await buildApp();
    const payload = { test: true, data: 'hello' };
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/test',
      payload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
    expect(body.body).toEqual(payload);
  });
});
