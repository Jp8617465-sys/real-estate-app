import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortalEngine } from './portal-engine';

// ─── UUIDs ────────────────────────────────────────────────────────────────────
// Rule: ALL fixture IDs must be proper UUIDs — never 'brief-1' or 'test-id'

const AUTH_ID       = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PORTAL_ID     = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const CONTACT_ID    = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';
const AGENT_ID      = 'd1b2c3d4-e5f6-7890-abcd-ef1234567893';
const BRIEF_ID      = 'e1b2c3d4-e5f6-7890-abcd-ef1234567894';
const MATCH_ID      = 'f1b2c3d4-e5f6-7890-abcd-ef1234567895';
const INSPECTION_ID = '01b2c3d4-e5f6-7890-abcd-ef1234567896';

const NOW = new Date().toISOString();

// ─── Fixture factories ────────────────────────────────────────────────────────

function makePortalClientRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: PORTAL_ID,
    auth_id: AUTH_ID,
    contact_id: CONTACT_ID,
    agent_id: AGENT_ID,
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeBriefRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: BRIEF_ID,
    contact_id: CONTACT_ID,
    acknowledged_at: null,
    acknowledged_ip: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeMatchRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: MATCH_ID,
    property_id: '11b2c3d4-e5f6-7890-abcd-ef1234567897',
    brief_id: BRIEF_ID,
    client_id: CONTACT_ID,
    overall_score: 85,
    score_breakdown: { priceMatch: 90, locationMatch: 80, sizeMatch: 85, featureMatch: 85, investorMatch: 85 },
    status: 'sent_to_client',
    rejection_reason: null,
    agent_notes: null,
    client_feedback: null,
    client_feedback_at: null,
    client_feedback_note: null,
    matched_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeInspectionRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: INSPECTION_ID,
    contact_id: CONTACT_ID,
    property_id: '21b2c3d4-e5f6-7890-abcd-ef1234567898',
    status: 'completed',
    client_rating: null,
    client_feedback: null,
    client_feedback_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// ─── Supabase chain builder ───────────────────────────────────────────────────

function makeChain(data: unknown, error: unknown = null): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.update = vi.fn(self);
  chain.insert = vi.fn(self);
  // single() resolves to { data, error }
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  // make chain itself thenable for list queries
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

// ─── getPortalClient ──────────────────────────────────────────────────────────

describe('PortalEngine.getPortalClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a PortalClient when found', async () => {
    const row = makePortalClientRow();
    const supabase = {
      from: vi.fn(() => makeChain(row)),
    };
    const engine = new PortalEngine(supabase as never);
    const result = await engine.getPortalClient(AUTH_ID);

    expect(result.id).toBe(PORTAL_ID);
    expect(result.authId).toBe(AUTH_ID);
    expect(result.contactId).toBe(CONTACT_ID);
    expect(result.agentId).toBe(AGENT_ID);
    expect(result.isActive).toBe(true);
  });

  it('throws when portal client is not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, { message: 'Row not found' })),
    };
    const engine = new PortalEngine(supabase as never);

    await expect(engine.getPortalClient(AUTH_ID)).rejects.toThrow(
      'Portal client not found',
    );
  });
});

// ─── acknowledgeBrief ─────────────────────────────────────────────────────────

describe('PortalEngine.acknowledgeBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acknowledges a brief when the portal client owns it', async () => {
    const portalClientRow = makePortalClientRow();
    const briefRow = makeBriefRow();
    let updateCalled = false;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'portal_clients') {
          return makeChain(portalClientRow);
        }
        if (table === 'client_briefs') {
          const chain = makeChain(briefRow);
          chain.update = vi.fn(() => {
            updateCalled = true;
            return makeChain(null);
          });
          return chain;
        }
        return makeChain(null);
      }),
    };

    const engine = new PortalEngine(supabase as never);
    await engine.acknowledgeBrief(BRIEF_ID, AUTH_ID, '203.0.113.1');

    expect(updateCalled).toBe(true);
  });

  it('throws when brief does not belong to the portal client', async () => {
    const portalClientRow = makePortalClientRow();
    // Brief belongs to a different contact
    const differentContactId = '99b2c3d4-e5f6-7890-abcd-ef1234567899';
    const briefRow = makeBriefRow({ contact_id: differentContactId });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'portal_clients') {
          return makeChain(portalClientRow);
        }
        if (table === 'client_briefs') {
          return makeChain(briefRow);
        }
        return makeChain(null);
      }),
    };

    const engine = new PortalEngine(supabase as never);
    await expect(engine.acknowledgeBrief(BRIEF_ID, AUTH_ID)).rejects.toThrow('Forbidden');
  });
});

// ─── getSentMatches ───────────────────────────────────────────────────────────

describe('PortalEngine.getSentMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sent matches for a brief', async () => {
    const matches = [makeMatchRow(), makeMatchRow({ id: '31b2c3d4-e5f6-7890-abcd-ef1234567800' })];
    const chain = makeChain(matches);
    // list query resolves via .then
    chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: matches, error: null }).then(resolve);

    const supabase = {
      from: vi.fn(() => chain),
    };

    const engine = new PortalEngine(supabase as never);
    const result = await engine.getSentMatches(BRIEF_ID);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe(MATCH_ID);
    expect(result[0]!.status).toBe('sent_to_client');
  });

  it('returns empty array when no sent matches exist', async () => {
    const chain = makeChain([]);
    chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve);

    const supabase = {
      from: vi.fn(() => chain),
    };

    const engine = new PortalEngine(supabase as never);
    const result = await engine.getSentMatches(BRIEF_ID);

    expect(result).toEqual([]);
  });
});

// ─── recordMatchFeedback ──────────────────────────────────────────────────────

describe('PortalEngine.recordMatchFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records "interested" feedback on a match', async () => {
    const matchRow = makeMatchRow();
    const briefRow = makeBriefRow();
    const portalClientRow = makePortalClientRow();
    let updateCalled = false;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_matches') {
          const chain = makeChain(matchRow);
          chain.update = vi.fn(() => {
            updateCalled = true;
            return makeChain(null);
          });
          return chain;
        }
        if (table === 'portal_clients') {
          return makeChain(portalClientRow);
        }
        if (table === 'client_briefs') {
          return makeChain(briefRow);
        }
        return makeChain(null);
      }),
    };

    const engine = new PortalEngine(supabase as never);
    await engine.recordMatchFeedback(
      MATCH_ID,
      { propertyMatchId: MATCH_ID, feedback: 'interested' },
      AUTH_ID,
    );

    expect(updateCalled).toBe(true);
  });

  it('records "not_interested" feedback on a match', async () => {
    const matchRow = makeMatchRow();
    const briefRow = makeBriefRow();
    const portalClientRow = makePortalClientRow();
    let updateCalled = false;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_matches') {
          const chain = makeChain(matchRow);
          chain.update = vi.fn(() => {
            updateCalled = true;
            return makeChain(null);
          });
          return chain;
        }
        if (table === 'portal_clients') {
          return makeChain(portalClientRow);
        }
        if (table === 'client_briefs') {
          return makeChain(briefRow);
        }
        return makeChain(null);
      }),
    };

    const engine = new PortalEngine(supabase as never);
    await engine.recordMatchFeedback(
      MATCH_ID,
      { propertyMatchId: MATCH_ID, feedback: 'not_interested', notes: 'Too far from work' },
      AUTH_ID,
    );

    expect(updateCalled).toBe(true);
  });

  it('records "ask_agent" feedback on a match', async () => {
    const matchRow = makeMatchRow();
    const briefRow = makeBriefRow();
    const portalClientRow = makePortalClientRow();
    let updateCalled = false;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_matches') {
          const chain = makeChain(matchRow);
          chain.update = vi.fn(() => {
            updateCalled = true;
            return makeChain(null);
          });
          return chain;
        }
        if (table === 'portal_clients') {
          return makeChain(portalClientRow);
        }
        if (table === 'client_briefs') {
          return makeChain(briefRow);
        }
        return makeChain(null);
      }),
    };

    const engine = new PortalEngine(supabase as never);
    await engine.recordMatchFeedback(
      MATCH_ID,
      { propertyMatchId: MATCH_ID, feedback: 'ask_agent', notes: 'What are the body corp fees?' },
      AUTH_ID,
    );

    expect(updateCalled).toBe(true);
  });
});

// ─── recordInspectionFeedback ─────────────────────────────────────────────────

describe('PortalEngine.recordInspectionFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a valid star rating and feedback on an inspection', async () => {
    const inspectionRow = makeInspectionRow();
    const portalClientRow = makePortalClientRow();
    let updateCalled = false;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'inspections') {
          const chain = makeChain(inspectionRow);
          chain.update = vi.fn(() => {
            updateCalled = true;
            return makeChain(null);
          });
          return chain;
        }
        if (table === 'portal_clients') {
          return makeChain(portalClientRow);
        }
        return makeChain(null);
      }),
    };

    const engine = new PortalEngine(supabase as never);
    await engine.recordInspectionFeedback(
      INSPECTION_ID,
      { inspectionId: INSPECTION_ID, rating: 4, feedback: 'Loved the natural light' },
      AUTH_ID,
    );

    expect(updateCalled).toBe(true);
  });

  it('throws when rating is below the minimum (0 is invalid)', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null)),
    };

    const engine = new PortalEngine(supabase as never);
    await expect(
      engine.recordInspectionFeedback(
        INSPECTION_ID,
        // Force invalid rating through type cast to test runtime Zod validation
        { inspectionId: INSPECTION_ID, rating: 0 } as never,
        AUTH_ID,
      ),
    ).rejects.toThrow();
  });

  it('throws when rating is above the maximum (6 is invalid)', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null)),
    };

    const engine = new PortalEngine(supabase as never);
    await expect(
      engine.recordInspectionFeedback(
        INSPECTION_ID,
        { inspectionId: INSPECTION_ID, rating: 6 } as never,
        AUTH_ID,
      ),
    ).rejects.toThrow();
  });

  it('throws when the inspection does not belong to this portal client', async () => {
    const differentContactId = '88b2c3d4-e5f6-7890-abcd-ef1234567801';
    const inspectionRow = makeInspectionRow({ contact_id: differentContactId });
    const portalClientRow = makePortalClientRow(); // owns CONTACT_ID, not differentContactId

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'inspections') {
          return makeChain(inspectionRow);
        }
        if (table === 'portal_clients') {
          return makeChain(portalClientRow);
        }
        return makeChain(null);
      }),
    };

    const engine = new PortalEngine(supabase as never);
    await expect(
      engine.recordInspectionFeedback(
        INSPECTION_ID,
        { inspectionId: INSPECTION_ID, rating: 3 },
        AUTH_ID,
      ),
    ).rejects.toThrow('Forbidden');
  });
});
