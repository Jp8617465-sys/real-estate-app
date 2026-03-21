# Integration Test Generator

You are an **Integration Test Orchestrator** for RealFlow. You set up context, spawn `@qa-engineer` to generate the integration tests using its specialist knowledge, then verify they meet the required coverage before saving.

## Agent Delegation

**Specialist:** `@qa-engineer` → `subagent_type: "qa-engineer"`

```
Task prompt: "Generate a complete Vitest integration test file for the Fastify routes in
$ARGUMENTS. Read the route file, the engine it calls, and the canonical pattern files
(apps/api/src/routes/contacts.ts and contacts.test.ts) before generating. Mock at the Supabase
client level (not the engine level). Use app.inject() for all HTTP requests — not supertest.
Build a fresh Fastify app per test suite using a buildApp() helper. Apply all 4 RealFlow Vitest
rules (vi.hoisted(), proper UUIDs, class constructor mocks via DI, correct Supabase chain
termination). For every route, cover: happy path 200/201, auth missing 401, auth malformed 401,
validation failure 400, not found 404, database error 500. Verify response body shapes match
the Zod schema, not just status codes."
```

Agent returns: Complete integration test file content for the routes.
Orchestrator: Verify all routes are covered with auth tests (401), validation tests (400), and error tests (500). Save the file as `ROUTE_FILE.test.ts` alongside the route file.

## Context

$ARGUMENTS

## Reference Files

Read before generating:

- `apps/api/src/routes/contacts.ts` — canonical route handler pattern
- `apps/api/src/routes/contacts.test.ts` — canonical integration test pattern
- `apps/api/src/middleware/supabase.ts` — auth middleware (to understand how token extraction works)

## Integration Test Structure

```typescript
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// vi.hoisted() for all shared mocks
const { mockFrom, mockSelect, mockInsert, mockEq, mockSingle, mockOrder, mockLimit } = vi.hoisted(
  () => {
    const mockSingle = vi.fn();
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockEq = vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ single: mockSingle }) });
    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      is: vi.fn().mockReturnValue({ order: mockOrder }),
    });
    const mockInsert = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, insert: mockInsert });

    return { mockFrom, mockSelect, mockInsert, mockEq, mockSingle, mockOrder, mockLimit };
  },
);

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// Mock env
vi.mock('../../env', () => ({
  env: {
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  },
}));

// Test fixtures with valid UUIDs
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_RECORD_ID = '00000000-0000-0000-0000-000000000002';
const NOW = new Date().toISOString();

// Simulate a valid JWT header (Supabase middleware extracts Bearer token)
const AUTH_HEADER = 'Bearer valid-jwt-token';

function makeRecord(overrides = {}) {
  return {
    id: TEST_RECORD_ID,
    user_id: TEST_USER_ID,
    name: 'Test Record',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...overrides,
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { featureRoutes } = await import('./feature');
  await app.register(featureRoutes, { prefix: '/api/v1/feature' });
  return app;
}

describe('Feature Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================================================
  // GET /api/v1/feature
  // =====================================================
  describe('GET /api/v1/feature', () => {
    it('returns 200 with list of records', async () => {
      mockLimit.mockResolvedValueOnce({ data: [makeRecord()], error: null });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/feature',
        headers: { authorization: AUTH_HEADER },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { data: unknown[] };
      expect(body.data).toHaveLength(1);
    });

    it('returns 401 without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/feature',
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 with malformed auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/feature',
        headers: { authorization: 'NotBearer token' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 500 on database error', async () => {
      mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'Connection failed' } });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/feature',
        headers: { authorization: AUTH_HEADER },
      });
      expect(response.statusCode).toBe(500);
    });
  });

  // =====================================================
  // POST /api/v1/feature
  // =====================================================
  describe('POST /api/v1/feature', () => {
    it('returns 201 with created record', async () => {
      mockSingle.mockResolvedValueOnce({ data: makeRecord(), error: null });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/feature',
        headers: {
          authorization: AUTH_HEADER,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Record' }),
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body) as { data: { id: string } };
      expect(body.data.id).toBe(TEST_RECORD_ID);
    });

    it('returns 400 on validation failure (empty name)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/feature',
        headers: {
          authorization: AUTH_HEADER,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: '' }),
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 on missing required field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/feature',
        headers: {
          authorization: AUTH_HEADER,
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // =====================================================
  // DELETE /api/v1/feature/:id (soft delete)
  // =====================================================
  describe('DELETE /api/v1/feature/:id', () => {
    it('returns 200 on successful soft delete', async () => {
      vi.mocked(mockEq).mockReturnValueOnce({ is: vi.fn().mockResolvedValue({ error: null }) });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/feature/${TEST_RECORD_ID}`,
        headers: { authorization: AUTH_HEADER },
      });
      expect(response.statusCode).toBe(200);
    });

    it('returns 404 when record not found', async () => {
      vi.mocked(mockEq).mockReturnValueOnce({
        is: vi.fn().mockResolvedValue({ error: { code: 'PGRST116' } }),
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/feature/${TEST_RECORD_ID}`,
        headers: { authorization: AUTH_HEADER },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
```

## What Integration Tests Must Cover

For each route:

- ✅ Happy path — correct status code and response shape
- ✅ Auth missing — 401
- ✅ Auth malformed — 401
- ✅ Validation failure — 400 with error details
- ✅ Not found — 404
- ✅ Database error — 500
- ✅ Response shape matches Zod schema

## Instructions

- Use `app.inject()` for all HTTP requests — not `supertest` or `fetch`
- Mock at the Supabase client level, not at the engine level
- Build app fresh for each test suite using `buildApp()` helper
- Clean mocks in `beforeEach(() => vi.clearAllMocks())`
- Test all 4xx and 5xx codes listed in the API design doc
- Verify response body shape, not just status codes
