import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────

const { mockFrom, mockGetUser, mockGetLatestSnapshot, mockGetHistoricalSnapshots, mockBulkFetchAndUpsert, mockGetActiveSuburbs } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetLatestSnapshot: vi.fn(),
  mockGetHistoricalSnapshots: vi.fn(),
  mockBulkFetchAndUpsert: vi.fn(),
  mockGetActiveSuburbs: vi.fn(),
}));

const mockSupabase = {
  from: mockFrom,
  auth: { getUser: mockGetUser },
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
  createSupabaseServiceClient: () => mockSupabase,
}));

vi.mock('../services/market-data-service', async () => {
  // Use dynamic import of zod so it's available inside the hoisted factory
  const { z } = await import('zod');
  const SuburbQuerySchema = z.object({
    suburb: z.string().min(1),
    state: z.string().min(1),
    postcode: z.string().min(3),
    propertyType: z.enum(['house', 'unit']).default('house'),
  });
  return {
    MarketDataService: vi.fn().mockImplementation(function() {
      return {
        getLatestSnapshot: mockGetLatestSnapshot,
        getHistoricalSnapshots: mockGetHistoricalSnapshots,
        bulkFetchAndUpsert: mockBulkFetchAndUpsert,
        getActiveSuburbs: mockGetActiveSuburbs,
      };
    }),
    SuburbQuerySchema,
  };
});

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { marketDataRoutes } from './market-data';

// ─── Test setup ───────────────────────────────────────────────────

const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abc';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

async function buildApp() {
  const app = Fastify();
  await app.register(marketDataRoutes, { prefix: '/api/v1/market-data' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: MOCK_USER_ID } },
    error: null,
  });
});

// ─── GET /:suburb ─────────────────────────────────────────────────

describe('GET /api/v1/market-data/:suburb', () => {
  it('returns market data for a suburb', async () => {
    const snapshot = {
      id: '00000000-0000-0000-0000-000000000001',
      suburb: 'Mosman',
      state: 'NSW',
      medianPrice: 3500000,
    };

    mockGetLatestSnapshot.mockResolvedValue(snapshot);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market-data/Mosman?state=NSW',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.suburb).toBe('Mosman');
  });

  it('returns 404 when no data found', async () => {
    mockGetLatestSnapshot.mockResolvedValue(null);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market-data/UnknownSuburb',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /snapshot/:suburbId ──────────────────────────────────────

describe('GET /api/v1/market-data/snapshot/:suburbId', () => {
  it('returns historical snapshots', async () => {
    const snapshots = [
      { id: '00000000-0000-0000-0000-000000000001', suburb: 'Mosman', medianPrice: 3500000 },
      { id: '00000000-0000-0000-0000-000000000002', suburb: 'Mosman', medianPrice: 3400000 },
    ];

    mockGetHistoricalSnapshots.mockResolvedValue(snapshots);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market-data/snapshot/mosman-nsw',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('returns 400 for invalid suburbId format (no dash)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market-data/snapshot/nodash',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /refresh ────────────────────────────────────────────────

describe('POST /api/v1/market-data/refresh', () => {
  const validBody = {
    suburbs: [
      { suburb: 'Mosman', state: 'NSW', postcode: '2088', propertyType: 'house' },
    ],
  };

  it('refreshes market data for suburbs', async () => {
    const result = { total: 1, succeeded: 1, failed: 0, results: [] };
    mockBulkFetchAndUpsert.mockResolvedValue(result);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/market-data/refresh',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.succeeded).toBe(1);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/market-data/refresh',
      headers: { authorization: BEARER },
      payload: validBody,
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/market-data/refresh',
      headers: { authorization: BEARER },
      payload: { suburbs: [] }, // empty array - min 1 required
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /bulk-refresh ───────────────────────────────────────────

describe('POST /api/v1/market-data/bulk-refresh', () => {
  it('returns empty result when no active suburbs', async () => {
    mockGetActiveSuburbs.mockResolvedValue([]);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/market-data/bulk-refresh',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.total).toBe(0);
  });

  it('refreshes all active suburbs', async () => {
    const activeSuburbs = [{ suburb: 'Mosman', state: 'NSW', postcode: '2088', propertyType: 'house' as const }];
    mockGetActiveSuburbs.mockResolvedValue(activeSuburbs);

    const result = { total: 2, succeeded: 2, failed: 0, results: [] };
    mockBulkFetchAndUpsert.mockResolvedValue(result);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/market-data/bulk-refresh',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.total).toBe(2);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/market-data/bulk-refresh',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(401);
  });
});
