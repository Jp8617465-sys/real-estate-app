import { vi } from 'vitest';

// ─── Types ──────────────────────────────────────────────────────────

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  overlaps: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
}

interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  rpc: ReturnType<typeof vi.fn>;
}

// ─── Chain Builder ──────────────────────────────────────────────────

/**
 * Creates a chainable mock query builder that resolves to the given result.
 * Every method returns `this` except `single()` and `maybeSingle()` which
 * resolve the promise. The builder itself is also thenable for `await`.
 *
 * Usage:
 *   const builder = createChainedQueryBuilder({ data: [...], error: null });
 *   mockSupabase.from.mockReturnValue(builder);
 */
export function createChainedQueryBuilder(finalResult: QueryResult): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    or: vi.fn(),
    overlaps: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue(finalResult),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
    range: vi.fn(),
  };

  // Make all chainable methods return the builder itself
  const chainMethods: Array<keyof MockQueryBuilder> = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'is',
    'in',
    'or',
    'overlaps',
    'order',
    'limit',
    'range',
  ];

  for (const method of chainMethods) {
    builder[method].mockReturnValue(builder);
  }

  // Make the builder itself thenable (for `await supabase.from('x').select().eq(...)`)
  Object.defineProperty(builder, 'then', {
    value: (resolve: (v: unknown) => void) => resolve(finalResult),
    writable: false,
    enumerable: false,
  });

  return builder;
}

// ─── Mock Supabase Client ───────────────────────────────────────────

/**
 * Creates a fully-mocked Supabase client suitable for unit testing
 * RealFlow API routes and services.
 *
 * Default behaviour: all queries return `{ data: null, error: null }`.
 * Use `mockSupabase.from.mockReturnValue(createChainedQueryBuilder(...))` or
 * `mockSupabase.from.mockImplementation(...)` to configure per-table results.
 *
 * Example:
 * ```ts
 * const { mockSupabase } = createMockSupabaseClient();
 *
 * mockSupabase.from.mockReturnValue(
 *   createChainedQueryBuilder({
 *     data: [{ id: '1', first_name: 'Sarah' }],
 *     error: null,
 *   }),
 * );
 * ```
 */
export function createMockSupabaseClient(options?: { userId?: string }): {
  mockSupabase: MockSupabaseClient;
} {
  const userId = options?.userId ?? '00000000-0000-0000-0000-000000000001';

  const defaultBuilder = createChainedQueryBuilder({ data: null, error: null });

  const mockSupabase: MockSupabaseClient = {
    from: vi.fn().mockReturnValue(defaultBuilder),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, email: 'agent@realflow.com.au' } },
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: userId }, session: { access_token: 'mock-token' } },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: { id: userId }, session: { access_token: 'mock-token' } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'uploads/test.pdf' }, error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob([]), error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/test.pdf' },
        }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return { mockSupabase };
}

// ─── Per-Table Mock Helper ──────────────────────────────────────────

/**
 * Configure the mock Supabase `from()` to return different results
 * depending on which table is queried.
 *
 * Example:
 * ```ts
 * const { mockSupabase } = createMockSupabaseClient();
 *
 * configureMockTables(mockSupabase, {
 *   contacts: { data: [{ id: '1', first_name: 'Sarah' }], error: null },
 *   properties: { data: [], error: null },
 * });
 * ```
 */
export function configureMockTables(
  mockSupabase: MockSupabaseClient,
  tables: Record<string, QueryResult>,
): void {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = tables[table] ?? { data: null, error: null };
    return createChainedQueryBuilder(result);
  });
}

// ─── Error Response Helpers ─────────────────────────────────────────

/**
 * Standard PostgreSQL/Supabase error codes and messages for testing.
 */
export const SUPABASE_ERRORS = {
  NOT_FOUND: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
  UNIQUE_VIOLATION: { message: 'duplicate key value violates unique constraint', code: '23505' },
  FOREIGN_KEY_VIOLATION: {
    message: 'insert or update on table violates foreign key constraint',
    code: '23503',
  },
  RLS_DENIED: { message: 'new row violates row-level security policy', code: '42501' },
  CONNECTION_ERROR: { message: 'connection to server at "localhost" refused', code: 'PGRST000' },
} as const;
