import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockOverlaps = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();

function createChainedQuery(finalResult: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
    then: vi.fn((resolve: (v: unknown) => void) => resolve(finalResult)),
  };
  // Make the chain itself thenable (for await-ing the query directly)
  Object.defineProperty(chain.limit, 'then', {
    value: (resolve: (v: unknown) => void) => resolve(finalResult),
  });
  return chain;
}

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { contactRoutes } from './contacts';

// ─── Test setup ───────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(contactRoutes, { prefix: '/api/v1/contacts' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / - List contacts ─────────────────────────────────────────

describe('GET /api/v1/contacts', () => {
  it('returns contact list', async () => {
    const contacts = [
      { id: '1', first_name: 'John', last_name: 'Smith' },
      { id: '2', first_name: 'Jane', last_name: 'Doe' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: contacts, error: null }),
              overlaps: vi.fn().mockReturnValue({
                then: (r: Function) => r({ data: contacts, error: null }),
              }),
              then: (r: Function) => r({ data: contacts, error: null }),
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/contacts',
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
              error: { message: 'DB connection failed' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/contacts',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get single contact ────────────────────────────────

describe('GET /api/v1/contacts/:id', () => {
  it('returns a single contact', async () => {
    const contact = { id: '1', first_name: 'John', last_name: 'Smith' };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: contact, error: null }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/contacts/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.first_name).toBe('John');
  });

  it('returns 404 when contact not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/contacts/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create contact ───────────────────────────────────────

describe('POST /api/v1/contacts', () => {
  const validBody = {
    types: ['buyer'],
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '0400000000',
    source: 'domain',
    assignedAgentId: '00000000-0000-0000-0000-000000000001',
    communicationPreference: 'email',
  };

  it('creates a contact successfully (no duplicates)', async () => {
    // Mock for duplicate check - no existing contacts
    const duplicateCheckMock = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };

    // Mock for insert
    const insertMock = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-1', ...validBody },
            error: null,
          }),
        }),
      }),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return duplicateCheckMock;
      return insertMock;
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
  });

  it('returns 400 for invalid input', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      payload: { firstName: 'Jane' }, // Missing required fields
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 409 when high-confidence duplicate detected', async () => {
    const existingContacts = [
      {
        id: 'existing-1',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone: '0400000000',
        secondary_phone: null,
      },
    ];

    const duplicateCheckMock = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: existingContacts, error: null }),
      }),
    };

    mockFrom.mockReturnValue(duplicateCheckMock);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      payload: {
        ...validBody,
        phone: '0400000000',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Potential duplicate detected');
    expect(body.duplicates).toBeDefined();
  });
});

// ─── DELETE /:id - Soft delete contact ─────────────────────────────

describe('DELETE /api/v1/contacts/:id', () => {
  it('soft deletes a contact', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/contacts/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('returns 500 on delete error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/contacts/1',
    });

    expect(response.statusCode).toBe(500);
  });
});
