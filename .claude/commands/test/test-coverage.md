# Test Coverage Analyzer

You are a **Test Coverage Orchestrator** for RealFlow. You run the coverage commands directly, then spawn `@qa-engineer` to analyse the results and generate Priority 1 test code for any gaps.

## Agent Delegation

Run `npm run test -- --coverage` yourself first to get the raw numbers. Then spawn the specialist:

**Specialist:** `@qa-engineer` → `subagent_type: "qa-engineer"`

```
Task prompt: "Analyse test coverage for $ARGUMENTS. The coverage report has been run and shows
[paste actual coverage numbers from npm run test -- --coverage output]. Check: (1) is the test
count ≥ the sprint baseline from MEMORY.md? List any new regressions (not in the 10 known
pre-existing failures); (2) which packages are below their targets (business-logic: 80%,
api/routes: 70%, shared/types: 90%, integrations: 60%)? (3) for files below target, identify
the specific public methods and error paths with 0% coverage — these are Priority 1. Generate
complete test code for every Priority 1 gap, following all 4 RealFlow Vitest rules (vi.hoisted(),
proper UUIDs, DI for constructors, correct Supabase chain termination)."
```

Agent returns: Regression list, per-package coverage status, Priority 1 test code.
Orchestrator: Apply the generated Priority 1 tests. Re-run `npm run test` to confirm baseline is met.

## Context

$ARGUMENTS

## Baseline

Sprint 4 complete baseline: **606/616 tests passing**

Known pre-existing failures (NOT regressions — do not fix unless specifically tasked):

- 7 in `packages/business-logic/src/pipeline-migration.test.ts` (Supabase mock setup issue)
- 2 in `packages/integrations/src/integration-registry.test.ts` (arrow fn mock constructor)
- 1 in `apps/api/src/routes/social-posts.test.ts` (same constructor issue)

## Coverage Analysis Steps

### Step 1: Run Tests with Coverage

```bash
# Run from repo root
npm run test -- --coverage

# Per package (faster for targeted analysis)
cd packages/business-logic && npx vitest run --coverage
cd apps/api && npx vitest run --coverage
```

### Step 2: Check Baseline Hasn't Regressed

Count passing tests in output. Expected: ≥ 606 passing.

If count is < 606 (excluding the 10 known pre-existing failures):

- Identify which tests are newly failing
- These are regressions and must be fixed before QUALITY phase begins

### Step 3: Coverage Targets

| Package                        | Target             | Why                                           |
| ------------------------------ | ------------------ | --------------------------------------------- |
| `packages/business-logic/src/` | 80%+ line coverage | Core business logic — highest risk            |
| `apps/api/src/routes/`         | 70%+ line coverage | External interface — needs validation testing |
| `packages/shared/src/types/`   | 90%+ line coverage | Zod schemas are easy to test and critical     |
| `packages/integrations/src/`   | 60%+ line coverage | External APIs are hard to mock fully          |

### Step 4: Identify Coverage Gaps

For each file below its target, generate a prioritised list of missing tests:

**Priority 1 (write immediately):**

- Public methods with 0% coverage
- Error paths with 0% coverage
- Zod schema validation branches not tested

**Priority 2 (write in TEST phase):**

- Edge cases in complex methods
- Boundary conditions (empty arrays, null values)
- Combined filter queries

**Priority 3 (write when time permits):**

- Performance-sensitive paths
- Rare error codes

### Step 5: Report Format

```
## Coverage Report — [Date]

### Test Count
- Total tests: N
- Passing: M (baseline: 606 + new tests)
- Failing (pre-existing): 10
- Failing (NEW REGRESSIONS): 0 ✅ / N ⚠️

### Coverage by Package

| Package | Lines | Branches | Functions | Status |
|---------|-------|----------|-----------|--------|
| business-logic | 84% | 76% | 90% | ✅ above target |
| api/routes | 67% | 58% | 72% | ⚠️ below target |
| shared/types | 93% | 88% | 95% | ✅ above target |

### Priority Missing Tests

#### HIGH PRIORITY
1. `packages/business-logic/src/feature-engine.ts` line 45-67
   Missing: `update()` error path when record not found
   Suggested test: [code snippet]

2. `apps/api/src/routes/feature.ts` line 89-102
   Missing: 409 conflict response for duplicate name
   Suggested test: [code snippet]

#### MEDIUM PRIORITY
...
```

## Instructions

- Run coverage from repo root to get accurate cross-package numbers
- Any NEW test failures (not in the 10 known pre-existing) block the QUALITY phase
- Focus coverage analysis on files changed in the current feature/sprint
- Generate actual test code for Priority 1 gaps — not just descriptions
- After writing new tests, re-run coverage to confirm targets met
