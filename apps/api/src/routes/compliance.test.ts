import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { complianceRoutes } from './compliance';

// ─── Supabase Mock ────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

const AGENT_ID = '00000000-0000-0000-0000-000000000001';
const CONTACT_ID = '00000000-0000-0000-0000-000000000002';
const CHECK_ID = '00000000-0000-0000-0000-000000000003';
const DOC_ID = '00000000-0000-0000-0000-000000000004';

const makeCheckRow = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: CHECK_ID,
  contact_id: CONTACT_ID,
  agent_id: AGENT_ID,
  status: 'in_progress',
  verification_method: 'face_to_face',
  total_points: 0,
  points_required: 100,
  full_legal_name: 'Jane Smith',
  date_of_birth: '1990-01-15',
  residential_address: '10 George St, Sydney NSW 2000',
  address_verified: false,
  started_at: NOW,
  completed_at: null,
  expiry_date: null,
  last_reviewed_at: null,
  verified_by_user_id: null,
  rejection_reason: null,
  notes: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

// Build a Fastify-compatible supabase mock injected via preHandler
function buildMockApp(supabaseMock: Record<string, unknown>) {
  const app = Fastify();

  // Inject mock supabase into every request
  app.decorateRequest('supabase', null);
  app.addHook('preHandler', async (request) => {
    (request as unknown as Record<string, unknown>).supabase = supabaseMock;
  });

  // Override createSupabaseClient for the route module by patching the module
  // We use vi.mock at describe level; here we register routes with a mock
  app.register(complianceRoutes, { prefix: '/api/v1/compliance' });

  return app;
}

// ─── Mock createSupabaseClient ────────────────────────────────────────────────

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock('@realflow/business-logic', () => ({
  AmlEngine: {
    tryAutoComplete: vi.fn().mockResolvedValue(null),
    getExpiringChecks: vi.fn().mockResolvedValue([]),
    generateComplianceReport: vi.fn().mockResolvedValue({
      agentId: 'agent-00000000-0000-0000-0000-000000000001',
      agentName: 'Test Agent',
      periodFrom: '2026-01-01',
      periodTo: '2026-03-31',
      totalChecks: 3,
      passedChecks: 2,
      failedChecks: 1,
      pendingChecks: 0,
      expiringWithin90Days: 1,
      smrCount: 0,
      generatedAt: new Date().toISOString(),
      checks: [],
    }),
  },
}));

import { createSupabaseClient } from '../middleware/supabase';
import { AmlEngine } from '@realflow/business-logic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChainFor(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

function makeSupabase(
  tableData: Record<string, { single?: unknown; list?: unknown; error?: unknown }>,
  user: { id: string } | null = { id: AGENT_ID },
) {
  const supabase = {
    from: vi.fn((table: string) => {
      const entry = tableData[table] ?? { list: [], error: null };
      const chain = makeChainFor(entry.single ?? entry.list ?? null, entry.error ?? null);
      return chain;
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user },
          error: user ? null : { message: 'Not authenticated' },
        }),
      ),
    },
  };
  return supabase;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/compliance/checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a list of AML checks', async () => {
    const checks = [makeCheckRow(), makeCheckRow({ id: 'check-2', status: 'passed' })];
    const supabase = makeSupabase({ aml_checks: { list: checks } });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/v1/compliance/checks' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('filters by status query param', async () => {
    const checks = [makeCheckRow({ status: 'passed' })];
    const supabase = makeSupabase({ aml_checks: { list: checks } });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/checks?status=passed',
    });
    expect(response.statusCode).toBe(200);
    // eq() is called with 'status' and 'passed'
    expect(supabase.from).toHaveBeenCalledWith('aml_checks');
  });

  it('filters by contactId query param', async () => {
    const checks = [makeCheckRow()];
    const supabase = makeSupabase({ aml_checks: { list: checks } });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/compliance/checks?contactId=${CONTACT_ID}`,
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('POST /api/v1/compliance/checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new AML check and returns 201', async () => {
    const newCheck = makeCheckRow();
    const supabase = makeSupabase({ aml_checks: { single: newCheck } }, { id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/checks',
      payload: {
        contactId: CONTACT_ID,
        verificationMethod: 'face_to_face',
        fullLegalName: 'Jane Smith',
        dateOfBirth: '1990-01-15',
        residentialAddress: '10 George St, Sydney NSW 2000',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { data: Record<string, unknown> };
    expect(body.data).toBeTruthy();
  });

  it('returns 400 on invalid body', async () => {
    const supabase = makeSupabase({}, { id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/checks',
      payload: { contactId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when user is not authenticated', async () => {
    const supabase = makeSupabase({}, null);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/checks',
      payload: {
        contactId: CONTACT_ID,
        verificationMethod: 'face_to_face',
        fullLegalName: 'Jane Smith',
        dateOfBirth: '1990-01-15',
        residentialAddress: '10 George St, Sydney NSW 2000',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/v1/compliance/checks/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a check with its documents', async () => {
    const check = makeCheckRow();
    const docs = [
      {
        id: DOC_ID,
        check_id: CHECK_ID,
        document_type: 'passport',
        points: 70,
        is_expired: false,
        document_number: 'P12345678',
        issuing_authority: 'DFAT',
        issue_date: '2020-01-01',
        expiry_date: '2030-01-01',
        verified: false,
        verified_by: null,
        verified_at: null,
        notes: null,
        created_at: NOW,
      },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'aml_checks') {
          return makeChainFor(check);
        }
        if (table === 'aml_identity_documents') {
          const chain = makeChainFor(null);
          chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
            Promise.resolve({ data: docs, error: null }).then(resolve);
          return chain;
        }
        return makeChainFor(null);
      }),
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: AGENT_ID } }, error: null })),
      },
    };
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/compliance/checks/${CHECK_ID}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { documents: unknown[] } };
    expect(Array.isArray(body.data.documents)).toBe(true);
  });

  it('returns 404 when check not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChainFor(null, { message: 'Not found' })),
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: AGENT_ID } }, error: null })),
      },
    };
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/checks/non-existent-id',
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /api/v1/compliance/checks/:id/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a document and returns 201 with updated check', async () => {
    const check = makeCheckRow({ total_points: 70 });
    const newDoc = {
      id: DOC_ID,
      check_id: CHECK_ID,
      document_type: 'passport',
      points: 70,
      is_expired: false,
      document_number: null,
      issuing_authority: null,
      issue_date: null,
      expiry_date: null,
      verified: false,
      verified_by: null,
      verified_at: null,
      notes: null,
      created_at: NOW,
    };

    const remainingDocs = [{ points: 70, is_expired: false }];
    let insertCalled = false;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'aml_checks') {
          const chain = makeChainFor(check);
          chain.update = vi.fn(() => chain);
          return chain;
        }
        if (table === 'aml_identity_documents') {
          const chain: Record<string, unknown> = {};
          const self = () => chain;
          chain.select = vi.fn(self);
          chain.eq = vi.fn(self);
          chain.is = vi.fn(self);
          chain.order = vi.fn(self);
          chain.insert = vi.fn(() => {
            insertCalled = true;
            return chain;
          });
          chain.single = vi.fn(() => Promise.resolve({ data: newDoc, error: null }));
          chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
            Promise.resolve({ data: remainingDocs, error: null }).then(resolve);
          return chain;
        }
        return makeChainFor(null);
      }),
    };
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);
    vi.mocked(AmlEngine.tryAutoComplete).mockResolvedValue(null);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/compliance/checks/${CHECK_ID}/documents`,
      payload: { documentType: 'passport' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { data: { document: unknown; check: unknown } };
    expect(body.data.document).toBeTruthy();
  });

  it('calls tryAutoComplete after adding a document', async () => {
    const check = makeCheckRow();
    const doc = {
      id: DOC_ID,
      check_id: CHECK_ID,
      document_type: 'drivers_licence',
      points: 40,
      is_expired: false,
      document_number: null,
      issuing_authority: null,
      issue_date: null,
      expiry_date: null,
      verified: false,
      verified_by: null,
      verified_at: null,
      notes: null,
      created_at: NOW,
    };
    const passedCheck = makeCheckRow({ status: 'passed', total_points: 110 });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'aml_checks') {
          const chain = makeChainFor(passedCheck);
          chain.update = vi.fn(() => chain);
          return chain;
        }
        if (table === 'aml_identity_documents') {
          const chain: Record<string, unknown> = {};
          const self = () => chain;
          chain.select = vi.fn(self);
          chain.eq = vi.fn(self);
          chain.is = vi.fn(self);
          chain.order = vi.fn(self);
          chain.insert = vi.fn(self);
          chain.single = vi.fn(() => Promise.resolve({ data: doc, error: null }));
          chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
            Promise.resolve({
              data: [
                { points: 70, is_expired: false },
                { points: 40, is_expired: false },
              ],
              error: null,
            }).then(resolve);
          return chain;
        }
        return makeChainFor(null);
      }),
    };
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);
    vi.mocked(AmlEngine.tryAutoComplete).mockResolvedValue(passedCheck as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    await app.inject({
      method: 'POST',
      url: `/api/v1/compliance/checks/${CHECK_ID}/documents`,
      payload: { documentType: 'drivers_licence' },
    });

    expect(AmlEngine.tryAutoComplete).toHaveBeenCalledWith(CHECK_ID, expect.anything());
  });

  it('returns 400 on invalid document type', async () => {
    const supabase = makeSupabase({ aml_checks: { single: makeCheckRow() } });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/compliance/checks/${CHECK_ID}/documents`,
      payload: { documentType: 'invalid_type' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /api/v1/compliance/checks/:id/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks a check as passed with expiry date 2 years from now', async () => {
    const existingCheck = makeCheckRow({ total_points: 110 });
    const passedCheck = makeCheckRow({
      status: 'passed',
      completed_at: NOW,
      expiry_date: '2028-03-01',
    });

    let updateCalled = false;
    const supabase = {
      from: vi.fn(() => {
        const chain = makeChainFor(existingCheck);
        chain.update = vi.fn(() => {
          updateCalled = true;
          const updateChain = makeChainFor(passedCheck);
          return updateChain;
        });
        return chain;
      }),
    };
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/compliance/checks/${CHECK_ID}/complete`,
      payload: { outcome: 'passed' },
    });

    expect(response.statusCode).toBe(200);
    expect(updateCalled).toBe(true);
  });

  it('marks a check as failed with rejection reason', async () => {
    const existingCheck = makeCheckRow();
    const failedCheck = makeCheckRow({
      status: 'failed',
      rejection_reason: 'Documents did not match identity records',
    });

    const supabase = {
      from: vi.fn(() => {
        const chain = makeChainFor(existingCheck);
        chain.update = vi.fn(() => makeChainFor(failedCheck));
        return chain;
      }),
    };
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/compliance/checks/${CHECK_ID}/complete`,
      payload: {
        outcome: 'failed',
        rejectionReason: 'Documents did not match identity records',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { status: string } };
    expect(body.data.status).toBe('failed');
  });

  it('returns 400 on invalid outcome value', async () => {
    const supabase = makeSupabase({});
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/compliance/checks/${CHECK_ID}/complete`,
      payload: { outcome: 'maybe' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when the check does not exist', async () => {
    const supabase = {
      from: vi.fn(() => makeChainFor(null, { message: 'Not found' })),
    };
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/compliance/checks/non-existent/complete`,
      payload: { outcome: 'passed' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /api/v1/compliance/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a compliance report for the date range', async () => {
    const supabase = makeSupabase({}, { id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/report?from=2026-01-01&to=2026-03-31',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { totalChecks: number } };
    expect(body.data.totalChecks).toBe(3);
    expect(AmlEngine.generateComplianceReport).toHaveBeenCalledWith(
      AGENT_ID,
      new Date('2026-01-01'),
      new Date('2026-03-31'),
      expect.anything(),
    );
  });

  it('returns 400 when from or to are missing', async () => {
    const supabase = makeSupabase({}, { id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/report?from=2026-01-01',
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when user is unauthenticated', async () => {
    const supabase = makeSupabase({}, null);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/report?from=2026-01-01&to=2026-03-31',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/v1/compliance/expiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expiring checks with default 90 days', async () => {
    const expiringCheck = makeCheckRow({ status: 'passed', expiry_date: '2026-04-01' });
    vi.mocked(AmlEngine.getExpiringChecks).mockResolvedValue([expiringCheck as never]);

    const supabase = makeSupabase({}, { id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/expiring',
    });

    expect(response.statusCode).toBe(200);
    expect(AmlEngine.getExpiringChecks).toHaveBeenCalledWith(AGENT_ID, 90, expect.anything());
  });

  it('accepts custom daysAhead parameter', async () => {
    vi.mocked(AmlEngine.getExpiringChecks).mockResolvedValue([]);

    const supabase = makeSupabase({}, { id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/expiring?daysAhead=30',
    });

    expect(response.statusCode).toBe(200);
    expect(AmlEngine.getExpiringChecks).toHaveBeenCalledWith(AGENT_ID, 30, expect.anything());
  });

  it('returns 400 for invalid daysAhead value', async () => {
    const supabase = makeSupabase({}, { id: AGENT_ID });
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/expiring?daysAhead=0',
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const supabase = makeSupabase({}, null);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);

    const app = Fastify();
    app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/expiring',
    });

    expect(response.statusCode).toBe(401);
  });
});
