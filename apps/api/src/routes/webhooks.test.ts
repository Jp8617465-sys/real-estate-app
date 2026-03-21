import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// ─── Set env vars before module imports ───────────────────────────────────────
// The env module is parsed at import time; vi.hoisted() runs before all imports.

vi.hoisted(() => {
  process.env['DOMAIN_WEBHOOK_SECRET'] = 'test-domain-secret';
  process.env['META_APP_SECRET'] = 'test-meta-app-secret';
});

// ─── Mock Supabase ─────────────────────────────────────────────────

const hoisted = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => ({ from: hoisted.mockFrom }),
  createSupabaseServiceClient: () => ({ from: hoisted.mockFrom }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { webhookRoutes } from './webhooks';

// ─── Signature helpers ────────────────────────────────────────────
// Must mirror the exact logic in webhooks.ts

function makeDomainSignature(body: unknown): string {
  const payload = JSON.stringify(body);
  return crypto.createHmac('sha256', 'test-domain-secret').update(payload).digest('hex');
}

function makeMetaSignature(body: unknown): string {
  const payload = JSON.stringify(body);
  return (
    'sha256=' + crypto.createHmac('sha256', 'test-meta-app-secret').update(payload).digest('hex')
  );
}

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
    const payload = {
      enquirerName: 'John Smith',
      enquirerEmail: 'john@example.com',
      enquirerPhone: '0412345678',
      listingId: 'DOM-123',
      message: 'I am interested in this property',
    };

    hoisted.mockFrom.mockReturnValue({
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
      headers: { 'x-domain-signature': makeDomainSignature(payload) },
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.source).toBe('domain');
    expect(body.data.first_name).toBe('John');
  });

  it('handles enquiry with only email (no phone)', async () => {
    const payload = {
      enquirerName: 'Jane Doe',
      enquirerEmail: 'jane@example.com',
    };

    hoisted.mockFrom.mockReturnValue({
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
      headers: { 'x-domain-signature': makeDomainSignature(payload) },
      payload,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 400 when missing both phone and email', async () => {
    const payload = {
      enquirerName: 'Unknown Person',
    };

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/domain/enquiry',
      headers: { 'x-domain-signature': makeDomainSignature(payload) },
      payload,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Missing contact information');
  });

  it('handles enquiry with no name gracefully', async () => {
    const payload = {
      enquirerPhone: '0400000000',
    };

    hoisted.mockFrom.mockReturnValue({
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
      headers: { 'x-domain-signature': makeDomainSignature(payload) },
      payload,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 401 for invalid Domain webhook signature', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/domain/enquiry',
      headers: { 'x-domain-signature': 'invalidsignature' },
      payload: { enquirerEmail: 'test@example.com' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 500 on database insert failure', async () => {
    const payload = {
      enquirerName: 'Test User',
      enquirerEmail: 'test@example.com',
    };

    hoisted.mockFrom.mockReturnValue({
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
      headers: { 'x-domain-signature': makeDomainSignature(payload) },
      payload,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /meta/lead ───────────────────────────────────────────────

describe('POST /api/v1/webhooks/meta/lead', () => {
  it('acknowledges receipt of Meta lead webhook', async () => {
    const payload = {
      entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id: '123' } }] }],
    };

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/meta/lead',
      headers: { 'x-hub-signature-256': makeMetaSignature(payload) },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
  });

  it('returns 401 for invalid Meta webhook signature', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/meta/lead',
      headers: {
        'x-hub-signature-256':
          'sha256=invalidsignature0000000000000000000000000000000000000000000000000',
      },
      payload: { entry: [] },
    });

    expect(response.statusCode).toBe(401);
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
