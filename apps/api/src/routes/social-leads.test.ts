import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// ─── Set env vars before module imports ───────────────────────────────────────
// The env module (apps/api/src/config/env.ts) is parsed at import time.
// We must set META_APP_SECRET in process.env BEFORE importing the route.
// vi.hoisted() runs before all imports, making it safe to set these here.

vi.hoisted(() => {
  process.env['META_APP_SECRET'] = 'test-meta-app-secret';
});

import Fastify from 'fastify';
import { socialLeadRoutes } from './social-leads';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OFFICE_ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const LEAD_ID = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';
const CONTACT_ID = 'd1b2c3d4-e5f6-7890-abcd-ef1234567893';

const NOW = new Date().toISOString();

const META_APP_SECRET = 'test-meta-app-secret';

// ─── HMAC helper ──────────────────────────────────────────────────────────────

function makeMetaSignature(body: unknown): string {
  const bodyBuf = Buffer.from(JSON.stringify(body));
  const hash = crypto.createHmac('sha256', META_APP_SECRET).update(bodyBuf).digest('hex');
  return `sha256=${hash}`;
}

// ─── Engine mock ──────────────────────────────────────────────────────────────

const mockEngine = {
  ingestDm: vi.fn(),
  convertToContact: vi.fn(),
  dismissLead: vi.fn(),
  getById: vi.fn(),
  listLeads: vi.fn(),
  getLeadStats: vi.fn(),
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock('@realflow/business-logic', () => {
  function SocialLeadEngine() {
    return mockEngine;
  }
  return { SocialLeadEngine };
});

import { createSupabaseClient, createSupabaseServiceClient } from '../middleware/supabase';

// ─── Supabase mock helpers ─────────────────────────────────────────────────────

function makeChainFor(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

function makeSupabase(
  user: { id: string } | null = { id: AGENT_ID },
  officeRow: { office_id: string } | null = { office_id: OFFICE_ID },
) {
  return {
    from: vi.fn(() => makeChainFor(officeRow)),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user },
          error: user ? null : { message: 'Not authenticated' },
        }),
      ),
    },
  };
}

function makeLead(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: LEAD_ID,
    channel: 'facebook_dm',
    externalId: 'msg_abc',
    senderName: 'Jane Smith',
    senderHandle: 'janesmith',
    messageText: 'Hello',
    status: 'pending',
    contactId: null,
    agentId: AGENT_ID,
    officeId: OFFICE_ID,
    createdAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(socialLeadRoutes);
  return app;
}

// ─── POST /social/dms/ingest ──────────────────────────────────────────────────

describe('POST /social/dms/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.ingestDm.mockResolvedValue(makeLead());
  });

  it('returns 201 with the created lead', async () => {
    vi.mocked(createSupabaseServiceClient).mockReturnValue(makeSupabase() as never);

    const payload = {
      channel: 'facebook_dm',
      externalId: 'msg_abc',
      messageText: 'Hello',
      agentId: AGENT_ID,
      officeId: OFFICE_ID,
    };

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/social/dms/ingest',
      headers: { 'x-hub-signature-256': makeMetaSignature(payload) },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(LEAD_ID);
    expect(body.data.channel).toBe('facebook_dm');
  });

  it('returns 400 when agentId is missing', async () => {
    // POST /social/dms/ingest is a server-to-server webhook (no user JWT);
    // agentId is now a required field in the webhook payload.
    const payload = {
      channel: 'facebook_dm',
      externalId: 'msg_abc',
      messageText: 'Hello',
      officeId: OFFICE_ID,
    };
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/social/dms/ingest',
      headers: { 'x-hub-signature-256': makeMetaSignature(payload) },
      payload,
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid payload (missing messageText)', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const payload = { channel: 'facebook_dm', externalId: 'msg_abc' };
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/social/dms/ingest',
      headers: { 'x-hub-signature-256': makeMetaSignature(payload) },
      payload,
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid channel', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const payload = { channel: 'twitter_dm', externalId: 'msg_abc', messageText: 'Hello' };
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/social/dms/ingest',
      headers: { 'x-hub-signature-256': makeMetaSignature(payload) },
      payload,
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for invalid HMAC signature', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/social/dms/ingest',
      headers: {
        'x-hub-signature-256':
          'sha256=invalidsignature00000000000000000000000000000000000000000000000000',
      },
      payload: {
        channel: 'facebook_dm',
        externalId: 'msg_abc',
        messageText: 'Hello',
        agentId: AGENT_ID,
        officeId: OFFICE_ID,
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when agentId is not a known user', async () => {
    // H4 fix: agentId must be verified against our users table
    vi.mocked(createSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => makeChainFor(null)),
    } as never);

    const payload = {
      channel: 'facebook_dm',
      externalId: 'msg_abc',
      messageText: 'Hello',
      agentId: AGENT_ID,
      officeId: OFFICE_ID,
    };

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/social/dms/ingest',
      headers: { 'x-hub-signature-256': makeMetaSignature(payload) },
      payload,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid agentId');
  });
});

// ─── GET /social/leads ────────────────────────────────────────────────────────

describe('GET /social/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.listLeads.mockResolvedValue([makeLead()]);
  });

  it('returns 200 with leads list', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/social/leads' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/social/leads' });

    expect(res.statusCode).toBe(401);
  });

  it('accepts status query param', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);
    mockEngine.listLeads.mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/social/leads?status=pending' });

    expect(res.statusCode).toBe(200);
    expect(mockEngine.listLeads).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'pending' }),
    );
  });
});

// ─── GET /social/leads/:id ────────────────────────────────────────────────────

describe('GET /social/leads/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getById.mockResolvedValue(makeLead());
  });

  it('returns 200 for own lead', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(LEAD_ID);
  });

  it("returns 403 for another agent's lead", async () => {
    const otherAgentLead = makeLead({ agentId: 'ffffffff-e5f6-7890-abcd-ef1234567890' });
    mockEngine.getById.mockResolvedValue(otherAgentLead);
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(403);
  });
});

// ─── POST /social/leads/:id/convert ───────────────────────────────────────────

describe('POST /social/leads/:id/convert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.convertToContact.mockResolvedValue(CONTACT_ID);
  });

  it('returns 201 with contactId', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/social/leads/${LEAD_ID}/convert`,
      payload: { firstName: 'Jane', email: 'jane@example.com' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.contactId).toBe(CONTACT_ID);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/social/leads/${LEAD_ID}/convert` });

    expect(res.statusCode).toBe(401);
  });
});

// ─── DELETE /social/leads/:id ─────────────────────────────────────────────────

describe('DELETE /social/leads/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.dismissLead.mockResolvedValue(undefined);
  });

  it('returns 204 on success', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(204);
  });
});

// ─── GET /social/leads/stats ──────────────────────────────────────────────────

describe('GET /social/leads/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getLeadStats.mockResolvedValue({
      total: 10,
      pending: 3,
      converted: 6,
      dismissed: 1,
      conversionRate: 60,
      byChannel: { facebook_dm: 5, instagram_dm: 3, linkedin_dm: 2 },
    });
  });

  it('returns 200 with stats', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/social/leads/stats' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.total).toBe(10);
    expect(body.data.conversionRate).toBe(60);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/social/leads/stats' });

    expect(res.statusCode).toBe(401);
  });

  it('accepts from/to query params', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/social/leads/stats?from=2026-01-01&to=2026-03-31',
    });

    expect(res.statusCode).toBe(200);
    expect(mockEngine.getLeadStats).toHaveBeenCalledWith(
      AGENT_ID,
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('returns 500 on engine error', async () => {
    mockEngine.getLeadStats.mockRejectedValue(new Error('Stats query failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/social/leads/stats' });

    expect(res.statusCode).toBe(500);
  });
});

// ─── GET /social/leads/:id - additional branches ──────────────────────────────

describe('GET /social/leads/:id - additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when lead is null', async () => {
    mockEngine.getById.mockResolvedValue(null);
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when engine throws PGRST116 error', async () => {
    mockEngine.getById.mockRejectedValue(new Error('PGRST116: no rows returned'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(404);
  });

  it('returns 500 on generic engine error', async () => {
    mockEngine.getById.mockRejectedValue(new Error('Connection refused'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(500);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /social/leads - additional branches ──────────────────────────────────

describe('GET /social/leads - additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.listLeads.mockResolvedValue([makeLead()]);
  });

  it('returns 500 on engine error', async () => {
    mockEngine.listLeads.mockRejectedValue(new Error('DB failure'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/social/leads' });

    expect(res.statusCode).toBe(500);
  });

  it('accepts limit and offset query params', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/social/leads?limit=10&offset=20',
    });

    expect(res.statusCode).toBe(200);
    expect(mockEngine.listLeads).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });
});

// ─── POST /social/leads/:id/convert - additional branches ─────────────────────

describe('POST /social/leads/:id/convert - additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.convertToContact.mockResolvedValue(CONTACT_ID);
  });

  it('returns 500 on engine error', async () => {
    mockEngine.convertToContact.mockRejectedValue(new Error('Conversion failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/social/leads/${LEAD_ID}/convert`,
      payload: { firstName: 'Jane' },
    });

    expect(res.statusCode).toBe(500);
  });
});

// ─── DELETE /social/leads/:id - additional branches ───────────────────────────

describe('DELETE /social/leads/:id - additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.dismissLead.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on engine error', async () => {
    mockEngine.dismissLead.mockRejectedValue(new Error('Delete failed'));
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/social/leads/${LEAD_ID}` });

    expect(res.statusCode).toBe(500);
  });
});

// ─── POST /social/dms/ingest - additional branches ────────────────────────────

describe('POST /social/dms/ingest - additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.ingestDm.mockResolvedValue(makeLead());
  });

  it('returns 500 on engine ingestDm error', async () => {
    mockEngine.ingestDm.mockRejectedValue(new Error('Ingest failed'));
    vi.mocked(createSupabaseServiceClient).mockReturnValue(makeSupabase() as never);

    const payload = {
      channel: 'facebook_dm',
      externalId: 'msg_error_test',
      messageText: 'Hello',
      agentId: AGENT_ID,
      officeId: OFFICE_ID,
    };

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/social/dms/ingest',
      headers: { 'x-hub-signature-256': makeMetaSignature(payload) },
      payload,
    });

    expect(res.statusCode).toBe(500);
  });
});
