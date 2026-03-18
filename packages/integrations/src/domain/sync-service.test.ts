import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PropertySyncService } from './sync-service';
import type { DomainListing, DomainSearchResponse } from './types';

// ─── Mock Domain Client ─────────────────────────────────────────────────────

const mockClient = {
  searchListings: vi.fn(),
  getListingDetails: vi.fn(),
  getListing: vi.fn(),
  getAgentProfile: vi.fn(),
  getPropertyHistory: vi.fn(),
  subscribeToAlerts: vi.fn(),
  unsubscribeFromAlert: vi.fn(),
  getAuctionResults: vi.fn(),
  getSalesResults: vi.fn(),
  getSuburbPerformance: vi.fn(),
  clearCache: vi.fn(),
  clearCacheByPattern: vi.fn(),
};

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeDomainListing(overrides: Partial<DomainListing> = {}): DomainListing {
  return {
    id: 'dom-100',
    addressParts: {
      streetNumber: '42',
      street: 'Latrobe Terrace',
      suburb: 'Paddington',
      state: 'QLD',
      postCode: '4064',
    },
    priceDetails: { price: 950000 },
    propertyTypes: ['House'],
    bedrooms: 4,
    bathrooms: 2,
    carspaces: 2,
    landAreaSqm: 600,
    headline: 'Stunning Paddington Queenslander',
    description:
      'A beautiful renovated kitchen with north-facing backyard. Features pool and study.',
    saleMode: 'auction',
    status: 'live',
    auctionSchedule: { time: '2026-04-01T10:00:00Z' },
    media: [
      { imageUrl: 'https://images.domain.com.au/photo1.jpg', rank: 0 },
      {
        imageUrl: 'https://images.domain.com.au/photo2.jpg',
        fullUrl: 'https://images.domain.com.au/photo2-full.jpg',
        rank: 1,
      },
    ],
    floorplans: [{ imageUrl: 'https://images.domain.com.au/floorplan1.jpg' }],
    agents: [
      {
        agentId: 'agent-1',
        name: 'Jane Smith',
        email: 'jane@agency.com.au',
        phone: '0400000000',
        agencyName: 'Ray White',
      },
    ],
    features: ['Air Conditioning', 'Pool', 'Garden'],
    dateListed: '2026-02-15T00:00:00Z',
    dateUpdated: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── mapListing ─────────────────────────────────────────────────────────────

describe('PropertySyncService.mapListing', () => {
  const syncService = new PropertySyncService(mockClient as never);

  it('maps a complete Domain listing to RealFlow format', () => {
    const listing = makeDomainListing();
    const mapped = syncService.mapListing(listing);

    expect(mapped.domainListingId).toBe('dom-100');
    expect(mapped.addressStreetNumber).toBe('42');
    expect(mapped.addressStreet).toBe('Latrobe Terrace');
    expect(mapped.addressSuburb).toBe('Paddington');
    expect(mapped.addressState).toBe('QLD');
    expect(mapped.addressPostcode).toBe('4064');
    expect(mapped.addressCountry).toBe('Australia');
    expect(mapped.propertyType).toBe('house');
    expect(mapped.bedrooms).toBe(4);
    expect(mapped.bathrooms).toBe(2);
    expect(mapped.carSpaces).toBe(2);
    expect(mapped.landSize).toBe(600);
    expect(mapped.listPrice).toBe(950000);
    expect(mapped.saleType).toBe('auction');
    expect(mapped.listingStatus).toBe('active');
    expect(mapped.auctionDate).toBe('2026-04-01T10:00:00Z');
    expect(mapped.listingDescription).toContain('beautiful renovated kitchen');
  });

  it('maps photos correctly, sorting by rank', () => {
    const listing = makeDomainListing();
    const mapped = syncService.mapListing(listing);

    expect(mapped.photos).toHaveLength(2);
    expect(mapped.photos[0].isPrimary).toBe(true);
    expect(mapped.photos[0].sortOrder).toBe(0);
    // Second photo should prefer fullUrl
    expect(mapped.photos[1].url).toBe('https://images.domain.com.au/photo2-full.jpg');
  });

  it('maps floorplans to URL array', () => {
    const listing = makeDomainListing();
    const mapped = syncService.mapListing(listing);

    expect(mapped.floorPlans).toEqual(['https://images.domain.com.au/floorplan1.jpg']);
  });

  it('maps agents correctly', () => {
    const listing = makeDomainListing();
    const mapped = syncService.mapListing(listing);

    expect(mapped.agents).toHaveLength(1);
    expect(mapped.agents[0].agentId).toBe('agent-1');
    expect(mapped.agents[0].name).toBe('Jane Smith');
    expect(mapped.agents[0].agencyName).toBe('Ray White');
  });

  it('handles listing with no media', () => {
    const listing = makeDomainListing({ media: undefined, floorplans: undefined });
    const mapped = syncService.mapListing(listing);

    expect(mapped.photos).toEqual([]);
    expect(mapped.floorPlans).toEqual([]);
  });

  it('handles listing with no agents', () => {
    const listing = makeDomainListing({ agents: undefined });
    const mapped = syncService.mapListing(listing);

    expect(mapped.agents).toEqual([]);
  });

  it('maps property types correctly', () => {
    const types: Array<[string, string]> = [
      ['House', 'house'],
      ['Townhouse', 'townhouse'],
      ['ApartmentUnitFlat', 'apartment'],
      ['Unit', 'unit'],
      ['Villa', 'villa'],
      ['VacantLand', 'land'],
      ['Studio', 'studio'],
      ['Duplex', 'duplex'],
    ];

    for (const [domainType, expected] of types) {
      const listing = makeDomainListing({ propertyTypes: [domainType] });
      const mapped = syncService.mapListing(listing);
      expect(mapped.propertyType).toBe(expected);
    }
  });

  it('maps listing status correctly', () => {
    const statuses: Array<[string, string]> = [
      ['live', 'active'],
      ['underOffer', 'under-offer'],
      ['sold', 'sold'],
      ['withdrawn', 'withdrawn'],
      ['leased', 'leased'],
    ];

    for (const [domainStatus, expected] of statuses) {
      const listing = makeDomainListing({ status: domainStatus });
      const mapped = syncService.mapListing(listing);
      expect(mapped.listingStatus).toBe(expected);
    }
  });

  it('maps sale types correctly', () => {
    const saleTypes: Array<[string, string]> = [
      ['auction', 'auction'],
      ['privateTreaty', 'private-treaty'],
      ['tender', 'tender'],
      ['expressionOfInterest', 'expression-of-interest'],
    ];

    for (const [domainMode, expected] of saleTypes) {
      const listing = makeDomainListing({ saleMode: domainMode });
      const mapped = syncService.mapListing(listing);
      expect(mapped.saleType).toBe(expected);
    }
  });

  it('uses priceGuide when no numeric price is available', () => {
    const listing = makeDomainListing({
      priceDetails: { displayPrice: 'Offers Over $900,000' },
      headline: 'Stunning Home',
    });
    const mapped = syncService.mapListing(listing);

    expect(mapped.listPrice).toBeNull();
    expect(mapped.priceGuide).toBe('Offers Over $900,000');
  });

  it('defaults to house when property type is missing', () => {
    const listing = makeDomainListing({ propertyTypes: undefined });
    const mapped = syncService.mapListing(listing);
    expect(mapped.propertyType).toBe('house');
  });

  it('extracts features array', () => {
    const listing = makeDomainListing();
    const mapped = syncService.mapListing(listing);
    expect(mapped.features).toEqual(['Air Conditioning', 'Pool', 'Garden']);
  });
});

// ─── syncListings ───────────────────────────────────────────────────────────

describe('PropertySyncService.syncListings', () => {
  it('fetches listings and returns mapped properties', async () => {
    const syncService = new PropertySyncService(mockClient as never, {
      delayBetweenCallsMs: 0,
    });

    mockClient.searchListings.mockResolvedValue({
      listings: [makeDomainListing()],
      totalResults: 1,
    } as DomainSearchResponse);

    const { properties, result } = await syncService.syncListings(
      [{ suburb: 'Paddington', state: 'QLD', postcode: '4064' }],
      new Map(),
    );

    expect(properties).toHaveLength(1);
    expect(result.listingsFound).toBe(1);
    expect(result.listingsCreated).toBe(1);
    expect(result.listingsUpdated).toBe(0);
  });

  it('detects price changes for existing listings', async () => {
    const syncService = new PropertySyncService(mockClient as never, {
      delayBetweenCallsMs: 0,
    });

    mockClient.searchListings.mockResolvedValue({
      listings: [makeDomainListing({ id: 'dom-100', priceDetails: { price: 900000 } })],
      totalResults: 1,
    } as DomainSearchResponse);

    const existingListings = new Map([['dom-100', { listPrice: 950000, listingStatus: 'active' }]]);

    const { priceChanges, result } = await syncService.syncListings(
      [{ suburb: 'Paddington', state: 'QLD', postcode: '4064' }],
      existingListings,
    );

    expect(priceChanges).toHaveLength(1);
    expect(priceChanges[0].changeType).toBe('reduction');
    expect(priceChanges[0].previousPrice).toBe(950000);
    expect(priceChanges[0].newPrice).toBe(900000);
    expect(result.priceChangesDetected).toBe(1);
  });

  it('detects status changes for existing listings', async () => {
    const syncService = new PropertySyncService(mockClient as never, {
      delayBetweenCallsMs: 0,
    });

    mockClient.searchListings.mockResolvedValue({
      listings: [makeDomainListing({ id: 'dom-100', status: 'underOffer' })],
      totalResults: 1,
    } as DomainSearchResponse);

    const existingListings = new Map([['dom-100', { listPrice: 950000, listingStatus: 'active' }]]);

    const { statusChanges, result } = await syncService.syncListings(
      [{ suburb: 'Paddington', state: 'QLD', postcode: '4064' }],
      existingListings,
    );

    expect(statusChanges).toHaveLength(1);
    expect(statusChanges[0].previousStatus).toBe('active');
    expect(statusChanges[0].newStatus).toBe('under-offer');
    expect(result.statusChangesDetected).toBe(1);
  });

  it('deduplicates listings across multiple search params', async () => {
    const syncService = new PropertySyncService(mockClient as never, {
      delayBetweenCallsMs: 0,
    });

    const listing = makeDomainListing({ id: 'dom-100' });

    mockClient.searchListings
      .mockResolvedValueOnce({ listings: [listing], totalResults: 1 })
      .mockResolvedValueOnce({ listings: [listing], totalResults: 1 });

    const { properties, result } = await syncService.syncListings(
      [
        { suburb: 'Paddington', state: 'QLD', postcode: '4064' },
        { suburb: 'Paddington', state: 'QLD', postcode: '4064', minPrice: 500000 },
      ],
      new Map(),
    );

    expect(properties).toHaveLength(1);
    expect(result.listingsFound).toBe(1);
  });

  it('respects maxListingsPerSync limit', async () => {
    const syncService = new PropertySyncService(mockClient as never, {
      maxListingsPerSync: 2,
      delayBetweenCallsMs: 0,
    });

    const listings = Array.from({ length: 5 }, (_, i) => makeDomainListing({ id: `dom-${i}` }));

    mockClient.searchListings.mockResolvedValue({
      listings,
      totalResults: 5,
    });

    const { properties } = await syncService.syncListings(
      [{ suburb: 'Paddington', state: 'QLD', postcode: '4064' }],
      new Map(),
    );

    expect(properties).toHaveLength(2);
  });

  it('records errors for failed mappings without stopping sync', async () => {
    const syncService = new PropertySyncService(mockClient as never, {
      delayBetweenCallsMs: 0,
    });

    // One valid listing and one that will cause issues
    mockClient.searchListings.mockResolvedValue({
      listings: [
        makeDomainListing({ id: 'dom-100' }),
        makeDomainListing({ id: undefined, listingId: undefined }), // No ID
      ],
      totalResults: 2,
    });

    const { properties, result } = await syncService.syncListings(
      [{ suburb: 'Paddington', state: 'QLD', postcode: '4064' }],
      new Map(),
    );

    // Should still process valid listings
    expect(properties).toHaveLength(1);
    expect(result.listingsFound).toBe(1);
  });

  it('records fetch errors without stopping sync', async () => {
    const syncService = new PropertySyncService(mockClient as never, {
      delayBetweenCallsMs: 0,
    });

    mockClient.searchListings
      .mockRejectedValueOnce(new Error('Domain API 503'))
      .mockResolvedValueOnce({
        listings: [makeDomainListing({ id: 'dom-200' })],
        totalResults: 1,
      });

    const { properties, result } = await syncService.syncListings(
      [
        { suburb: 'FailSuburb', state: 'QLD', postcode: '4000' },
        { suburb: 'Paddington', state: 'QLD', postcode: '4064' },
      ],
      new Map(),
    );

    expect(properties).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].phase).toBe('fetch');
  });

  it('detects price_guide_set when previous price is null', async () => {
    const syncService = new PropertySyncService(mockClient as never, {
      delayBetweenCallsMs: 0,
    });

    mockClient.searchListings.mockResolvedValue({
      listings: [makeDomainListing({ id: 'dom-100', priceDetails: { price: 900000 } })],
      totalResults: 1,
    });

    const existingListings = new Map([['dom-100', { listPrice: null, listingStatus: 'active' }]]);

    const { priceChanges } = await syncService.syncListings(
      [{ suburb: 'Paddington', state: 'QLD', postcode: '4064' }],
      existingListings,
    );

    expect(priceChanges).toHaveLength(1);
    expect(priceChanges[0].changeType).toBe('price_guide_set');
  });
});

// ─── syncSingleListing ──────────────────────────────────────────────────────

describe('PropertySyncService.syncSingleListing', () => {
  it('fetches and maps a single listing', async () => {
    const syncService = new PropertySyncService(mockClient as never);

    mockClient.getListingDetails.mockResolvedValue(makeDomainListing());

    const { property } = await syncService.syncSingleListing('dom-100');

    expect(property.domainListingId).toBe('dom-100');
    expect(property.bedrooms).toBe(4);
  });

  it('detects price change for single listing', async () => {
    const syncService = new PropertySyncService(mockClient as never);

    mockClient.getListingDetails.mockResolvedValue(
      makeDomainListing({ priceDetails: { price: 900000 } }),
    );

    const { priceChange } = await syncService.syncSingleListing('dom-100', {
      listPrice: 950000,
      listingStatus: 'active',
    });

    expect(priceChange).not.toBeNull();
    expect(priceChange?.changeType).toBe('reduction');
    expect(priceChange?.changePercent).toBeCloseTo(-5.26, 1);
  });

  it('detects status change for single listing', async () => {
    const syncService = new PropertySyncService(mockClient as never);

    mockClient.getListingDetails.mockResolvedValue(makeDomainListing({ status: 'sold' }));

    const { statusChange } = await syncService.syncSingleListing('dom-100', {
      listPrice: 950000,
      listingStatus: 'active',
    });

    expect(statusChange).not.toBeNull();
    expect(statusChange?.previousStatus).toBe('active');
    expect(statusChange?.newStatus).toBe('sold');
  });

  it('returns null changes when no existing listing provided', async () => {
    const syncService = new PropertySyncService(mockClient as never);

    mockClient.getListingDetails.mockResolvedValue(makeDomainListing());

    const { priceChange, statusChange } = await syncService.syncSingleListing('dom-100');

    expect(priceChange).toBeNull();
    expect(statusChange).toBeNull();
  });
});
