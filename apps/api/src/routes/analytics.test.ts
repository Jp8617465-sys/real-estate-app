import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase middleware ─────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: vi.fn(),
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock AnalyticsEngine ─────────────────────────────────────────────────────

const mockGetPipelineVelocity = vi.fn();
const mockGetAgentPerformance = vi.fn();
const mockGetMarketInsights = vi.fn();
const mockGetRevenueForecast = vi.fn();
const mockGetDashboardSnapshot = vi.fn();

vi.mock('@realflow/business-logic', () => ({
  AnalyticsEngine: {
    getPipelineVelocity: mockGetPipelineVelocity,
    getAgentPerformance: mockGetAgentPerformance,
    getMarketInsights: mockGetMarketInsights,
    getRevenueForecast: mockGetRevenueForecast,
    getDashboardSnapshot: mockGetDashboardSnapshot,
  },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import Fastify from 'fastify';
import { analyticsRoutes } from './analytics';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AGENT_ID = '00000000-0000-0000-0000-000000000001';

const MOCK_PIPELINE_VELOCITY = [
  {
    stage: 'lead',
    pipelineType: 'buyers_agent',
    activeCount: 10,
    avgDaysInStage: 3.5,
    conversionRate: 60,
    new30d: 4,
  },
];

const MOCK_AGENT_PERFORMANCE = {
  agentId: AGENT_ID,
  agentName: 'Jane Smith',
  period: '30d',
  dealsSettled: 3,
  dealsInProgress: 8,
  totalRevenue: 45000,
  avgDealValue: 15000,
  avgResponseTimeMinutes: null,
  messagesSent: 120,
  inspectionsDone: 15,
  offerConversionRate: 67,
};

const MOCK_MARKET_INSIGHTS = [
  {
    suburb: 'Bondi',
    postcode: '2026',
    state: 'NSW',
    propertyType: 'house',
    medianSalePrice: 2500000,
    medianDaysOnMarket: 22,
    clearanceRate: 78.5,
    priceChange1yPercent: 4.2,
    snapshotDate: '2026-02-01',
  },
];

const MOCK_REVENUE_FORECAST = {
  period: '30d',
  earnedRevenue: 45000,
  pipelineValue: 120000,
  forecastRevenue: 93000,
  retainerFees: 9000,
  successFees: 36000,
  referralFees: 2500,
};

const MOCK_DASHBOARD_SNAPSHOT = {
  pipelineVelocity: MOCK_PIPELINE_VELOCITY,
  agentPerformance: MOCK_AGENT_PERFORMANCE,
  marketInsights: MOCK_MARKET_INSIGHTS,
  revenue: MOCK_REVENUE_FORECAST,
  generatedAt: '2026-03-01T00:00:00.000Z',
};

// ─── App builder ──────────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: AGENT_ID } }, error: null });
  mockGetPipelineVelocity.mockResolvedValue(MOCK_PIPELINE_VELOCITY);
  mockGetAgentPerformance.mockResolvedValue(MOCK_AGENT_PERFORMANCE);
  mockGetMarketInsights.mockResolvedValue(MOCK_MARKET_INSIGHTS);
  mockGetRevenueForecast.mockResolvedValue(MOCK_REVENUE_FORECAST);
  mockGetDashboardSnapshot.mockResolvedValue(MOCK_DASHBOARD_SNAPSHOT);
});

// ─── Auth guard tests (applied to all endpoints) ──────────────────────────────

describe('Auth guard', () => {
  it('returns 401 when auth.getUser returns no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not authenticated' } });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/snapshot',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when auth.getUser returns error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'JWT expired' } });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/agent-performance',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── GET /pipeline-velocity ───────────────────────────────────────────────────

describe('GET /api/v1/analytics/pipeline-velocity', () => {
  it('returns pipeline velocity data with default period', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/pipeline-velocity',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].stage).toBe('lead');
    expect(mockGetPipelineVelocity).toHaveBeenCalledWith(AGENT_ID, mockSupabase);
  });

  it('filters by pipelineType when provided', async () => {
    mockGetPipelineVelocity.mockResolvedValue([
      { ...MOCK_PIPELINE_VELOCITY[0], pipelineType: 'buyers_agent' },
      { stage: 'brief', pipelineType: 'seller', activeCount: 5, avgDaysInStage: 2, conversionRate: 80, new30d: 1 },
    ]);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/pipeline-velocity?pipelineType=buyers_agent',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.every((v: { pipelineType: string }) => v.pipelineType === 'buyers_agent')).toBe(true);
  });

  it('returns 400 for invalid pipelineType', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/pipeline-velocity?pipelineType=invalid_type',
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns empty array when no stages exist', async () => {
    mockGetPipelineVelocity.mockResolvedValue([]);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/pipeline-velocity',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toEqual([]);
  });
});

// ─── GET /agent-performance ───────────────────────────────────────────────────

describe('GET /api/v1/analytics/agent-performance', () => {
  it('returns agent performance with default 30d period', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/agent-performance',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.agentId).toBe(AGENT_ID);
    expect(body.data.dealsSettled).toBe(3);
    expect(body.data.totalRevenue).toBe(45000);
  });

  it('passes the period parameter to AnalyticsEngine', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/agent-performance?period=7d',
    });

    expect(mockGetAgentPerformance).toHaveBeenCalledWith(AGENT_ID, '7d', mockSupabase);
  });

  it('returns 400 for invalid period value', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/agent-performance?period=180d',
    });

    expect(response.statusCode).toBe(400);
  });

  it('handles ytd period correctly', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/agent-performance?period=ytd',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetAgentPerformance).toHaveBeenCalledWith(AGENT_ID, 'ytd', mockSupabase);
  });
});

// ─── GET /market-insights ─────────────────────────────────────────────────────

describe('GET /api/v1/analytics/market-insights', () => {
  it('returns market insights for a single suburb', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/market-insights?suburbs=Bondi',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].suburb).toBe('Bondi');
  });

  it('splits comma-separated suburbs and passes to engine', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/market-insights?suburbs=Bondi,Manly,Newtown',
    });

    expect(mockGetMarketInsights).toHaveBeenCalledWith(
      ['Bondi', 'Manly', 'Newtown'],
      mockSupabase,
    );
  });

  it('filters by propertyType when provided', async () => {
    mockGetMarketInsights.mockResolvedValue([
      { ...MOCK_MARKET_INSIGHTS[0], propertyType: 'house' },
      { suburb: 'Bondi', postcode: '2026', state: 'NSW', propertyType: 'unit',
        medianSalePrice: 900000, medianDaysOnMarket: 30, clearanceRate: 70,
        priceChange1yPercent: 2, snapshotDate: '2026-02-01' },
    ]);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/market-insights?suburbs=Bondi&propertyType=house',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.every((i: { propertyType: string }) => i.propertyType === 'house')).toBe(true);
  });

  it('returns 400 when suburbs param is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/market-insights',
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for invalid propertyType', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/market-insights?suburbs=Bondi&propertyType=villa',
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /revenue ─────────────────────────────────────────────────────────────

describe('GET /api/v1/analytics/revenue', () => {
  it('returns revenue forecast with default period', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/revenue',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.earnedRevenue).toBe(45000);
    expect(body.data.pipelineValue).toBe(120000);
    expect(body.data.forecastRevenue).toBe(93000);
  });

  it('passes period to AnalyticsEngine', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/revenue?period=90d',
    });

    expect(mockGetRevenueForecast).toHaveBeenCalledWith(AGENT_ID, '90d', mockSupabase);
  });

  it('returns retainer, success, and referral fee breakdown', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/revenue',
    });

    const body = JSON.parse(response.payload);
    expect(body.data.retainerFees).toBe(9000);
    expect(body.data.successFees).toBe(36000);
    expect(body.data.referralFees).toBe(2500);
  });
});

// ─── GET /snapshot ────────────────────────────────────────────────────────────

describe('GET /api/v1/analytics/snapshot', () => {
  it('returns full dashboard snapshot with default period', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/snapshot',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveProperty('pipelineVelocity');
    expect(body.data).toHaveProperty('agentPerformance');
    expect(body.data).toHaveProperty('marketInsights');
    expect(body.data).toHaveProperty('revenue');
    expect(body.data).toHaveProperty('generatedAt');
  });

  it('calls getDashboardSnapshot with agentId and period', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/snapshot?period=7d',
    });

    expect(mockGetDashboardSnapshot).toHaveBeenCalledWith(AGENT_ID, '7d', mockSupabase);
  });

  it('returns 400 for invalid period', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/snapshot?period=999d',
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when no JWT is present', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Unauthorized' } });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/snapshot',
    });

    expect(response.statusCode).toBe(401);
  });
});
