import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockAuth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
  }),
};
const mockSupabase = { from: mockFrom, auth: mockAuth };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock integration dependencies (resolved before vi.mock takes effect) ────

vi.mock('@realflow/integrations', () => ({
  DomainClient: vi.fn().mockImplementation(() => ({
    getSuburbPerformance: vi.fn(),
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

// ─── Mock MarketDataService ─────────────────────────────────────────

vi.mock('../services/market-data-service', () => ({
  MarketDataService: class MockMarketDataService {
    getSnapshotsForSuburbs = vi
      .fn()
      .mockResolvedValue([{ suburb: 'Bondi', state: 'NSW', medianPrice: 2350000 }]);
  },
}));

// ─── Import after mocks ────────────────────────────────────────────

import Fastify from 'fastify';
import { consolidationReportRoutes } from './consolidation-reports';

// ─── Test Setup ────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(consolidationReportRoutes, { prefix: '/api/v1/consolidation-reports' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
  });
});

// ─── Helpers ───────────────────────────────────────────────────────

function createChainedSelect(finalResult: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue(finalResult),
          single: vi.fn().mockResolvedValue(finalResult),
        }),
        single: vi.fn().mockResolvedValue(finalResult),
      }),
      single: vi.fn().mockResolvedValue(finalResult),
    }),
  };
}

const sampleReport = {
  id: 'rpt-1',
  client_id: 'client-1',
  client_brief_id: 'brief-1',
  type: 'client_brief_summary',
  title: 'client brief summary - 04/03/2026',
  status: 'ready',
  content: { executiveSummary: 'Test summary' },
  created_at: '2026-03-01T00:00:00.000Z',
};

const sampleBrief = {
  id: 'brief-1',
  contact_id: 'client-1',
  requirements: {
    suburbs: [{ suburb: 'Bondi', state: 'NSW' }],
  },
  timeline: { urgency: '1_3_months' },
  finance: { preApproved: false },
  budget: { min: 1800000, max: 2200000 },
  clientSignedOff: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ─── GET / — List Reports ─────────────────────────────────────────

describe('GET /api/v1/consolidation-reports', () => {
  it('returns reports for a given clientId', async () => {
    const reports = [sampleReport, { ...sampleReport, id: 'rpt-2' }];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: reports, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/consolidation-reports?clientId=client-1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('filters by type when type query param is provided', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [sampleReport], error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/consolidation-reports?clientId=client-1&type=client_brief_summary',
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 400 when clientId is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/consolidation-reports',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('clientId is required');
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection lost' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/consolidation-reports?clientId=client-1',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Connection lost');
  });
});

// ─── GET /:id — Get Single Report ─────────────────────────────────

describe('GET /api/v1/consolidation-reports/:id', () => {
  it('returns a single report by ID', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: sampleReport, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/consolidation-reports/rpt-1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.id).toBe('rpt-1');
  });

  it('returns 404 when report is not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found', code: 'PGRST116' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/consolidation-reports/nonexistent',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Report not found');
  });
});

// ─── POST /generate — Create Report ──────────────────────────────

describe('POST /api/v1/consolidation-reports/generate', () => {
  const validGenerateBody = {
    clientId: '44444444-4444-4444-4444-444444444444',
    type: 'client_brief_summary',
    includeMarketData: true,
    includeDueDiligence: false,
    includeInspections: true,
  };

  function setupGenerateMocks() {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'client_briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: sampleBrief, error: null }),
                  }),
                }),
              }),
              single: vi.fn().mockResolvedValue({ data: sampleBrief, error: null }),
            }),
          }),
        };
      }

      if (table === 'property_matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  propertyId: 'prop-1',
                  overallScore: 82,
                  status: 'new',
                  scoreBreakdown: {
                    priceMatch: 85,
                    locationMatch: 90,
                    sizeMatch: 80,
                    featureMatch: 75,
                  },
                  matchedAt: '2026-01-10T00:00:00.000Z',
                  updatedAt: '2026-01-10T00:00:00.000Z',
                  property: {
                    id: 'prop-1',
                    address: {
                      streetNumber: '42',
                      streetName: 'Ocean St',
                      suburb: 'Bondi',
                      state: 'NSW',
                      postcode: '2026',
                    },
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === 'inspections') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      if (table === 'offers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      if (table === 'consolidation_reports') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...sampleReport, id: 'new-rpt' },
                error: null,
              }),
            }),
          }),
        };
      }

      // Fallback for other tables (due_diligence_checklists, key_dates)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
  }

  it('generates a report and returns 201', async () => {
    setupGenerateMocks();

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/consolidation-reports/generate',
      payload: validGenerateBody,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe('new-rpt');
  });

  it('returns 400 for invalid request body (missing clientId)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/consolidation-reports/generate',
      payload: { type: 'client_brief_summary' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
  });

  it('returns 400 for invalid report type', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/consolidation-reports/generate',
      payload: {
        clientId: '44444444-4444-4444-4444-444444444444',
        type: 'invalid_type',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for non-UUID clientId', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/consolidation-reports/generate',
      payload: {
        clientId: 'not-a-uuid',
        type: 'client_brief_summary',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when client brief is not found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'client_briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi
                      .fn()
                      .mockResolvedValue({ data: null, error: { message: 'Not found' } }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return createChainedSelect({ data: [], error: null });
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/consolidation-reports/generate',
      payload: validGenerateBody,
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Client brief not found');
  });

  it('returns 500 when report save fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'client_briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: sampleBrief, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'consolidation_reports') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' },
              }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/consolidation-reports/generate',
      payload: validGenerateBody,
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── PUT /:id/status — Update Report Status ──────────────────────

describe('PUT /api/v1/consolidation-reports/:id/status', () => {
  it('updates report status to sent_to_client', async () => {
    const updatedReport = { ...sampleReport, status: 'sent_to_client' };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/consolidation-reports/rpt-1/status',
      payload: { status: 'sent_to_client' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.status).toBe('sent_to_client');
  });

  it('updates report status to archived', async () => {
    const updatedReport = { ...sampleReport, status: 'archived' };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/consolidation-reports/rpt-1/status',
      payload: { status: 'archived' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 400 for invalid status value', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/consolidation-reports/rpt-1/status',
      payload: { status: 'invalid_status' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Invalid status');
  });

  it('returns 500 on database update error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Update failed' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/consolidation-reports/rpt-1/status',
      payload: { status: 'ready' },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── DELETE /:id — Soft Delete ────────────────────────────────────

describe('DELETE /api/v1/consolidation-reports/:id', () => {
  it('soft deletes a report by setting deleted_at', async () => {
    const deletedReport = { ...sampleReport, deleted_at: '2026-03-04T00:00:00.000Z' };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: deletedReport, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/consolidation-reports/rpt-1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.deleted_at).toBeDefined();
  });

  it('returns 500 on soft delete error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Delete failed' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/consolidation-reports/rpt-1',
    });

    expect(response.statusCode).toBe(500);
  });
});
