# Unit Test Generator

You are a **Unit Test Orchestrator** for RealFlow. You set up context, spawn `@qa-engineer` to generate complete Vitest unit tests enforcing all four Sprint 4 rules, then verify the output before writing the test file.

## Context

$ARGUMENTS

## Agent Delegation

**Specialist:** `@qa-engineer` → `subagent_type: "qa-engineer"`

```
Task prompt: "Generate a complete Vitest unit test file for $ARGUMENTS. Read the source file
completely first to identify all public methods. Apply all 4 RealFlow Vitest rules: (1) UUID
fixtures — all IDs must be valid UUID v4 format, never shorthand strings like 'contact-1';
(2) vi.hoisted() for ALL shared mocks — no exceptions, declared before vi.mock() calls;
(3) class constructor mocks must use function form or dependency injection, never arrow function
vi.fn() as constructor; (4) Supabase chain termination — .select() as the final chain call uses
mockResolvedValue, not mockReturnThis(). For every public method generate: happy path, not-found
(returns null for PGRST116), validation error (Zod throws on bad input), and database error
(error propagates with context message). Use nested describe blocks per method. Return the
complete test file content ready to write."
```

Agent returns: Complete `.test.ts` file content following the Test File Structure template, with all 4 Vitest rules applied and full coverage of every public method (minimum 4 tests per method).
Orchestrator gate: Verify returned content: (a) no shorthand ID strings like `'contact-1'`; (b) `vi.hoisted()` present before every `vi.mock()` call; (c) test count ≥ 4 × (number of public methods). If checks pass, write the file to the expected `*.test.ts` path.

## ⚠️ MANDATORY VITEST RULES (NEVER violate these — from MEMORY.md)

### Rule 1: UUID Fixtures
**WRONG:** `const contactId = 'contact-1';`
**CORRECT:** `const contactId = '00000000-0000-0000-0000-000000000001';`

Zod's `z.string().uuid()` validates format. Shorthand strings throw `ZodError`. Always use proper UUID v4 format in every test fixture.

### Rule 2: vi.hoisted() for Shared Mocks
**WRONG:**
```typescript
const mockFn = vi.fn();
vi.mock('./module', () => ({ fn: mockFn })); // ❌ Cannot reference const in factory
```

**CORRECT:**
```typescript
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock('./module', () => ({ fn: mockFn })); // ✅ hoisted() runs before imports
```

### Rule 3: Class Constructor Mocks
**WRONG:**
```typescript
vi.mock('./engine', () => ({ FeatureEngine: vi.fn(() => ({ create: vi.fn() })) }));
// Arrow functions cannot be used as class constructors
```

**CORRECT:**
```typescript
// Option A: Dependency injection (preferred)
const mockEngine = { create: vi.fn(), list: vi.fn() };
const route = new FeatureRoute(mockEngine); // Pass mock as constructor arg

// Option B: Mock the class correctly
const MockEngine = vi.fn().mockImplementation(function() {
  this.create = vi.fn();
  this.list = vi.fn();
});
```

### Rule 4: Supabase Chain Termination
**WRONG when chain ends at .select():**
```typescript
select: vi.fn().mockReturnThis(), // ❌ Returns mock, not a Promise
```

**CORRECT when .select() is the final call:**
```typescript
select: vi.fn().mockResolvedValue({ data: [...], error: null }), // ✅ Returns Promise
```

Only use `mockReturnThis()` for intermediate chain methods (.eq, .is, .order, etc.) that continue the chain.

## Test File Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SubjectUnderTest } from './subject-under-test';

// Declare all shared mocks with vi.hoisted() BEFORE vi.mock() calls
const { mockMethod } = vi.hoisted(() => ({
  mockMethod: vi.fn(),
}));

// Mock external dependencies
vi.mock('./external-dependency', () => ({
  ExternalClass: vi.fn().mockImplementation(function() {
    this.method = mockMethod;
  }),
}));

// Use proper UUIDs for all fixture IDs
const TEST_ID_1 = '00000000-0000-0000-0000-000000000001';
const TEST_ID_2 = '00000000-0000-0000-0000-000000000002';
const NOW = new Date().toISOString();

// Factory function for test fixtures
function makeFixture(overrides = {}) {
  return {
    id: TEST_ID_1,
    field: 'value',
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...overrides,
  };
}

describe('SubjectUnderTest', () => {
  let subject: SubjectUnderTest;

  beforeEach(() => {
    vi.clearAllMocks();
    subject = new SubjectUnderTest(/* inject mocks */);
  });

  afterEach(() => {
    vi.unstubAllGlobals(); // Required if using vi.stubGlobal
  });

  describe('methodName', () => {
    it('happy path — [what it should do]', async () => {
      // Arrange
      mockMethod.mockResolvedValueOnce({ data: [makeFixture()], error: null });

      // Act
      const result = await subject.methodName(TEST_ID_1);

      // Assert
      expect(result).toMatchObject({ id: TEST_ID_1 });
      expect(mockMethod).toHaveBeenCalledWith(TEST_ID_1);
    });

    it('returns null when not found', async () => {
      mockMethod.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      const result = await subject.methodName(TEST_ID_1);
      expect(result).toBeNull();
    });

    it('throws on database error', async () => {
      mockMethod.mockResolvedValueOnce({ data: null, error: { message: 'DB connection failed' } });
      await expect(subject.methodName(TEST_ID_1)).rejects.toThrow('DB connection failed');
    });

    it('throws on invalid UUID input', async () => {
      // Zod validation should catch this
      await expect(subject.methodName('not-a-uuid')).rejects.toThrow();
    });
  });
});
```

## Coverage Targets

For the file being tested, ensure tests cover:

| Type | Target |
|------|--------|
| Business logic engine | 80%+ line coverage |
| API route handler | 70%+ line coverage |
| Zod schema | 90%+ (test all enum values, required fields, optional fields) |
| Utility function | 90%+ |

Every public method must have at minimum:
- ✅ Happy path (returns expected result)
- ✅ Not found / empty (returns null or [])
- ✅ Validation error (Zod throws on bad input)
- ✅ Database error (error propagates correctly)

## Test Baseline Check

Before writing tests, note the current baseline: **606 tests passing** (Sprint 4 complete).

After writing, confirm: `npm run test` should show total ≥ 606 + (new tests written).

## Instructions

- Read the source file completely before writing any tests
- Identify all public methods — every one needs tests
- Use `vi.hoisted()` for ALL shared mocks (no exceptions)
- All UUID strings must be valid UUID format
- Test error paths as thoroughly as happy paths
- Group tests by method using nested `describe` blocks
- Use `beforeEach(() => vi.clearAllMocks())` at every describe level that uses mocks
