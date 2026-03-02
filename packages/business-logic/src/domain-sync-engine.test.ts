import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainSyncEngine } from './domain-sync-engine';

// ─── Mock DomainClient (injected via DI) ──────────────────────────────────────

const mockDomain = {
  searchListings: vi.fn(),
  getListing: vi.fn(),
  getSalesResults: vi.fn(),
  getSuburbPerformance: vi.fn(),
};

// ─── Supabase mock builder ────────────────────────────────────────────────────

function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  const base = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return base;
}

// ─── buildSearchParams ────────────────────────────────────────────────────────

describe('DomainSyncEngine.buildSearchParams', () => {
  const engine = new DomainSyncEngine(mockDomain as never);

  it('returns one param object per suburb', () => {
    const result = engine.buildSearchParams({
      suburbs: [
        { suburb: 'Paddington', state: 'NSW', postcode: '2021' },
        { suburb: 'Newtown', state: 'NSW', postcode: '2042' },
      ],
      budgetMin: 500000,
      budgetMax: 1000000,
    });

    expect(result).toHaveLength(2);
    expect(result[0].suburb).toBe('Paddington');
    expect(result[1].suburb).toBe('Newtown');
  });

  it('sets minPrice and maxPrice from budget fields', () => {
    const result = engine.buildSearchParams({
      suburbs: [{ suburb: 'Surry Hills', state: 'NSW', postcode: '2010' }],
      budgetMin: 750000,
      budgetMax: 1200000,
    });

    expect(result[0].minPrice).toBe(750000);
    expect(result[0].maxPrice).toBe(1200000);
  });

  it('includes minBedrooms when provided and > 0', () => {
    const result = engine.buildSearchParams({
      suburbs: [{ suburb: 'Glebe', state: 'NSW', postcode: '2037' }],
      budgetMin: 600000,
      budgetMax: 900000,
      minBedrooms: 3,
    });

    expect(result[0].minBedrooms).toBe(3);
  });

  it('omits minBedrooms when 0', () => {
    const result = engine.buildSearchParams({
      suburbs: [{ suburb: 'Glebe', state: 'NSW', postcode: '2037' }],
      budgetMin: 600000,
      budgetMax: 900000,
      minBedrooms: 0,
    });

    expect(result[0].minBedrooms).toBeUndefined();
  });

  it('includes propertyTypes when provided', () => {
    const result = engine.buildSearchParams({
      suburbs: [{ suburb: 'Bondi', state: 'NSW', postcode: '2026' }],
      budgetMin: 800000,
      budgetMax: 1500000,
      propertyTypes: ['House', 'Townhouse'],
    });

    expect(result[0].propertyTypes).toEqual(['House', 'Townhouse']);
  });

  it('omits propertyTypes when empty array', () => {
    const result = engine.buildSearchParams({
      suburbs: [{ suburb: 'Bondi', state: 'NSW', postcode: '2026' }],
      budgetMin: 800000,
      budgetMax: 1500000,
      propertyTypes: [],
    });

    expect(result[0].propertyTypes).toBeUndefined();
  });

  it('defaults state to NSW when not provided', () => {
    const result = engine.buildSearchParams({
      suburbs: [{ suburb: 'Randwick' }],
      budgetMin: 500000,
      budgetMax: 900000,
    });

    expect(result[0].state).toBe('NSW');
  });

  it('returns empty array for empty suburbs', () => {
    const result = engine.buildSearchParams({
      suburbs: [],
      budgetMin: 500000,
      budgetMax: 900000,
    });

    expect(result).toHaveLength(0);
  });

  it('handles multiple suburbs with all optional fields', () => {
    const result = engine.buildSearchParams({
      suburbs: [
        { suburb: 'Balmain', state: 'NSW', postcode: '2041' },
        { suburb: 'Rozelle', state: 'NSW', postcode: '2039' },
        { suburb: 'Annandale', state: 'NSW', postcode: '2038' },
      ],
      budgetMin: 1000000,
      budgetMax: 2000000,
      minBedrooms: 2,
      propertyTypes: ['House'],
    });

    expect(result).toHaveLength(3);
    result.forEach((p) => {
      expect(p.minPrice).toBe(1000000);
      expect(p.maxPrice).toBe(2000000);
      expect(p.minBedrooms).toBe(2);
      expect(p.propertyTypes).toEqual(['House']);
    });
  });
});

// ─── syncListingsForAgent ─────────────────────────────────────────────────────

describe('DomainSyncEngine.syncListingsForAgent', () => {
  let engine: DomainSyncEngine;

  beforeEach(() => {
    engine = new DomainSyncEngine(mockDomain as never);
    vi.clearAllMocks();
  });

  it('returns zero counts when agent has no client briefs', async () => {
    const supabase = buildSupabaseMock();
    supabase.from.mockReturnValue({
      ...supabase,
      select: vi.fn().mockReturnValue({
        ...supabase,
        eq: vi.fn().mockReturnValue({
          ...supabase,
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const result = await engine.syncListingsForAgent('agent-1', supabase as never);

    expect(result.listingsFound).toBe(0);
    expect(result.listingsImported).toBe(0);
    expect(result.matchesTriggered).toBe(0);
  });

  it('returns zero counts when Domain API returns no listings', async () => {
    mockDomain.searchListings.mockResolvedValue({ listings: [] });

    const briefs = [
      {
        id: 'brief-1',
        budget_min: 500000,
        budget_max: 900000,
        bedrooms_min: 3,
        property_types: ['House'],
        suburbs: [{ suburb: 'Paddington', state: 'NSW', postcode: '2021' }],
      },
    ];

    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'client_briefs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: briefs, error: null }),
              }),
            }),
          };
        }
        return chainMock;
      }),
    };

    const result = await engine.syncListingsForAgent('agent-1', supabase as never);

    expect(result.listingsFound).toBe(0);
    expect(result.listingsImported).toBe(0);
  });

  it('handles Domain API errors gracefully without throwing', async () => {
    mockDomain.searchListings.mockRejectedValue(new Error('Domain API 503'));

    const briefs = [
      {
        id: 'brief-1',
        budget_min: 500000,
        budget_max: 900000,
        bedrooms_min: null,
        property_types: null,
        suburbs: [{ suburb: 'Bondi', state: 'NSW', postcode: '2026' }],
      },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'client_briefs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: briefs, error: null }),
              }),
            }),
          };
        }
        return buildSupabaseMock();
      }),
    };

    // Should not throw
    const result = await engine.syncListingsForAgent('agent-1', supabase as never);
    expect(result.listingsFound).toBe(0);
  });

  it('returns error gracefully when supabase briefs query fails', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB connection error' },
            }),
          }),
        }),
      })),
    };

    const result = await engine.syncListingsForAgent('agent-1', supabase as never);

    expect(result.listingsFound).toBe(0);
    expect(result.listingsImported).toBe(0);
    expect(result.matchesTriggered).toBe(0);
  });
});

// ─── detectPriceChanges ───────────────────────────────────────────────────────

describe('DomainSyncEngine.detectPriceChanges', () => {
  let engine: DomainSyncEngine;

  beforeEach(() => {
    engine = new DomainSyncEngine(mockDomain as never);
    vi.clearAllMocks();
  });

  it('returns empty array when agent has no properties with domain_listing_id', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };

    const result = await engine.detectPriceChanges('agent-1', supabase as never);
    expect(result).toEqual([]);
  });

  it('detects a price reduction and inserts a price change record', async () => {
    mockDomain.getListing.mockResolvedValue({
      priceDetails: { price: 850000 },
    });

    const properties = [
      { id: 'prop-1', domain_listing_id: 'dom-123', list_price: 950000 },
    ];

    const insertedRecord = {
      id: 'change-1',
      property_id: 'prop-1',
      domain_listing_id: 'dom-123',
      previous_price: 950000,
      new_price: 850000,
      change_percent: -10.53,
      change_type: 'reduction',
      notified_agent_ids: [],
      detected_at: new Date().toISOString(),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({ data: properties, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'property_price_changes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: insertedRecord,
                  error: null,
                }),
              }),
            }),
          };
        }
        return buildSupabaseMock();
      }),
    };

    const changes = await engine.detectPriceChanges('agent-1', supabase as never);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('reduction');
    expect(changes[0].newPrice).toBe(850000);
    expect(changes[0].previousPrice).toBe(950000);
  });

  it('returns empty array when prices are unchanged', async () => {
    mockDomain.getListing.mockResolvedValue({
      priceDetails: { price: 900000 },
    });

    const properties = [
      { id: 'prop-2', domain_listing_id: 'dom-456', list_price: 900000 },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({ data: properties, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return buildSupabaseMock();
      }),
    };

    const changes = await engine.detectPriceChanges('agent-1', supabase as never);
    expect(changes).toHaveLength(0);
  });

  it('records price_guide_set when previous price was null', async () => {
    mockDomain.getListing.mockResolvedValue({
      priceDetails: { price: 1100000 },
    });

    const properties = [
      { id: 'prop-3', domain_listing_id: 'dom-789', list_price: null },
    ];

    const insertedRecord = {
      id: 'change-2',
      property_id: 'prop-3',
      domain_listing_id: 'dom-789',
      previous_price: null,
      new_price: 1100000,
      change_percent: null,
      change_type: 'price_guide_set',
      notified_agent_ids: [],
      detected_at: new Date().toISOString(),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({ data: properties, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'property_price_changes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: insertedRecord,
                  error: null,
                }),
              }),
            }),
          };
        }
        return buildSupabaseMock();
      }),
    };

    const changes = await engine.detectPriceChanges('agent-1', supabase as never);
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('price_guide_set');
    expect(changes[0].previousPrice).toBeNull();
  });

  it('handles Domain API errors per listing without throwing', async () => {
    mockDomain.getListing.mockRejectedValue(new Error('404 not found'));

    const properties = [
      { id: 'prop-4', domain_listing_id: 'dom-000', list_price: 500000 },
    ];

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: properties, error: null }),
            }),
          }),
        }),
      })),
    };

    const changes = await engine.detectPriceChanges('agent-1', supabase as never);
    expect(changes).toHaveLength(0);
  });

  it('returns empty array when supabase query fails', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Timeout' },
              }),
            }),
          }),
        }),
      })),
    };

    const result = await engine.detectPriceChanges('agent-1', supabase as never);
    expect(result).toEqual([]);
  });
});

// ─── ingestAuctionResults ─────────────────────────────────────────────────────

describe('DomainSyncEngine.ingestAuctionResults', () => {
  let engine: DomainSyncEngine;

  beforeEach(() => {
    engine = new DomainSyncEngine(mockDomain as never);
    vi.clearAllMocks();
  });

  it('returns empty array for empty suburbs list', async () => {
    const supabase = buildSupabaseMock();
    const result = await engine.ingestAuctionResults([], supabase as never);
    expect(result).toEqual([]);
  });

  it('processes Domain sales results and returns mapped auction records', async () => {
    mockDomain.getSalesResults.mockResolvedValue({
      salesResults: [
        {
          domainListingId: 'dom-sale-1',
          suburb: 'Paddington',
          postcode: '2021',
          state: 'NSW',
          auctionDate: '2026-03-01T10:00:00Z',
          result: 'sold',
          soldPrice: 1250000,
          reservePrice: 1200000,
          registeredBidders: 6,
          agentName: 'Jane Smith',
          agencyName: 'Ray White Paddington',
        },
      ],
    });

    const insertedRecord = {
      id: 'auction-1',
      property_id: null,
      domain_listing_id: 'dom-sale-1',
      suburb: 'Paddington',
      postcode: '2021',
      state: 'NSW',
      auction_date: '2026-03-01',
      result: 'sold',
      sold_price: 1250000,
      reserve_price: 1200000,
      registered_bidders: 6,
      agent_name: 'Jane Smith',
      agency_name: 'Ray White Paddington',
      created_at: new Date().toISOString(),
    };

    const supabase = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertedRecord,
              error: null,
            }),
          }),
        }),
      })),
    };

    const results = await engine.ingestAuctionResults(['Paddington'], supabase as never);

    expect(results).toHaveLength(1);
    expect(results[0].suburb).toBe('Paddington');
    expect(results[0].result).toBe('sold');
    expect(results[0].soldPrice).toBe(1250000);
  });

  it('maps "passed_in" result correctly', async () => {
    mockDomain.getSalesResults.mockResolvedValue({
      salesResults: [
        {
          domainListingId: 'dom-sale-2',
          suburb: 'Newtown',
          postcode: '2042',
          state: 'NSW',
          auctionDate: '2026-03-01T11:00:00Z',
          result: 'passed_in',
          soldPrice: null,
          reservePrice: 800000,
          registeredBidders: 2,
          agentName: null,
          agencyName: null,
        },
      ],
    });

    const insertedRecord = {
      id: 'auction-2',
      property_id: null,
      domain_listing_id: 'dom-sale-2',
      suburb: 'Newtown',
      postcode: '2042',
      state: 'NSW',
      auction_date: '2026-03-01',
      result: 'passed_in',
      sold_price: null,
      reserve_price: 800000,
      registered_bidders: 2,
      agent_name: null,
      agency_name: null,
      created_at: new Date().toISOString(),
    };

    const supabase = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertedRecord,
              error: null,
            }),
          }),
        }),
      })),
    };

    const results = await engine.ingestAuctionResults(['Newtown'], supabase as never);
    expect(results[0].result).toBe('passed_in');
    expect(results[0].soldPrice).toBeNull();
  });

  it('handles Domain API errors per suburb without throwing', async () => {
    mockDomain.getSalesResults.mockRejectedValue(new Error('Rate limited'));

    const supabase = buildSupabaseMock();
    const results = await engine.ingestAuctionResults(['Surry Hills'], supabase as never);
    expect(results).toHaveLength(0);
  });

  it('processes multiple suburbs independently', async () => {
    mockDomain.getSalesResults
      .mockResolvedValueOnce({
        salesResults: [
          {
            domainListingId: 'dom-a',
            suburb: 'Balmain',
            postcode: '2041',
            state: 'NSW',
            auctionDate: '2026-02-28T10:00:00Z',
            result: 'sold',
            soldPrice: 2100000,
          },
        ],
      })
      .mockResolvedValueOnce({
        salesResults: [
          {
            domainListingId: 'dom-b',
            suburb: 'Rozelle',
            postcode: '2039',
            state: 'NSW',
            auctionDate: '2026-02-28T11:00:00Z',
            result: 'withdrawn',
            soldPrice: null,
          },
        ],
      });

    const makeRecord = (id: string, suburb: string, result: string) => ({
      id,
      property_id: null,
      domain_listing_id: id,
      suburb,
      postcode: '2041',
      state: 'NSW',
      auction_date: '2026-02-28',
      result,
      sold_price: result === 'sold' ? 2100000 : null,
      reserve_price: null,
      registered_bidders: null,
      agent_name: null,
      agency_name: null,
      created_at: new Date().toISOString(),
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              const records = [
                makeRecord('dom-a', 'Balmain', 'sold'),
                makeRecord('dom-b', 'Rozelle', 'withdrawn'),
              ];
              return Promise.resolve({ data: records[callCount - 1], error: null });
            }),
          }),
        }),
      })),
    };

    const results = await engine.ingestAuctionResults(
      ['Balmain', 'Rozelle'],
      supabase as never,
    );

    expect(results).toHaveLength(2);
    expect(results[0].suburb).toBe('Balmain');
    expect(results[1].result).toBe('withdrawn');
  });

  it('gracefully handles empty salesResults array from Domain', async () => {
    mockDomain.getSalesResults.mockResolvedValue({ salesResults: [] });

    const supabase = buildSupabaseMock();
    const results = await engine.ingestAuctionResults(['EmptySuburb'], supabase as never);
    expect(results).toHaveLength(0);
  });
});
