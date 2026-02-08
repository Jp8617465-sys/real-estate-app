import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { propertyRoutes } from './properties';

async function buildApp() {
  const app = Fastify();
  await app.register(propertyRoutes, { prefix: '/api/v1/properties' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List properties ───────────────────────────────────────

describe('GET /api/v1/properties', () => {
  it('returns property list', async () => {
    const properties = [
      { id: '1', address_suburb: 'Paddington', listing_status: 'active' },
      { id: '2', address_suburb: 'Woollahra', listing_status: 'pre-market' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: properties, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/properties',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection refused' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/properties',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get single property ───────────────────────────────

describe('GET /api/v1/properties/:id', () => {
  it('returns a single property with relations', async () => {
    const property = {
      id: '1',
      address_suburb: 'Paddington',
      listing_status: 'active',
      vendor: { id: 'v1', first_name: 'Bob', last_name: 'Seller' },
      interested_buyers: [],
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: property, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/properties/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.address_suburb).toBe('Paddington');
    expect(body.data.vendor).toBeDefined();
  });

  it('returns 404 when property not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/properties/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });
});
