import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ──────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
  createSupabaseServiceClient: () => mockSupabase,
}));

// ─── Mock Domain Client ─────────────────────────────────────────────

const mockGetSuburbPerformance = vi.fn();

vi.mock('@realflow/integrations', () => ({
  DomainClient: vi.fn().mockImplementation(() => ({
    getSuburbPerformance: mockGetSuburbPerformance,
  })),
}));

vi.mock('@realflow/integrations/src/errors', () => ({
  DomainAPIError: class DomainAPIError extends Error {
    statusCode: number;
    statusText: string;
    constructor(message: string, statusCode: number, statusText: string) {
      super(`${message}: ${statusCode} ${statusText}`);
      this.name = 'DomainAPIError';
      this.statusCode = statusCode;
      this.statusText = statusText;
    }
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────

import { MarketDataService, DomainSuburbPerformanceSchema } from './market-data-service';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Test Data ──────────────────────────────────────────────────────

const MOCK_DOMAIN_RESPONSE = {
  header: {
    suburb: 'Mosman',
    state: 'NSW',
    propertyCategory: 'house',
  },
  series: {
    seriesInfo: [
      {
        year: 2024,
        month: 3,
        values: {
          medianSoldPrice: 3200000,
          numberSold: 42,
          daysOnMarket: 35,
          auctionClearanceRate: 72.5,
          numberListed: 85,
          medianSoldPriceChange: 5.2,
        },
      },
      {
        year: 2025,
        month: 3,
        values: {
          medianSoldPrice: 3400000,
          numberSold: 38,
          daysOnMarket: 32,
          auctionClearanceRate: 75.0,
          numberListed: 90,
          medianSoldPriceChange: 6.25,
        },
      },
    ],
  },
};

const MOCK_DOMAIN_RESPONSE_EMPTY_SERIES = {
  header: {
    suburb: 'Remote',
    state: 'QLD',
    propertyCategory: 'house',
  },
  series: {
    seriesInfo: [],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────

function buildChainedMock(resolvedValue: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(resolvedValue);
  const maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  const limit = vi.fn().mockReturnValue({ single, maybeSingle });
  const order = vi.fn().mockReturnValue({ limit, maybeSingle, single });
  const ilike = vi.fn().mockReturnValue({ ilike: vi.fn().mockReturnValue({ order, limit, maybeSingle }), order, limit, maybeSingle });
  const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order, limit, maybeSingle }), order, limit, maybeSingle, ilike });
  const or = vi.fn().mockReturnValue({ order, limit, maybeSingle });
  const select = vi.fn().mockReturnValue({ eq, ilike, or, order, limit, maybeSingle, single });
  const upsert = vi.fn().mockResolvedValue({ error: null });

  return { select, upsert, eq, ilike, or, order, limit, maybeSingle, single };
}

// ─── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DomainSuburbPerformanceSchema', () => {
  it('validates a correct Domain API response', () => {
    const result = DomainSuburbPerformanceSchema.safeParse(MOCK_DOMAIN_RESPONSE);
    expect(result.success).toBe(true);
  });

  it('rejects a response missing the header', () => {
    const result = DomainSuburbPerformanceSchema.safeParse({ series: {} });
    expect(result.success).toBe(false);
  });

  it('allows missing series (defaults to empty array)', () => {
    const result = DomainSuburbPerformanceSchema.safeParse({
      header: { suburb: 'Test', state: 'NSW' },
    });
    expect(result.success).toBe(true);
  });
});

describe('MarketDataService.transformToSnapshot', () => {
  it('transforms a Domain API response to MarketSnapshot format', () => {
    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient);
    const snapshot = service.transformToSnapshot(MOCK_DOMAIN_RESPONSE, '2088');

    expect(snapshot.suburb).toBe('Mosman');
    expect(snapshot.state).toBe('NSW');
    expect(snapshot.medianPrice).toBe(3400000);
    expect(snapshot.daysOnMarket).toBe(32);
    expect(snapshot.auctionClearanceRate).toBe(75.0);
    expect(snapshot.totalListings).toBe(90);
    expect(snapshot.dataAsOf).toBeDefined();
  });

  it('calculates 12-month price change from series data', () => {
    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient);
    const snapshot = service.transformToSnapshot(MOCK_DOMAIN_RESPONSE, '2088');

    // (3400000 - 3200000) / 3200000 * 100 = 6.25
    expect(snapshot.medianPriceChange12m).toBe(6.25);
  });

  it('handles empty series data gracefully', () => {
    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient);
    const snapshot = service.transformToSnapshot(MOCK_DOMAIN_RESPONSE_EMPTY_SERIES, '4000');

    expect(snapshot.suburb).toBe('Remote');
    expect(snapshot.state).toBe('QLD');
    expect(snapshot.medianPrice).toBeUndefined();
    expect(snapshot.daysOnMarket).toBeUndefined();
    expect(snapshot.totalListings).toBeUndefined();
  });
});

describe('MarketDataService.fetchAndUpsert', () => {
  it('fetches from Domain API, transforms, and upserts successfully', async () => {
    mockGetSuburbPerformance.mockResolvedValue(MOCK_DOMAIN_RESPONSE);

    const mock = buildChainedMock({ data: null, error: null });
    mockFrom.mockReturnValue(mock);

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient, {
      cacheTtlMs: 0, // Disable cache for testing
    });

    const result = await service.fetchAndUpsert({
      suburb: 'Mosman',
      state: 'NSW',
      postcode: '2088',
      propertyType: 'house',
    });

    expect(result.success).toBe(true);
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.suburb).toBe('Mosman');
    expect(result.snapshot?.medianPrice).toBe(3400000);
    expect(result.error).toBeNull();
    expect(mockGetSuburbPerformance).toHaveBeenCalledWith('Mosman', 'NSW', '2088', 'house');
  });

  it('returns cached data on subsequent calls within TTL', async () => {
    mockGetSuburbPerformance.mockResolvedValue(MOCK_DOMAIN_RESPONSE);

    const mock = buildChainedMock({ data: null, error: null });
    mockFrom.mockReturnValue(mock);

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient, {
      cacheTtlMs: 60_000,
    });

    const query = { suburb: 'Mosman', state: 'NSW', postcode: '2088', propertyType: 'house' as const };

    await service.fetchAndUpsert(query);
    const result = await service.fetchAndUpsert(query);

    // Domain API should only be called once because second call hits cache
    expect(mockGetSuburbPerformance).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.snapshot?.suburb).toBe('Mosman');
  });

  it('returns error for invalid input', async () => {
    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient);

    const result = await service.fetchAndUpsert({
      suburb: '',
      state: 'NSW',
      postcode: '2088',
      propertyType: 'house',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid input');
    expect(mockGetSuburbPerformance).not.toHaveBeenCalled();
  });

  it('handles Domain API errors gracefully', async () => {
    const { DomainAPIError } = await import('@realflow/integrations/src/errors');
    mockGetSuburbPerformance.mockRejectedValue(
      new DomainAPIError('Rate limited', 429, 'Too Many Requests'),
    );

    const mock = buildChainedMock({ data: null, error: null });
    mockFrom.mockReturnValue(mock);

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient, {
      cacheTtlMs: 0,
    });

    const result = await service.fetchAndUpsert({
      suburb: 'Mosman',
      state: 'NSW',
      postcode: '2088',
      propertyType: 'house',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('rate limit');
    expect(result.snapshot).toBeNull();
  });

  it('handles generic API errors gracefully', async () => {
    mockGetSuburbPerformance.mockRejectedValue(new Error('Network timeout'));

    const mock = buildChainedMock({ data: null, error: null });
    mockFrom.mockReturnValue(mock);

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient, {
      cacheTtlMs: 0,
    });

    const result = await service.fetchAndUpsert({
      suburb: 'Mosman',
      state: 'NSW',
      postcode: '2088',
      propertyType: 'house',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
    expect(result.snapshot).toBeNull();
  });
});

describe('MarketDataService.bulkFetchAndUpsert', () => {
  it('processes multiple suburbs and returns aggregate results', async () => {
    mockGetSuburbPerformance.mockResolvedValue(MOCK_DOMAIN_RESPONSE);

    const mock = buildChainedMock({ data: null, error: null });
    mockFrom.mockReturnValue(mock);

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient, {
      cacheTtlMs: 0,
    });

    const result = await service.bulkFetchAndUpsert(
      [
        { suburb: 'Mosman', state: 'NSW', postcode: '2088', propertyType: 'house' },
        { suburb: 'Cremorne', state: 'NSW', postcode: '2090', propertyType: 'house' },
      ],
      { delayMs: 0 },
    );

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(2);
  });

  it('handles partial failures in bulk operations', async () => {
    mockGetSuburbPerformance
      .mockResolvedValueOnce(MOCK_DOMAIN_RESPONSE)
      .mockRejectedValueOnce(new Error('API failure'));

    const mock = buildChainedMock({ data: null, error: null });
    mockFrom.mockReturnValue(mock);

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient, {
      cacheTtlMs: 0,
    });

    const result = await service.bulkFetchAndUpsert(
      [
        { suburb: 'Mosman', state: 'NSW', postcode: '2088', propertyType: 'house' },
        { suburb: 'BadSuburb', state: 'NSW', postcode: '0000', propertyType: 'house' },
      ],
      { delayMs: 0 },
    );

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[1]?.success).toBe(false);
  });
});

describe('MarketDataService.getLatestSnapshot', () => {
  it('returns the latest snapshot from the database', async () => {
    const dbRow = {
      id: 'test-uuid',
      suburb: 'Mosman',
      state: 'NSW',
      postcode: '2088',
      median_price: 3400000,
      median_price_change_12m: 6.25,
      days_on_market: 32,
      auction_clearance_rate: 75.0,
      total_listings: 90,
      property_type: 'house',
      data_source: 'domain',
      data_as_of: '2025-03-01T00:00:00.000Z',
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const ilike2 = vi.fn().mockReturnValue({ order, eq });
    const ilike1 = vi.fn().mockReturnValue({ ilike: ilike2 });
    const select = vi.fn().mockReturnValue({ ilike: ilike1 });
    mockFrom.mockReturnValue({ select });

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient);
    const snapshot = await service.getLatestSnapshot('Mosman', 'NSW', 'house');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.suburb).toBe('Mosman');
    expect(snapshot?.medianPrice).toBe(3400000);
    expect(snapshot?.daysOnMarket).toBe(32);
  });

  it('returns null when no data exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const ilike2 = vi.fn().mockReturnValue({ order, eq });
    const ilike1 = vi.fn().mockReturnValue({ ilike: ilike2 });
    const select = vi.fn().mockReturnValue({ ilike: ilike1 });
    mockFrom.mockReturnValue({ select });

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient);
    const snapshot = await service.getLatestSnapshot('NonExistent', 'NSW');

    expect(snapshot).toBeNull();
  });
});

describe('MarketDataService.getSnapshotsForSuburbs', () => {
  it('returns empty array for empty suburb list', async () => {
    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient);
    const result = await service.getSnapshotsForSuburbs([]);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deduplicates snapshots by suburb+state+property_type', async () => {
    const dbRows = [
      {
        suburb: 'Mosman',
        state: 'NSW',
        median_price: 3400000,
        median_price_change_12m: 6.25,
        days_on_market: 32,
        auction_clearance_rate: 75.0,
        total_listings: 90,
        property_type: 'house',
        data_as_of: '2025-03-01T00:00:00.000Z',
      },
      {
        suburb: 'Mosman',
        state: 'NSW',
        median_price: 3200000,
        median_price_change_12m: 5.0,
        days_on_market: 34,
        auction_clearance_rate: 73.0,
        total_listings: 85,
        property_type: 'house',
        data_as_of: '2025-02-01T00:00:00.000Z',
      },
    ];

    const order = vi.fn().mockResolvedValue({ data: dbRows, error: null });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });
    mockFrom.mockReturnValue({ select });

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient);
    const result = await service.getSnapshotsForSuburbs([
      { suburb: 'Mosman', state: 'NSW' },
    ]);

    // Should return only the most recent (first in ordered results)
    expect(result).toHaveLength(1);
    expect(result[0]?.medianPrice).toBe(3400000);
  });
});

describe('MarketDataService.clearCache', () => {
  it('clears the in-memory cache so next fetch hits the API', async () => {
    mockGetSuburbPerformance.mockResolvedValue(MOCK_DOMAIN_RESPONSE);

    const mock = buildChainedMock({ data: null, error: null });
    mockFrom.mockReturnValue(mock);

    const service = new MarketDataService(mockSupabase as unknown as SupabaseClient, {
      cacheTtlMs: 60_000,
    });

    const query = { suburb: 'Mosman', state: 'NSW', postcode: '2088', propertyType: 'house' as const };

    await service.fetchAndUpsert(query);
    expect(mockGetSuburbPerformance).toHaveBeenCalledTimes(1);

    service.clearCache();
    await service.fetchAndUpsert(query);
    expect(mockGetSuburbPerformance).toHaveBeenCalledTimes(2);
  });
});
