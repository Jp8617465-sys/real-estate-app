import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DomainClient } from './client';

// ─── Setup ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();

const validConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  baseUrl: 'https://auth.domain.com.au',
  apiBaseUrl: 'https://api.domain.com.au/v1',
  scopes: ['api_listings_read'],
  rateLimit: { maxRequests: 1000, windowMs: 60_000 },
  cache: { enabled: false, defaultTtlMs: 0, ttlOverrides: {} },
};

function mockTokenResponse() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      access_token: 'test-token-123',
      token_type: 'Bearer',
      expires_in: 3600,
    }),
  });
}

function mockApiResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Constructor ───────────────────────────────────────────────────

describe('DomainClient constructor', () => {
  it('creates client with valid config', () => {
    const client = new DomainClient(validConfig);
    expect(client).toBeDefined();
  });

  it('throws on invalid config (missing clientId)', () => {
    expect(() => new DomainClient({ ...validConfig, clientId: undefined } as never)).toThrow();
  });

  it('uses default baseUrl and apiBaseUrl', () => {
    const client = new DomainClient({
      clientId: 'test',
      clientSecret: 'secret',
    });
    expect(client).toBeDefined();
  });
});

// ─── Authentication ────────────────────────────────────────────────

describe('DomainClient authentication', () => {
  it('authenticates before making API requests', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ listings: [] });

    await client.searchListings({ suburb: 'Sydney', state: 'NSW', postcode: '2000' });

    // First call should be to auth endpoint
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const authCall = mockFetch.mock.calls[0]!;
    expect(authCall[0]).toBe('https://auth.domain.com.au/v1/connect/token');
    expect(authCall[1]?.method).toBe('POST');
  });

  it('reuses cached token for subsequent requests', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ listings: [] });
    mockApiResponse({ id: '123' });

    await client.searchListings({ suburb: 'Sydney', state: 'NSW', postcode: '2000' });
    await client.getListing('123');

    // Token fetched once, then two API calls = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws on auth failure', async () => {
    const client = new DomainClient(validConfig);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(
      client.searchListings({ suburb: 'Sydney', state: 'NSW', postcode: '2000' }),
    ).rejects.toThrow('Domain auth failed: 401 Unauthorized');
  });
});

// ─── searchListings ────────────────────────────────────────────────

describe('DomainClient.searchListings', () => {
  it('sends correct request body', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ listings: [] });

    await client.searchListings({
      suburb: 'Paddington',
      state: 'NSW',
      postcode: '2021',
      propertyTypes: ['house', 'townhouse'],
      minBedrooms: 3,
      maxPrice: 2000000,
    });

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe('https://api.domain.com.au/v1/listings/residential/_search');
    expect(apiCall[1]?.method).toBe('POST');

    const body = JSON.parse(apiCall[1]?.body as string);
    expect(body.listingType).toBe('Sale');
    expect(body.locations[0].suburb).toBe('Paddington');
    expect(body.locations[0].state).toBe('NSW');
    expect(body.propertyTypes).toEqual(['house', 'townhouse']);
    expect(body.minBedrooms).toBe(3);
  });

  it('uses default pageSize and pageNumber', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ listings: [] });

    await client.searchListings({ suburb: 'Sydney', state: 'NSW', postcode: '2000' });

    const apiCall = mockFetch.mock.calls[1]!;
    const body = JSON.parse(apiCall[1]?.body as string);
    expect(body.pageSize).toBe(20);
    expect(body.pageNumber).toBe(1);
  });

  it('includes authorization header with token', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ listings: [] });

    await client.searchListings({ suburb: 'Sydney', state: 'NSW', postcode: '2000' });

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer test-token-123' }),
    );
  });

  it('validates response with Zod schema', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({
      listings: [
        {
          id: '12345',
          addressParts: { suburb: 'Paddington', state: 'NSW', postCode: '2021' },
          bedrooms: 3,
          bathrooms: 2,
          carspaces: 1,
          priceDetails: { price: 1500000 },
          propertyTypes: ['House'],
        },
      ],
      totalResults: 1,
    });

    const result = await client.searchListings({
      suburb: 'Paddington',
      state: 'NSW',
      postcode: '2021',
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings?.[0]?.bedrooms).toBe(3);
    expect(result.totalResults).toBe(1);
  });

  it('supports minBathrooms and maxBathrooms params', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ listings: [] });

    await client.searchListings({
      suburb: 'Sydney',
      state: 'NSW',
      postcode: '2000',
      minBathrooms: 2,
      maxBathrooms: 4,
    });

    const apiCall = mockFetch.mock.calls[1]!;
    const body = JSON.parse(apiCall[1]?.body as string);
    expect(body.minBathrooms).toBe(2);
    expect(body.maxBathrooms).toBe(4);
  });

  it('supports land area search params', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ listings: [] });

    await client.searchListings({
      suburb: 'Sydney',
      state: 'NSW',
      postcode: '2000',
      minLandArea: 400,
      maxLandArea: 800,
    });

    const apiCall = mockFetch.mock.calls[1]!;
    const body = JSON.parse(apiCall[1]?.body as string);
    expect(body.minLandArea).toBe(400);
    expect(body.maxLandArea).toBe(800);
  });
});

// ─── getListingDetails ────────────────────────────────────────────

describe('DomainClient.getListingDetails', () => {
  it('calls correct endpoint and validates response', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({
      id: 'listing-123',
      addressParts: { suburb: 'Paddington', state: 'NSW', postCode: '2021' },
      bedrooms: 4,
      bathrooms: 2,
      carspaces: 2,
      priceDetails: { price: 2000000, displayPrice: '$2,000,000' },
      media: [
        { imageUrl: 'https://example.com/photo1.jpg', rank: 0 },
        { imageUrl: 'https://example.com/photo2.jpg', rank: 1 },
      ],
      agents: [
        { agentId: 'agent-1', name: 'Jane Smith', phone: '0400000000' },
      ],
      features: ['Air Conditioning', 'Pool', 'Garden'],
    });

    const result = await client.getListingDetails('listing-123');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe('https://api.domain.com.au/v1/listings/listing-123');

    expect(result.id).toBe('listing-123');
    expect(result.bedrooms).toBe(4);
    expect(result.media).toHaveLength(2);
    expect(result.agents).toHaveLength(1);
    expect(result.features).toEqual(['Air Conditioning', 'Pool', 'Garden']);
  });

  it('throws on API error', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(client.getListingDetails('nonexistent')).rejects.toThrow('Domain API error: 404 Not Found');
  });
});

// ─── getListing (backwards compatibility) ─────────────────────────

describe('DomainClient.getListing', () => {
  it('calls correct endpoint', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ id: 'listing-123' });

    await client.getListing('listing-123');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe('https://api.domain.com.au/v1/listings/listing-123');
  });

  it('throws on API error', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(client.getListing('nonexistent')).rejects.toThrow('Domain API error: 404 Not Found');
  });
});

// ─── getAgentProfile ──────────────────────────────────────────────

describe('DomainClient.getAgentProfile', () => {
  it('calls correct endpoint and validates response', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({
      agentId: 'agent-1',
      name: 'Jane Smith',
      email: 'jane@realestate.com.au',
      phone: '0400000000',
      biography: 'Top selling agent in Paddington',
      agencyName: 'Ray White Paddington',
      salesCount: 120,
      averageSalePrice: 1800000,
    });

    const result = await client.getAgentProfile('agent-1');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe('https://api.domain.com.au/v1/agents/agent-1');

    expect(result.agentId).toBe('agent-1');
    expect(result.name).toBe('Jane Smith');
    expect(result.agencyName).toBe('Ray White Paddington');
    expect(result.salesCount).toBe(120);
  });
});

// ─── getPropertyHistory ───────────────────────────────────────────

describe('DomainClient.getPropertyHistory', () => {
  it('calls correct endpoint and validates response', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({
      propertyId: 'prop-1',
      address: { suburb: 'Paddington', state: 'NSW', postCode: '2021' },
      propertyType: 'House',
      history: [
        { date: '2024-06-15', type: 'sold', price: 1800000, agency: 'Ray White' },
        { date: '2020-03-01', type: 'sold', price: 1400000, agency: 'McGrath' },
        { date: '2018-01-10', type: 'listed', price: 1500000 },
      ],
    });

    const result = await client.getPropertyHistory('prop-1');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe('https://api.domain.com.au/v1/properties/prop-1');

    expect(result.propertyId).toBe('prop-1');
    expect(result.history).toHaveLength(3);
    expect(result.history[0].type).toBe('sold');
    expect(result.history[0].price).toBe(1800000);
  });
});

// ─── subscribeToAlerts ────────────────────────────────────────────

describe('DomainClient.subscribeToAlerts', () => {
  it('sends correct request body and validates response', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({
      id: 'alert-1',
      criteria: {
        suburbs: [{ suburb: 'Paddington', state: 'NSW', postCode: '2021' }],
        minBedrooms: 3,
        maxPrice: 2000000,
        listingType: 'Sale',
      },
      webhookUrl: 'https://api.realflow.com.au/webhooks/domain/listing-alert',
      active: true,
      createdAt: '2026-03-04T00:00:00Z',
    });

    const result = await client.subscribeToAlerts(
      {
        suburbs: [{ suburb: 'Paddington', state: 'NSW', postCode: '2021' }],
        minBedrooms: 3,
        maxPrice: 2000000,
        listingType: 'Sale',
      },
      'https://api.realflow.com.au/webhooks/domain/listing-alert',
    );

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe('https://api.domain.com.au/v1/listings/alerts');
    expect(apiCall[1]?.method).toBe('POST');

    const body = JSON.parse(apiCall[1]?.body as string);
    expect(body.suburbs[0].suburb).toBe('Paddington');
    expect(body.webhookUrl).toBe('https://api.realflow.com.au/webhooks/domain/listing-alert');

    expect(result.id).toBe('alert-1');
    expect(result.active).toBe(true);
  });
});

// ─── unsubscribeFromAlert ─────────────────────────────────────────

describe('DomainClient.unsubscribeFromAlert', () => {
  it('calls DELETE on the correct endpoint', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({});

    await client.unsubscribeFromAlert('alert-1');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe('https://api.domain.com.au/v1/listings/alerts/alert-1');
    expect(apiCall[1]?.method).toBe('DELETE');
  });
});

// ─── getAuctionResults ────────────────────────────────────────────

describe('DomainClient.getAuctionResults', () => {
  it('calls correct endpoint with encoded params', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ salesResults: [] });

    await client.getAuctionResults('North Sydney', undefined, 'NSW');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe(
      'https://api.domain.com.au/v1/salesResults/NSW/North%20Sydney',
    );
  });

  it('appends date range query parameters', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ salesResults: [] });

    await client.getAuctionResults(
      'Paddington',
      { from: '2026-01-01', to: '2026-03-01' },
      'NSW',
    );

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toContain('from=2026-01-01');
    expect(apiCall[0]).toContain('to=2026-03-01');
  });

  it('validates response with Zod schema', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({
      salesResults: [
        {
          domainListingId: 'dom-1',
          suburb: 'Paddington',
          postcode: '2021',
          state: 'NSW',
          result: 'sold',
          soldPrice: 1800000,
          registeredBidders: 5,
        },
      ],
    });

    const result = await client.getAuctionResults('Paddington', undefined, 'NSW');

    expect(result.salesResults).toHaveLength(1);
    expect(result.salesResults?.[0]?.soldPrice).toBe(1800000);
  });
});

// ─── getSalesResults (backwards compatibility) ────────────────────

describe('DomainClient.getSalesResults', () => {
  it('calls correct endpoint with encoded params', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ salesResults: [] });

    await client.getSalesResults('North Sydney', 'NSW');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe(
      'https://api.domain.com.au/v1/salesResults/NSW/North%20Sydney',
    );
  });
});

// ─── getSuburbPerformance ─────────────────────────────────────────

describe('DomainClient.getSuburbPerformance', () => {
  it('calls correct endpoint with propertyType query param', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ stats: {} });

    await client.getSuburbPerformance('Surry Hills', 'NSW', '2010', 'house');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe(
      'https://api.domain.com.au/v1/suburbPerformanceStatistics/NSW/Surry%20Hills/2010?propertyCategory=house',
    );
  });

  it('supports unit property type', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ stats: {} });

    await client.getSuburbPerformance('Sydney', 'NSW', '2000', 'unit');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toContain('propertyCategory=unit');
  });
});

// ─── Rate Limiting ────────────────────────────────────────────────

describe('DomainClient rate limiting', () => {
  it('handles 429 responses with retry', async () => {
    const client = new DomainClient({
      ...validConfig,
      rateLimit: { maxRequests: 1000, windowMs: 60_000 },
    });
    mockTokenResponse();

    // First API call returns 429
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Map([['Retry-After', '1']]),
    });

    // Retry returns success
    mockApiResponse({ listings: [] });

    const result = await client.searchListings({
      suburb: 'Sydney',
      state: 'NSW',
      postcode: '2000',
    });

    expect(result).toBeDefined();
    // Auth + 429 + retry = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ─── Caching ──────────────────────────────────────────────────────

describe('DomainClient caching', () => {
  it('returns cached results for identical GET requests', async () => {
    const client = new DomainClient({
      ...validConfig,
      cache: {
        enabled: true,
        defaultTtlMs: 60_000,
        ttlOverrides: { 'agents/': 300_000 },
      },
    });
    mockTokenResponse();
    mockApiResponse({
      agentId: 'agent-1',
      name: 'Jane Smith',
    });

    // First call
    const result1 = await client.getAgentProfile('agent-1');
    // Second call (should be cached)
    const result2 = await client.getAgentProfile('agent-1');

    expect(result1.name).toBe('Jane Smith');
    expect(result2.name).toBe('Jane Smith');
    // Only 2 fetch calls (1 auth + 1 API), second request served from cache
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('clearCache removes all cached entries', async () => {
    const client = new DomainClient({
      ...validConfig,
      cache: {
        enabled: true,
        defaultTtlMs: 60_000,
        ttlOverrides: {},
      },
    });
    mockTokenResponse();
    mockApiResponse({
      agentId: 'agent-1',
      name: 'Jane Smith',
    });
    mockApiResponse({
      agentId: 'agent-1',
      name: 'Jane Smith Updated',
    });

    await client.getAgentProfile('agent-1');
    client.clearCache();
    const result2 = await client.getAgentProfile('agent-1');

    // After clearing cache, a new fetch should happen
    expect(mockFetch).toHaveBeenCalledTimes(3); // auth + 2 API calls
    expect(result2.name).toBe('Jane Smith Updated');
  });

  it('does not cache when caching is disabled', async () => {
    const client = new DomainClient({
      ...validConfig,
      cache: { enabled: false, defaultTtlMs: 0, ttlOverrides: {} },
    });
    mockTokenResponse();
    mockApiResponse({
      agentId: 'agent-1',
      name: 'Jane Smith',
    });
    mockApiResponse({
      agentId: 'agent-1',
      name: 'Jane Smith',
    });

    await client.getAgentProfile('agent-1');
    await client.getAgentProfile('agent-1');

    // Both calls should hit the API
    expect(mockFetch).toHaveBeenCalledTimes(3); // auth + 2 API calls
  });
});
