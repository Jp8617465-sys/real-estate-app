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
    mockApiResponse({ listing: {} });

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
});

// ─── getListing ────────────────────────────────────────────────────

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

// ─── getSalesResults ───────────────────────────────────────────────

describe('DomainClient.getSalesResults', () => {
  it('calls correct endpoint with encoded params', async () => {
    const client = new DomainClient(validConfig);
    mockTokenResponse();
    mockApiResponse({ results: [] });

    await client.getSalesResults('North Sydney', 'NSW');

    const apiCall = mockFetch.mock.calls[1]!;
    expect(apiCall[0]).toBe(
      'https://api.domain.com.au/v1/salesResults/NSW/North%20Sydney',
    );
  });
});

// ─── getSuburbPerformance ──────────────────────────────────────────

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
