import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// ─── Hoisted mocks ────────────────────────────────────────────────

const { mockFrom, WEBHOOK_SECRET } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  WEBHOOK_SECRET: 'test-webhook-secret-for-testing',
}));

const mockServiceSupabase = { from: mockFrom };

vi.mock('../config/env', () => ({
  env: {
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    DOMAIN_WEBHOOK_SECRET: 'test-webhook-secret-for-testing',
    DOMAIN_CLIENT_ID: 'test-client-id',
    DOMAIN_CLIENT_SECRET: 'test-client-secret',
  },
}));

vi.mock('../middleware/supabase', () => ({
  createSupabaseServiceClient: () => mockServiceSupabase,
  createSupabaseClient: () => mockServiceSupabase,
}));

// ─── Mock integrations ────────────────────────────────────────────

vi.mock('@realflow/integrations', () => ({
  DomainClient: vi.fn().mockImplementation(function() { return {}; }),
  PropertySyncService: vi.fn().mockImplementation(function() { return {
    mapListing: vi.fn().mockReturnValue({
      domainListingId: '12345',
      addressStreetNumber: '1',
      addressStreet: 'Test St',
      addressSuburb: 'Mosman',
      addressState: 'NSW',
      addressPostcode: '2088',
      addressCountry: 'AU',
      propertyType: 'house',
      bedrooms: 3,
      bathrooms: 2,
      carSpaces: 1,
      landSize: null,
      buildingSize: null,
      yearBuilt: null,
      listPrice: 1500000,
      priceGuide: null,
      listingStatus: 'active',
      saleType: 'sale',
      auctionDate: null,
      listingDescription: 'Test listing',
      photos: [],
      floorPlans: [],
      virtualTourUrl: null,
      features: [],
    }),
  }; }),
  DomainWebhookEventSchema: {
    safeParse: vi.fn().mockImplementation((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d.type) return { success: false, error: { flatten: () => ({ fieldErrors: {} }) } };
      return { success: true, data };
    }),
  },
}));

// ─── Mock business-logic ──────────────────────────────────────────

vi.mock('@realflow/business-logic', () => ({
  PropertyMatchEngine: {
    scoreProperty: vi.fn().mockReturnValue({ overallScore: 85 }),
  },
}));

// ─── Helper: Generate valid HMAC signature ────────────────────────

function signBody(body: string): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(Buffer.from(body))
    .digest('hex');
}

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { domainWebhookRoutes } from './domain-webhooks';

// ─── Test setup ───────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(domainWebhookRoutes, { prefix: '/api/webhooks/domain' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /listing-alert ──────────────────────────────────────────

describe('POST /api/webhooks/domain/listing-alert', () => {
  const validPayload = {
    type: 'listing.created',
    listingId: '12345',
    listing: {
      id: '12345',
      type: 'House',
      headline: 'Beautiful home',
      addressParts: {
        streetNumber: '1',
        street: 'Test St',
        suburb: 'Mosman',
        state: 'NSW',
        postcode: '2088',
        displayAddress: '1 Test St, Mosman NSW 2088',
      },
      bedrooms: 3,
      bathrooms: 2,
      carSpaces: 1,
      listingType: 'Sale',
      priceDetails: {},
      media: [],
      features: [],
      inspectionSchedule: {},
    },
  };

  it('returns 401 when signature header is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/domain/listing-alert',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when signature is invalid', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/domain/listing-alert',
      headers: { 'x-domain-signature': 'invalid-signature' },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 200 with valid signature and payload', async () => {
    const body = JSON.stringify(validPayload);
    const signature = signBody(body);

    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: '00000000-0000-0000-0000-000000000001', assigned_agent_id: null },
            error: null,
          }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/domain/listing-alert',
      headers: {
        'x-domain-signature': signature,
        'content-type': 'application/json',
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.payload);
    expect(responseBody.received).toBe(true);
  });

  it('returns 400 with valid signature but invalid payload', async () => {
    const invalidPayload = { notAValidField: 'test' };
    const body = JSON.stringify(invalidPayload);
    const signature = signBody(body);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/domain/listing-alert',
      headers: { 'x-domain-signature': signature },
      payload: invalidPayload,
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /price-update ──────────────────────────────────────────

describe('POST /api/webhooks/domain/price-update', () => {
  const validPayload = {
    type: 'listing.priceUpdated',
    listingId: '12345',
    previousPrice: 1500000,
    newPrice: 1450000,
  };

  it('returns 401 when signature header is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/domain/price-update',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 200 with valid signature', async () => {
    const body = JSON.stringify(validPayload);
    const signature = signBody(body);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/domain/price-update',
      headers: { 'x-domain-signature': signature },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.payload);
    expect(responseBody.received).toBe(true);
  });
});

// ─── POST /status-change ─────────────────────────────────────────

describe('POST /api/webhooks/domain/status-change', () => {
  const validPayload = {
    type: 'listing.statusChanged',
    listingId: '12345',
    previousStatus: 'live',
    newStatus: 'sold',
  };

  it('returns 401 when signature header is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/domain/status-change',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 200 with valid signature', async () => {
    const body = JSON.stringify(validPayload);
    const signature = signBody(body);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/domain/status-change',
      headers: { 'x-domain-signature': signature },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.payload);
    expect(responseBody.received).toBe(true);
  });
});
