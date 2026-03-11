import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OffMarketEngine } from './off-market-engine';

// ─── UUIDs ───────────────────────────────────────────────────────────────────

const AGENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OFFICE_ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const PROPERTY_ID = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';
const BRIEF_ID = 'd1b2c3d4-e5f6-7890-abcd-ef1234567893';
const MATCH_ID = 'e1b2c3d4-e5f6-7890-abcd-ef1234567894';

const NOW = new Date().toISOString();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePropertyRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: PROPERTY_ID,
    agent_id: AGENT_ID,
    office_id: OFFICE_ID,
    address_line1: '42 Test Street',
    suburb: 'Paddington',
    state: 'NSW',
    postcode: '2021',
    property_type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    car_spaces: 1,
    land_size_sqm: 250,
    asking_price: 1800000,
    source: 'vendor_direct',
    source_name: 'John Vendor',
    agent_notes: 'Motivated seller',
    visibility: 'agent_only',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...overrides,
  };
}

function makeMatchRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: MATCH_ID,
    off_market_id: PROPERTY_ID,
    client_brief_id: BRIEF_ID,
    match_score: 75,
    status: 'new',
    sent_to_client_at: null,
    created_at: NOW,
    ...overrides,
  };
}

function makeBriefRow(): Record<string, unknown> {
  return {
    id: BRIEF_ID,
    is_deleted: false,
    requirements: {
      locations: { suburbs: ['Paddington', 'Surry Hills'] },
      bedrooms: { min: 2, max: 4 },
      bathrooms: { min: 1 },
      budget: { min: 1000000, max: 2200000 },
      propertyTypes: ['house', 'townhouse'],
    },
  };
}

// ─── Supabase chain builder ───────────────────────────────────────────────────

function makeChain(data: unknown, error: unknown = null): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.not = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.range = vi.fn(self);
  chain.update = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.upsert = vi.fn(self);
  chain.contains = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

// ─── OffMarketEngine.create ───────────────────────────────────────────────────

describe('OffMarketEngine.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a property and returns it with matches', async () => {
    const propertyRow = makePropertyRow();
    const brief = makeBriefRow();
    const matchRow = makeMatchRow();

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(makeChain(propertyRow)) // insert property
        .mockReturnValueOnce(makeChain(propertyRow)) // fetch property in matchAgainstBriefs
        .mockReturnValueOnce(makeChain([brief])) // fetch briefs
        .mockReturnValueOnce(makeChain([matchRow])), // upsert matches
    };

    const engine = new OffMarketEngine(supabase as never);
    const result = await engine.create(
      {
        addressLine1: '42 Test Street',
        suburb: 'Paddington',
        state: 'NSW',
        postcode: '2021',
        propertyType: 'house',
        bedrooms: 3,
        source: 'vendor_direct',
      },
      AGENT_ID,
      OFFICE_ID,
    );

    expect(result.property.id).toBe(PROPERTY_ID);
    expect(result.property.suburb).toBe('Paddington');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchScore).toBe(75);
  });
});

// ─── OffMarketEngine.update ───────────────────────────────────────────────────

describe('OffMarketEngine.update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates property fields', async () => {
    const updated = makePropertyRow({ asking_price: 2000000 });
    const supabase = { from: vi.fn(() => makeChain(updated)) };

    const engine = new OffMarketEngine(supabase as never);
    const result = await engine.update(PROPERTY_ID, { askingPrice: 2000000 }, AGENT_ID);

    expect(result.askingPrice).toBe(2000000);
  });

  it('throws when update fails', async () => {
    const supabase = { from: vi.fn(() => makeChain(null, { message: 'Update error' })) };

    const engine = new OffMarketEngine(supabase as never);
    await expect(engine.update(PROPERTY_ID, { status: 'withdrawn' }, AGENT_ID)).rejects.toThrow(
      'Failed to update off-market property',
    );
  });
});

// ─── OffMarketEngine.softDelete ───────────────────────────────────────────────

describe('OffMarketEngine.softDelete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets deleted_at on the property', async () => {
    const chain = makeChain(null);
    const supabase = { from: vi.fn(() => chain) };

    const engine = new OffMarketEngine(supabase as never);
    await engine.softDelete(PROPERTY_ID, AGENT_ID);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
  });
});

// ─── OffMarketEngine.matchAgainstBriefs ──────────────────────────────────────

describe('OffMarketEngine.matchAgainstBriefs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns matches above threshold scored correctly', async () => {
    const propertyRow = makePropertyRow();
    const brief = makeBriefRow();
    const matchRows = [makeMatchRow()];

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(makeChain(propertyRow)) // fetch property
        .mockReturnValueOnce(makeChain([brief])) // fetch briefs
        .mockReturnValueOnce(makeChain(matchRows)), // upsert
    };

    const engine = new OffMarketEngine(supabase as never);
    const matches = await engine.matchAgainstBriefs(PROPERTY_ID, AGENT_ID, 30);

    expect(matches).toHaveLength(1);
    expect(matches[0].offMarketId).toBe(PROPERTY_ID);
    expect(matches[0].clientBriefId).toBe(BRIEF_ID);
  });

  it('returns empty array when no briefs meet threshold', async () => {
    const propertyRow = makePropertyRow({ suburb: 'Toorak', asking_price: 5000000 });
    // Brief only wants Paddington with budget 1-2M
    const brief = makeBriefRow();

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(makeChain(propertyRow))
        .mockReturnValueOnce(makeChain([brief])),
    };

    const engine = new OffMarketEngine(supabase as never);
    // Suburb is Toorak (no match) — property_type still matches but location miss
    const matches = await engine.matchAgainstBriefs(PROPERTY_ID, AGENT_ID, 70);

    // With Toorak not in suburbs list, score should be below 70
    expect(matches).toHaveLength(0);
  });

  it('returns empty array when there are no active briefs', async () => {
    const propertyRow = makePropertyRow();

    const supabase = {
      from: vi.fn().mockReturnValueOnce(makeChain(propertyRow)).mockReturnValueOnce(makeChain([])), // no briefs
    };

    const engine = new OffMarketEngine(supabase as never);
    const matches = await engine.matchAgainstBriefs(PROPERTY_ID, AGENT_ID);

    expect(matches).toHaveLength(0);
  });
});

// ─── OffMarketEngine.sendToClient ─────────────────────────────────────────────

describe('OffMarketEngine.sendToClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates match status and property visibility', async () => {
    const sentMatch = makeMatchRow({ status: 'sent_to_client', sent_to_client_at: NOW });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(makeChain(sentMatch)) // update match
        .mockReturnValueOnce(makeChain(null)), // update property visibility
    };

    const engine = new OffMarketEngine(supabase as never);
    const result = await engine.sendToClient(PROPERTY_ID, BRIEF_ID);

    expect(result.status).toBe('sent_to_client');
    expect(result.sentToClientAt).toBe(NOW);
  });
});

// ─── OffMarketEngine.retractFromClient ───────────────────────────────────────

describe('OffMarketEngine.retractFromClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retracts match and resets property visibility when no other sent matches', async () => {
    const retractedMatch = makeMatchRow({ status: 'new', sent_to_client_at: null });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(makeChain(retractedMatch)) // update match
        .mockReturnValueOnce(makeChain([])) // check remaining sent matches → none
        .mockReturnValueOnce(makeChain(null)), // update property visibility
    };

    const engine = new OffMarketEngine(supabase as never);
    const result = await engine.retractFromClient(PROPERTY_ID, BRIEF_ID);

    expect(result.status).toBe('new');
    expect(result.sentToClientAt).toBeNull();
  });
});

// ─── OffMarketEngine.getSuccessStats ─────────────────────────────────────────

describe('OffMarketEngine.getSuccessStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calculates correct success rates', async () => {
    const offMarketRows = [{ status: 'sold' }, { status: 'active' }, { status: 'sold' }];
    const txRows = [
      { current_stage: 'settlement' },
      { current_stage: 'offer' },
      { current_stage: 'offer' },
      { current_stage: 'offer' },
      { current_stage: 'offer' },
    ];

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(makeChain(offMarketRows))
        .mockReturnValueOnce(makeChain(txRows)),
    };

    const engine = new OffMarketEngine(supabase as never);
    const stats = await engine.getSuccessStats(AGENT_ID);

    expect(stats.totalOffMarket).toBe(3);
    expect(stats.offMarketClosed).toBe(2);
    expect(stats.offMarketSuccessRate).toBe(67); // 2/3 ≈ 67%
    expect(stats.totalOnMarket).toBe(5);
    expect(stats.onMarketSuccessRate).toBe(20); // 1/5 = 20%
  });

  it('returns 0% rates when no properties exist', async () => {
    const supabase = {
      from: vi.fn().mockReturnValueOnce(makeChain([])).mockReturnValueOnce(makeChain([])),
    };

    const engine = new OffMarketEngine(supabase as never);
    const stats = await engine.getSuccessStats(AGENT_ID);

    expect(stats.offMarketSuccessRate).toBe(0);
    expect(stats.onMarketSuccessRate).toBe(0);
  });
});

// ─── OffMarketEngine.getById ──────────────────────────────────────────────────

describe('OffMarketEngine.getById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the property when found', async () => {
    const row = makePropertyRow();
    const supabase = { from: vi.fn(() => makeChain(row)) };

    const engine = new OffMarketEngine(supabase as never);
    const result = await engine.getById(PROPERTY_ID);

    expect(result.id).toBe(PROPERTY_ID);
    expect(result.suburb).toBe('Paddington');
  });

  it('throws when property not found (non-PGRST116 error)', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, { message: 'Not found', code: 'PGRST999' })),
    };

    const engine = new OffMarketEngine(supabase as never);
    await expect(engine.getById(PROPERTY_ID)).rejects.toThrow(
      'Failed to fetch off-market property: Not found',
    );
  });

  it('returns null when property does not exist (PGRST116 — no rows)', async () => {
    const supabase = {
      from: vi.fn(() =>
        makeChain(null, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }),
      ),
    };

    const engine = new OffMarketEngine(supabase as never);
    const result = await engine.getById(PROPERTY_ID);
    expect(result).toBeNull();
  });
});
