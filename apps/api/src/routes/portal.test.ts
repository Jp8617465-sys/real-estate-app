import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockAuth = {
  getUser: vi.fn(),
};
const mockSupabase = { from: mockFrom, auth: mockAuth };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { portalRoutes } from './portal';

// ─── Test setup ───────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(portalRoutes, { prefix: '/api/v1/portal' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: 'auth-user-1' } },
  });
});

// ─── GET /me - Get portal client profile ──────────────────────────

describe('GET /api/v1/portal/me', () => {
  it('returns portal client with joined contact and agent', async () => {
    const portalClient = {
      id: 'pc-1',
      auth_id: 'auth-user-1',
      contact_id: 'contact-1',
      agent_id: 'agent-1',
      is_active: true,
      contact: { id: 'contact-1', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@test.com', phone: '0400000000' },
      agent: { id: 'agent-1', full_name: 'Alex Morgan', email: 'alex@test.com' },
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/me',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.contact.first_name).toBe('Sarah');
    expect(body.data.agent.full_name).toBe('Alex Morgan');
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 404 when portal client not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/me',
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── GET /transaction - Get active transaction ────────────────────

describe('GET /api/v1/portal/transaction', () => {
  it('returns the active transaction', async () => {
    const portalClient = { contact_id: 'contact-1' };
    const transaction = {
      id: 'tx-1',
      contact_id: 'contact-1',
      current_stage: 'active-search',
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // portal_clients query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
              }),
            }),
          }),
        };
      }
      // transactions query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
              }),
            }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/transaction',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.current_stage).toBe('active-search');
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/transaction',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── GET /agent - Get assigned agent info ─────────────────────────

describe('GET /api/v1/portal/agent', () => {
  it('returns the assigned agent', async () => {
    const portalClient = { agent_id: 'agent-1' };
    const agent = {
      id: 'agent-1',
      full_name: 'Alex Morgan',
      email: 'alex@test.com',
      phone: '0400111222',
      avatar_url: null,
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // portal_clients query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
              }),
            }),
          }),
        };
      }
      // users query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: agent, error: null }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/agent',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.full_name).toBe('Alex Morgan');
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/agent',
    });

    expect(response.statusCode).toBe(401);
  });
});
