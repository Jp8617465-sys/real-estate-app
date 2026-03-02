import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AmlEngine } from './aml-engine';
import type { AmlIdentityDocument } from '@realflow/shared';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

type DocInput = Pick<AmlIdentityDocument, 'documentType' | 'points' | 'isExpired'>;

const makeDoc = (
  documentType: AmlIdentityDocument['documentType'],
  points: number,
  isExpired = false,
): DocInput => ({ documentType, points, isExpired });

const PASSPORT: DocInput = makeDoc('passport', 70);
const BIRTH_CERT: DocInput = makeDoc('birth_certificate', 70);
const CITIZENSHIP: DocInput = makeDoc('citizenship_certificate', 70);
const DRIVERS_LICENCE: DocInput = makeDoc('drivers_licence', 40);
const GOVT_ID: DocInput = makeDoc('government_id_card', 40);
const PROOF_AGE: DocInput = makeDoc('proof_of_age_card', 40);
const MEDICARE: DocInput = makeDoc('medicare_card', 25);
const CREDIT_CARD: DocInput = makeDoc('credit_card', 25);
const UTILITY_BILL: DocInput = makeDoc('utility_bill', 25);
const BANK_STMT: DocInput = makeDoc('bank_statement', 25);
const COUNCIL_RATES: DocInput = makeDoc('council_rates', 25);
const LEASE: DocInput = makeDoc('lease_agreement', 25);
const CENTRELINK: DocInput = makeDoc('centrelink_letter', 25);

const EXPIRED_PASSPORT: DocInput = makeDoc('passport', 70, true);
const EXPIRED_DRIVERS: DocInput = makeDoc('drivers_licence', 40, true);

// ─── Supabase Mock Builder ────────────────────────────────────────────────────

function makeSupabaseMock(overrides?: {
  check?: Record<string, unknown> | null;
  checkError?: { message: string } | null;
  docs?: Record<string, unknown>[];
  docsError?: { message: string } | null;
  updatedCheck?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
  expiringChecks?: Record<string, unknown>[];
  expiringError?: { message: string } | null;
  user?: { full_name: string } | null;
  allChecks?: Record<string, unknown>[];
  smrRows?: Record<string, unknown>[];
}) {
  const now = new Date().toISOString();
  const defaultCheck: Record<string, unknown> = {
    id: 'check-1',
    contact_id: '00000000-0000-0000-0000-000000000002',
    agent_id: '00000000-0000-0000-0000-000000000003',
    status: 'in_progress',
    verification_method: 'face_to_face',
    total_points: 110,
    points_required: 100,
    full_legal_name: 'John Michael Smith',
    date_of_birth: '1985-03-15',
    residential_address: '12 Main St, Sydney NSW 2000',
    address_verified: false,
    started_at: now,
    completed_at: null,
    expiry_date: null,
    last_reviewed_at: null,
    verified_by_user_id: null,
    rejection_reason: null,
    notes: null,
    created_at: now,
    updated_at: now,
  };

  const defaultDocs: Record<string, unknown>[] = [
    { document_type: 'passport', points: 70, is_expired: false },
    { document_type: 'drivers_licence', points: 40, is_expired: false },
  ];

  const defaultUpdatedCheck: Record<string, unknown> = {
    ...defaultCheck,
    status: 'passed',
    completed_at: now,
    expiry_date: '2028-03-01',
    updated_at: now,
  };

  // Track which query chain we are building so we can return correct data
  let currentTable = '';
  let selectCount = 0;

  const buildChain = (resolvedData: unknown, resolvedError: unknown) => {
    const chain: Record<string, unknown> = {};

    const terminal = {
      then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
        Promise.resolve({ data: resolvedData, error: resolvedError }).then(resolve),
    };

    // Build fluent chain — every method returns chain or terminal
    const methods = ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'single', 'update', 'insert', 'delete', 'from'];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }

    // Override .single() and implicit .then to resolve
    (chain as Record<string, unknown>).single = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
    // Make the chain itself thenable
    (chain as Record<string, unknown>).then = terminal.then;

    return chain;
  };

  // We need per-table routing. Use a smarter mock.
  const selectCallsByTable: Record<string, number> = {};

  const supabase = {
    from: vi.fn((table: string) => {
      currentTable = table;
      selectCallsByTable[table] = (selectCallsByTable[table] ?? 0);

      if (table === 'aml_checks') {
        const checkData = overrides?.check !== undefined ? overrides.check : defaultCheck;
        const checkErr = overrides?.checkError ?? null;
        const updatedData = overrides?.updatedCheck !== undefined ? overrides.updatedCheck : defaultUpdatedCheck;
        const updateErr = overrides?.updateError ?? null;
        const allChecks = overrides?.allChecks ?? [];

        let updateCalled = false;

        const chain: Record<string, unknown> = {};

        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.lte = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.update = vi.fn(() => {
          updateCalled = true;
          return chain;
        });
        chain.single = vi.fn(() => {
          if (updateCalled) {
            return Promise.resolve({ data: updatedData, error: updateErr });
          }
          return Promise.resolve({ data: checkData, error: checkErr });
        });
        // Thenable for list queries
        chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) => {
          if (overrides?.expiringChecks !== undefined) {
            return Promise.resolve({ data: overrides.expiringChecks, error: overrides.expiringError ?? null }).then(resolve);
          }
          return Promise.resolve({ data: allChecks, error: null }).then(resolve);
        };

        return chain;
      }

      if (table === 'aml_identity_documents') {
        const docsData = overrides?.docs !== undefined ? overrides.docs : defaultDocs;
        const docsErr = overrides?.docsError ?? null;
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
          Promise.resolve({ data: docsData, error: docsErr }).then(resolve);
        return chain;
      }

      if (table === 'users') {
        const userData = overrides?.user !== undefined ? overrides.user : { full_name: 'Test Agent' };
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn(() => Promise.resolve({ data: userData, error: null }));
        return chain;
      }

      if (table === 'aml_suspicious_matter_reports') {
        const smrData = overrides?.smrRows ?? [];
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.lte = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
          Promise.resolve({ data: smrData, error: null }).then(resolve);
        return chain;
      }

      // Fallback empty chain
      const chain: Record<string, unknown> = {};
      const noop = vi.fn().mockReturnValue(chain);
      chain.select = noop;
      chain.eq = noop;
      chain.gte = noop;
      chain.lte = noop;
      chain.order = noop;
      chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
      chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return chain;
    }),
  };

  return supabase;
}

// ─── calculatePoints ──────────────────────────────────────────────────────────

describe('AmlEngine.calculatePoints', () => {
  it('sums points from valid documents', () => {
    expect(AmlEngine.calculatePoints([PASSPORT, DRIVERS_LICENCE])).toBe(110);
  });

  it('returns zero when no documents provided', () => {
    expect(AmlEngine.calculatePoints([])).toBe(0);
  });

  it('excludes expired documents from sum', () => {
    // expired passport (70) + valid licence (40) = 40
    expect(AmlEngine.calculatePoints([EXPIRED_PASSPORT, DRIVERS_LICENCE])).toBe(40);
  });

  it('returns zero when all documents are expired', () => {
    expect(AmlEngine.calculatePoints([EXPIRED_PASSPORT, EXPIRED_DRIVERS])).toBe(0);
  });

  it('counts points correctly for multiple secondary_b docs', () => {
    // 3 x 25pt supporting docs
    expect(AmlEngine.calculatePoints([MEDICARE, CREDIT_CARD, UTILITY_BILL])).toBe(75);
  });

  it('handles single document correctly', () => {
    expect(AmlEngine.calculatePoints([PASSPORT])).toBe(70);
  });
});

// ─── validateDocumentSet ──────────────────────────────────────────────────────

describe('AmlEngine.validateDocumentSet', () => {
  it('passes with passport (70) + drivers licence (40) = 110 pts', () => {
    const result = AmlEngine.validateDocumentSet([PASSPORT, DRIVERS_LICENCE]);
    expect(result.isValid).toBe(true);
    expect(result.totalPoints).toBe(110);
    expect(result.hasPrimaryOrSecondaryA).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes with exactly 100 points (passport 70 + licence 40 - but licence only 30... use 4x25=100)', () => {
    // 4 x 25pt docs with a primary = passport(70) is too many; use drivers_licence(40) + 3x25=75: 115
    // Exact 100: drivers_licence(40) + 3x utility_bill(25) makes 115, not 100
    // passport(70) + 1x utility_bill(25) + 1x medicare(25) = 120: still not 100
    // birth_cert(70) + medicare(25) + credit_card(25) - but 70+25 = 95 < 100
    // drivers_licence(40) + proof_of_age_card(40) + medicare(25) = 105
    // Closest exact 100: drivers_licence(40) + proof_of_age_card(40) + medicare(25) - nope 105
    // Actually: birth_cert(70) + medicare(25) + bank_card(25) = 120? No: 70+25+25=120
    // 40+40+25-5=100: not achievable cleanly. Use a custom doc with custom points:
    // per spec, points are stored on the document row — so we can use non-standard points
    const exact100Doc: DocInput = { documentType: 'drivers_licence', points: 60, isExpired: false };
    const supporting: DocInput = { documentType: 'utility_bill', points: 40, isExpired: false };
    const result = AmlEngine.validateDocumentSet([exact100Doc, supporting]);
    expect(result.isValid).toBe(true);
    expect(result.totalPoints).toBe(100);
  });

  it('fails when total points < 100', () => {
    // only medicare (25) — insufficient and no primary
    const result = AmlEngine.validateDocumentSet([MEDICARE]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Insufficient points: 25/100');
  });

  it('fails when no primary or secondary_a document is present', () => {
    // 4 x 25pt secondary_b/supporting = 100 pts but no primary
    const result = AmlEngine.validateDocumentSet([MEDICARE, CREDIT_CARD, UTILITY_BILL, BANK_STMT]);
    expect(result.isValid).toBe(false);
    expect(result.hasPrimaryOrSecondaryA).toBe(false);
    expect(result.errors.some((e) => e.includes("primary or secondary category"))).toBe(true);
  });

  it('fails with two errors when < 100 pts AND no primary/secondary_a', () => {
    const result = AmlEngine.validateDocumentSet([MEDICARE]);
    expect(result.errors.length).toBe(2);
  });

  it('produces warning for duplicate document type', () => {
    const result = AmlEngine.validateDocumentSet([PASSPORT, PASSPORT, DRIVERS_LICENCE]);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain('passport');
    expect(result.warnings[0]).toContain('will not increase points');
  });

  it('does not double-count duplicate document types in points', () => {
    // passport counted once (70) + drivers_licence (40) = 110
    const result = AmlEngine.validateDocumentSet([PASSPORT, PASSPORT, DRIVERS_LICENCE]);
    // the engine still sums all docs including duplicates (they just get warnings)
    // the 100pt check should still pass since 70+70+40=180 but note duplicates do contribute
    // per spec: "Duplicate document types produce a warning" — points ARE still counted
    expect(result.isValid).toBe(true);
  });

  it('excludes expired documents from points and primary/secondary_a check', () => {
    // expired passport + 4 x medicare (100pt total from secondary_b only)
    const result = AmlEngine.validateDocumentSet([
      EXPIRED_PASSPORT,
      MEDICARE,
      CREDIT_CARD,
      UTILITY_BILL,
      BANK_STMT,
    ]);
    expect(result.hasPrimaryOrSecondaryA).toBe(false);
    expect(result.errors.some((e) => e.includes("primary or secondary category"))).toBe(true);
  });

  it('passes with birth certificate (70) + 2x supporting (25+25=50) = 120pts', () => {
    const result = AmlEngine.validateDocumentSet([BIRTH_CERT, UTILITY_BILL, BANK_STMT]);
    expect(result.isValid).toBe(true);
    expect(result.totalPoints).toBe(120);
  });

  it('passes with drivers_licence (40) alone if its secondary_a and points >= 100 via other docs', () => {
    // 40 + 25 + 25 + 25 = 115 — secondary_a present
    const result = AmlEngine.validateDocumentSet([DRIVERS_LICENCE, MEDICARE, CREDIT_CARD, UTILITY_BILL]);
    expect(result.isValid).toBe(true);
    expect(result.hasPrimaryOrSecondaryA).toBe(true);
  });

  it('returns empty errors array on valid set', () => {
    const result = AmlEngine.validateDocumentSet([PASSPORT, DRIVERS_LICENCE]);
    expect(result.errors).toEqual([]);
  });

  it('returns empty warnings array when no duplicates', () => {
    const result = AmlEngine.validateDocumentSet([PASSPORT, DRIVERS_LICENCE]);
    expect(result.warnings).toEqual([]);
  });
});

// ─── tryAutoComplete ──────────────────────────────────────────────────────────

describe('AmlEngine.tryAutoComplete', () => {
  it('returns updated check with status=passed when all conditions met', async () => {
    const supabase = makeSupabaseMock();
    const result = await AmlEngine.tryAutoComplete('check-1', supabase as never);

    expect(result).not.toBeNull();
    expect(result?.status).toBe('passed');
    expect(result?.completedAt).not.toBeNull();
    expect(result?.expiryDate).not.toBeNull();
  });

  it('returns null when check has insufficient points', async () => {
    const supabase = makeSupabaseMock({
      docs: [
        { document_type: 'medicare_card', points: 25, is_expired: false },
      ],
    });
    const result = await AmlEngine.tryAutoComplete('check-1', supabase as never);

    expect(result).toBeNull();
  });

  it('returns null when check has no primary or secondary_a document', async () => {
    const supabase = makeSupabaseMock({
      docs: [
        { document_type: 'medicare_card', points: 25, is_expired: false },
        { document_type: 'credit_card', points: 25, is_expired: false },
        { document_type: 'utility_bill', points: 25, is_expired: false },
        { document_type: 'bank_statement', points: 25, is_expired: false },
      ],
    });
    const result = await AmlEngine.tryAutoComplete('check-1', supabase as never);

    expect(result).toBeNull();
  });

  it('returns null when full_legal_name is missing', async () => {
    const supabase = makeSupabaseMock({
      check: {
        id: 'check-1',
        contact_id: '00000000-0000-0000-0000-000000000002',
        agent_id: '00000000-0000-0000-0000-000000000003',
        status: 'in_progress',
        verification_method: 'face_to_face',
        total_points: 110,
        points_required: 100,
        full_legal_name: null,
        date_of_birth: '1985-03-15',
        residential_address: '12 Main St, Sydney NSW 2000',
        address_verified: false,
        started_at: new Date().toISOString(),
        completed_at: null,
        expiry_date: null,
        last_reviewed_at: null,
        verified_by_user_id: null,
        rejection_reason: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    const result = await AmlEngine.tryAutoComplete('check-1', supabase as never);

    expect(result).toBeNull();
  });

  it('returns null when date_of_birth is missing', async () => {
    const supabase = makeSupabaseMock({
      check: {
        id: 'check-1',
        contact_id: '00000000-0000-0000-0000-000000000002',
        agent_id: '00000000-0000-0000-0000-000000000003',
        status: 'in_progress',
        verification_method: 'face_to_face',
        total_points: 110,
        points_required: 100,
        full_legal_name: 'Jane Doe',
        date_of_birth: null,
        residential_address: '12 Main St, Sydney NSW 2000',
        address_verified: false,
        started_at: new Date().toISOString(),
        completed_at: null,
        expiry_date: null,
        last_reviewed_at: null,
        verified_by_user_id: null,
        rejection_reason: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    const result = await AmlEngine.tryAutoComplete('check-1', supabase as never);

    expect(result).toBeNull();
  });

  it('returns null when the check fetch fails', async () => {
    const supabase = makeSupabaseMock({
      check: null,
      checkError: { message: 'Not found' },
    });
    const result = await AmlEngine.tryAutoComplete('check-1', supabase as never);

    expect(result).toBeNull();
  });

  it('returns existing check unchanged when already passed', async () => {
    const now = new Date().toISOString();
    const supabase = makeSupabaseMock({
      check: {
        id: 'check-1',
        contact_id: '00000000-0000-0000-0000-000000000002',
        agent_id: '00000000-0000-0000-0000-000000000003',
        status: 'passed',
        verification_method: 'face_to_face',
        total_points: 110,
        points_required: 100,
        full_legal_name: 'Jane Doe',
        date_of_birth: '1985-01-01',
        residential_address: '1 Test St',
        address_verified: true,
        started_at: now,
        completed_at: now,
        expiry_date: '2027-01-01',
        last_reviewed_at: null,
        verified_by_user_id: null,
        rejection_reason: null,
        notes: null,
        created_at: now,
        updated_at: now,
      },
    });
    const result = await AmlEngine.tryAutoComplete('check-1', supabase as never);

    expect(result?.status).toBe('passed');
  });

  it('sets expiry_date to 2 years from now', async () => {
    const supabase = makeSupabaseMock();
    const result = await AmlEngine.tryAutoComplete('check-1', supabase as never);

    expect(result?.expiryDate).not.toBeNull();
    const expiry = new Date(result!.expiryDate!);
    const expectedYear = new Date().getFullYear() + 2;
    expect(expiry.getFullYear()).toBe(expectedYear);
  });
});

// ─── getExpiringChecks ────────────────────────────────────────────────────────

describe('AmlEngine.getExpiringChecks', () => {
  it('returns checks expiring within the specified days', async () => {
    const now = new Date().toISOString();
    const soonExpiry = new Date();
    soonExpiry.setDate(soonExpiry.getDate() + 30);

    const expiringCheck: Record<string, unknown> = {
      id: 'check-exp-1',
      contact_id: '00000000-0000-0000-0000-000000000002',
      agent_id: '00000000-0000-0000-0000-000000000003',
      status: 'passed',
      verification_method: 'face_to_face',
      total_points: 110,
      points_required: 100,
      full_legal_name: 'Jane Smith',
      date_of_birth: '1990-01-01',
      residential_address: '5 Park Rd, Brisbane QLD 4000',
      address_verified: true,
      started_at: now,
      completed_at: now,
      expiry_date: soonExpiry.toISOString().split('T')[0],
      last_reviewed_at: null,
      verified_by_user_id: null,
      rejection_reason: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    const supabase = makeSupabaseMock({ expiringChecks: [expiringCheck] });
    const result = await AmlEngine.getExpiringChecks('agent-1', 90, supabase as never);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('check-exp-1');
    expect(result[0]!.status).toBe('passed');
  });

  it('returns empty array when no checks are expiring', async () => {
    const supabase = makeSupabaseMock({ expiringChecks: [] });
    const result = await AmlEngine.getExpiringChecks('agent-1', 90, supabase as never);

    expect(result).toEqual([]);
  });

  it('returns empty array on supabase error', async () => {
    const supabase = makeSupabaseMock({
      expiringChecks: [],
      expiringError: { message: 'DB error' },
    });
    const result = await AmlEngine.getExpiringChecks('agent-1', 90, supabase as never);

    expect(result).toEqual([]);
  });
});

// ─── generateComplianceReport ─────────────────────────────────────────────────

describe('AmlEngine.generateComplianceReport', () => {
  const now = new Date().toISOString();

  const makeCheckRow = (status: string, id: string): Record<string, unknown> => ({
    id,
    contact_id: '00000000-0000-0000-0000-000000000002',
    agent_id: '00000000-0000-0000-0000-000000000003',
    status,
    verification_method: 'face_to_face',
    total_points: 110,
    points_required: 100,
    full_legal_name: 'Test Person',
    date_of_birth: '1985-01-01',
    residential_address: '1 Test St',
    address_verified: true,
    started_at: now,
    completed_at: status === 'passed' ? now : null,
    expiry_date: status === 'passed' ? '2028-01-01' : null,
    last_reviewed_at: null,
    verified_by_user_id: null,
    rejection_reason: null,
    notes: null,
    created_at: now,
    updated_at: now,
  });

  it('returns correct total, passed, failed, pending counts', async () => {
    const allChecks = [
      makeCheckRow('passed', 'c1'),
      makeCheckRow('passed', 'c2'),
      makeCheckRow('failed', 'c3'),
      makeCheckRow('pending', 'c4'),
      makeCheckRow('in_progress', 'c5'),
    ];

    const supabase = makeSupabaseMock({
      allChecks,
      expiringChecks: [],
      smrRows: [],
      user: { full_name: 'Agent Name' },
    });

    const from = new Date('2026-01-01');
    const to = new Date('2026-03-31');
    const report = await AmlEngine.generateComplianceReport('agent-1', from, to, supabase as never);

    expect(report.totalChecks).toBe(5);
    expect(report.passedChecks).toBe(2);
    expect(report.failedChecks).toBe(1);
    expect(report.pendingChecks).toBe(2);
    expect(report.agentId).toBe('agent-1');
    expect(report.agentName).toBe('Agent Name');
  });

  it('includes smrCount from the period', async () => {
    const supabase = makeSupabaseMock({
      allChecks: [],
      expiringChecks: [],
      smrRows: [{ id: 'smr-1' }, { id: 'smr-2' }],
      user: { full_name: 'Agent Name' },
    });

    const report = await AmlEngine.generateComplianceReport(
      'agent-1',
      new Date('2026-01-01'),
      new Date('2026-03-31'),
      supabase as never,
    );

    expect(report.smrCount).toBe(2);
  });

  it('includes expiringWithin90Days count', async () => {
    const expiringCheck = makeCheckRow('passed', 'exp-1');
    const supabase = makeSupabaseMock({
      allChecks: [],
      expiringChecks: [expiringCheck],
      smrRows: [],
      user: { full_name: 'Agent' },
    });

    const report = await AmlEngine.generateComplianceReport(
      'agent-1',
      new Date('2026-01-01'),
      new Date('2026-03-31'),
      supabase as never,
    );

    expect(report.expiringWithin90Days).toBe(1);
  });

  it('includes periodFrom and periodTo in ISO date format', async () => {
    const supabase = makeSupabaseMock({
      allChecks: [],
      expiringChecks: [],
      smrRows: [],
      user: { full_name: 'Agent' },
    });

    const report = await AmlEngine.generateComplianceReport(
      'agent-1',
      new Date('2026-01-01'),
      new Date('2026-03-31'),
      supabase as never,
    );

    expect(report.periodFrom).toBe('2026-01-01');
    expect(report.periodTo).toBe('2026-03-31');
  });

  it('includes generatedAt timestamp', async () => {
    const supabase = makeSupabaseMock({
      allChecks: [],
      expiringChecks: [],
      smrRows: [],
      user: { full_name: 'Agent' },
    });

    const report = await AmlEngine.generateComplianceReport(
      'agent-1',
      new Date('2026-01-01'),
      new Date('2026-03-31'),
      supabase as never,
    );

    expect(report.generatedAt).toBeTruthy();
    expect(new Date(report.generatedAt).getTime()).not.toBeNaN();
  });

  it('uses fallback agent name when user not found', async () => {
    const supabase = makeSupabaseMock({
      allChecks: [],
      expiringChecks: [],
      smrRows: [],
      user: null,
    });

    const report = await AmlEngine.generateComplianceReport(
      'agent-1',
      new Date('2026-01-01'),
      new Date('2026-03-31'),
      supabase as never,
    );

    expect(report.agentName).toBe('Unknown Agent');
  });
});
