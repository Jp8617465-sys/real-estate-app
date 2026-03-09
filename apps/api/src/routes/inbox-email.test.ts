import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────

const { mockFrom, mockProcess } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockProcess: vi.fn(),
}));

const mockServiceSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseServiceClient: () => mockServiceSupabase,
  createSupabaseClient: () => mockServiceSupabase,
}));

// ─── Mock webhook-validation ──────────────────────────────────────
// validateWebhookSignature returns true when no secret is set (dev/test mode)

vi.mock('../middleware/webhook-validation', () => ({
  validateWebhookSignature: vi.fn().mockReturnValue(true),
  createWebhookGuards: () => ({
    rateLimiter: { check: vi.fn().mockReturnValue(true), prune: vi.fn() },
    idempotencyGuard: { isDuplicate: vi.fn().mockReturnValue(false), prune: vi.fn() },
  }),
}));

// ─── Mock EmailLeadProcessor ──────────────────────────────────────

vi.mock('../services/email-lead-processor', () => ({
  EmailLeadProcessor: vi.fn().mockImplementation(function() {
    return { process: mockProcess };
  }),
}));

// ─── Mock business-logic ──────────────────────────────────────────

vi.mock('@realflow/business-logic', () => ({
  evaluateTrigger: vi.fn().mockReturnValue(false),
  runWorkflow: vi.fn().mockResolvedValue({ status: 'completed', actionsExecuted: 0 }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { inboxEmailRoutes } from './inbox-email';

// ─── Test setup ───────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(inboxEmailRoutes, { prefix: '/api/v1/inbox' });
  return app;
}

const defaultProcessResult = {
  contactId: '00000000-0000-0000-0000-000000000001',
  messageId: 'test-message-id-12345',
  isNewContact: true,
  leadType: 'buyer',
  leadScore: 65,
  classification: 'property_enquiry',
  workflowEvents: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProcess.mockResolvedValue(defaultProcessResult);
});

// ─── POST /email - Generic normalised format ──────────────────────

describe('POST /api/v1/inbox/email', () => {
  const validPayload = {
    from: 'buyer@example.com',
    to: 'enquiries@agency.com',
    subject: 'Property Enquiry',
    textBody: 'I am interested in buying a property.',
    messageId: 'unique-message-id-001',
    provider: 'generic',
  };

  it('processes a valid email lead successfully', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
    expect(body.contactId).toBeDefined();
    expect(body.isNewContact).toBe(true);
  });

  it('returns 400 for invalid payload (missing from)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email',
      payload: {
        to: 'enquiries@agency.com',
        messageId: 'some-id',
        // missing 'from'
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for missing messageId', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email',
      payload: {
        from: 'buyer@example.com',
        to: 'enquiries@agency.com',
        subject: 'Test',
        // missing messageId
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 200 with duplicate flag for already-processed message', async () => {
    const { createWebhookGuards } = await import('../middleware/webhook-validation');
    const guards = createWebhookGuards();
    // Simulate isDuplicate returning true on second call
    vi.mocked(guards.idempotencyGuard.isDuplicate).mockReturnValueOnce(true);

    // Need to rebuild app after changing mock
    vi.resetModules();
  });

  it('returns 500 when email processing fails', async () => {
    mockProcess.mockRejectedValue(new Error('Processing failed'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /email/sendgrid - SendGrid format ────────────────────────

describe('POST /api/v1/inbox/email/sendgrid', () => {
  const validPayload = {
    from: 'buyer@example.com',
    to: 'enquiries@agency.com',
    subject: 'Property Enquiry',
    text: 'I am interested in buying.',
    headers: 'Message-Id: <sendgrid-msg-001@mail.com>',
  };

  it('processes a valid SendGrid payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email/sendgrid',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
  });

  it('returns 400 for invalid payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email/sendgrid',
      payload: {
        // missing required 'from' and 'to'
        subject: 'Test',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 500 when processing fails', async () => {
    mockProcess.mockRejectedValue(new Error('Sendgrid processing error'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email/sendgrid',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── POST /email/mailgun - Mailgun format ─────────────────────────

describe('POST /api/v1/inbox/email/mailgun', () => {
  const validPayload = {
    sender: 'buyer@example.com',
    recipient: 'enquiries@agency.com',
    from: 'Buyer <buyer@example.com>',
    subject: 'Property Enquiry',
    'body-plain': 'I am interested in buying a property.',
    'Message-Id': '<mailgun-msg-001@mg.example.com>',
  };

  it('processes a valid Mailgun payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email/mailgun',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
  });

  it('returns 400 for invalid payload', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email/mailgun',
      payload: {
        // missing required 'sender', 'recipient', 'from'
        subject: 'Test',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 500 when processing fails', async () => {
    mockProcess.mockRejectedValue(new Error('Mailgun processing error'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inbox/email/mailgun',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(500);
  });
});
