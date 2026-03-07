import { vi, beforeEach, afterEach, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createMockSupabaseClient } from './mock-supabase';

// ─── Environment Setup ──────────────────────────────────────────────

/**
 * Standard test environment variables for RealFlow API tests.
 * These are set before any test modules are imported so that
 * config/env validation passes.
 */
export function setupTestEnvironment(): void {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-key';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
  process.env.DOMAIN_API_KEY = 'test-domain-key';
  process.env.DOMAIN_CLIENT_ID = 'test-domain-client-id';
  process.env.DOMAIN_CLIENT_SECRET = 'test-domain-client-secret';
  process.env.META_ACCESS_TOKEN = 'test-meta-token';
  process.env.NODE_ENV = 'test';
}

// ─── Fastify Test App Builder ───────────────────────────────────────

interface TestAppOptions {
  /** Route registration function, e.g. `contactRoutes` */
  routes: (app: FastifyInstance) => Promise<void>;
  /** URL prefix for the routes, e.g. '/api/v1/contacts' */
  prefix: string;
}

/**
 * Build a Fastify test app with the given routes registered.
 * Uses `app.inject()` for in-process HTTP testing (no network).
 *
 * Usage:
 * ```ts
 * const app = await buildTestApp({
 *   routes: contactRoutes,
 *   prefix: '/api/v1/contacts',
 * });
 *
 * const response = await app.inject({
 *   method: 'GET',
 *   url: '/api/v1/contacts',
 *   headers: { authorization: 'Bearer test-token' },
 * });
 * ```
 */
export async function buildTestApp(options: TestAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(options.routes, { prefix: options.prefix });
  return app;
}

// ─── Lifecycle Hooks ────────────────────────────────────────────────

/**
 * Standard test lifecycle hooks for API route tests.
 * Clears all mocks between tests and restores globals after all tests.
 *
 * Usage (call at top level of your test file):
 * ```ts
 * import { setupTestLifecycle } from '../test-helpers/setup';
 * setupTestLifecycle();
 * ```
 */
export function setupTestLifecycle(): void {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });
}

// ─── Auth Header Helper ────────────────────────────────────────────

/**
 * Returns a standard Authorization header for authenticated test requests.
 * The token is a mock JWT that passes format validation.
 */
export function authHeaders(token = 'test-jwt-token'): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

/**
 * Returns headers that simulate an unauthenticated request (no auth header).
 */
export function noAuthHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
  };
}

// ─── Response Assertion Helpers ─────────────────────────────────────

/**
 * Parse a Fastify inject response payload as JSON.
 */
export function parseResponse<T = Record<string, unknown>>(
  response: { payload: string },
): T {
  return JSON.parse(response.payload) as T;
}

/**
 * Assert that a response has the expected status code and return parsed body.
 */
export function expectStatus<T = Record<string, unknown>>(
  response: { statusCode: number; payload: string },
  expectedStatus: number,
): T {
  if (response.statusCode !== expectedStatus) {
    const body = JSON.parse(response.payload);
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.statusCode}. ` +
      `Body: ${JSON.stringify(body, null, 2)}`,
    );
  }
  return JSON.parse(response.payload) as T;
}
