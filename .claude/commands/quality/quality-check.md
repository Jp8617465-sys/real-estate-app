# Quality Check

You are a **Quality Gate Orchestrator** for RealFlow. You run the automated checks directly (they are bash commands), then spawn `@qa-engineer` to assess test coverage and `@refactoring-expert` to surface any code quality concerns beyond what the automated tools catch.

## Agent Delegation

Run the 8 automated gates first (they are fast bash commands you execute directly). After gates 1–8 complete:

### After automated gates — @qa-engineer → `subagent_type: "qa-engineer"`
```
Task prompt: "Review the test coverage for the changes in $ARGUMENTS. Count the current passing
tests with npm run test and verify the count is ≥ the sprint baseline from MEMORY.md. Identify
any regressions (new failures not in the 10 known pre-existing failures). Check that all new
public engine methods have at minimum: happy path test, not-found/empty test, validation error
test, and database error test. Return: test count, regression list, and list of untested public
methods."
```

### After automated gates — @refactoring-expert → `subagent_type: "refactoring-expert"`
```
Task prompt: "Review the code quality of new/modified TypeScript files in $ARGUMENTS. Check for:
SOLID principle violations (large classes doing too much, missing dependency injection), duplicated
logic that should be extracted, overly complex functions (cyclomatic complexity > 5), and missing
or incorrect TypeScript types beyond what ESLint catches. Return a list of QUALITY-NNN findings
with severity (HIGH/MEDIUM/LOW) and suggested refactoring. Do not flag style issues — ESLint
handles those. Focus on structural quality."
```

Both agents run after automated gates complete. Their findings are soft — they inform the report but do not block the QUALITY phase on their own. Hard gates (ESLint, TypeScript, secrets) always take precedence.

## Context

$ARGUMENTS

## Quality Gates (Run in This Order)

### Gate 1: ESLint
```bash
npm run lint
```
**Hard gate** — any error blocks the QUALITY phase.

Key rule to watch: `@typescript-eslint/no-explicit-any: error` — any `any` type fails the build.

If failures: show exact `file:line:col — error message` format. Do not summarise.

### Gate 2: TypeScript Strict Check
```bash
npm run type-check
```
**Hard gate** — zero errors expected.

Known pre-existing type errors (do NOT flag as new failures):
- `apps/api/src/services/workflow-scheduler.ts` — `isDigestItem` type mismatch
- `apps/api/src/routes/` — PostgrestQueryBuilder generic issue
- `apps/api/src/services/workflow-engine.ts` — rootDir issue

Any error NOT in this list is a new failure and must be fixed.

### Gate 3: Prettier Format Check
```bash
npx prettier --check .
```
**Soft gate** — reports violations but does not block. Fix with `npx prettier --write .`

### Gate 4: console.log Scan
```bash
grep -rn "console\.log" apps/ packages/ --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=".next" \
  --exclude="*.test.ts" --exclude="*.test.tsx"
```
**Soft gate** — `console.warn` and `console.error` are allowed (ESLint config permits them). Plain `console.log` should not be in production code.

### Gate 5: Hardcoded Secret Scan
```bash
grep -rn "sk-ant-\|Bearer \|password\s*=\s*['\"][^$]\|api_key\s*=\s*['\"]" \
  apps/ packages/ --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude="*.test.ts" --exclude="*.env*"
```
**Hard gate** — any match is a critical security failure. Stop immediately.

### Gate 6: Zod Schema Export Check
For each new `packages/shared/src/types/FEATURE.ts` added in this change:
- Verify it is exported from `packages/shared/src/types/index.ts`
- Verify the schema name follows the pattern `FeatureNameSchema` (PascalCase + Schema suffix)

### Gate 7: any in Staged Changes
```bash
git diff --staged -- "*.ts" "*.tsx" | grep "^\+" | grep ": any\b\|as any\b\|<any>"
```
**Hard gate** — catch `any` types introduced in the current change before they reach CI.

### Gate 8: Deleted_at on New Tables
For each new Supabase migration in `supabase/migrations/`:
- Verify every `CREATE TABLE` statement includes `deleted_at TIMESTAMPTZ`
- Verify `ENABLE ROW LEVEL SECURITY` present for each table
- Verify no `DELETE` RLS policy (soft deletes only)

## Output Format

```
## Quality Check — [timestamp]

### Gate 1: ESLint
Status: ✅ PASS / ❌ FAIL
[If FAIL: list each error as file:line — message]

### Gate 2: TypeScript
Status: ✅ PASS / ❌ FAIL (N new errors, M pre-existing)
[If FAIL: list new errors only]

### Gate 3: Prettier
Status: ✅ PASS / ⚠️ WARN (N files need formatting)
Fix: npx prettier --write .

### Gate 4: console.log
Status: ✅ PASS / ⚠️ WARN
[List any occurrences: file:line]

### Gate 5: Secrets
Status: ✅ PASS / 🚨 CRITICAL FAIL
[If FAIL: STOP — do not proceed to HARDEN or DEPLOY]

### Gate 6: Schema Exports
Status: ✅ PASS / ❌ FAIL
[List missing exports]

### Gate 7: any in Staged
Status: ✅ PASS / ❌ FAIL
[List occurrences]

### Gate 8: Migration Safety
Status: ✅ PASS / ❌ FAIL / N/A (no new migrations)

### Overall
READY FOR HARDEN ✅ / BLOCKED — fix failures above ❌
```

## Instructions

- Run gates in order — stop at Gate 5 (secrets) if any match found
- Hard gates (1, 2, 5, 6, 7) block progress to HARDEN
- Soft gates (3, 4) report but do not block
- Show exact file paths and line numbers — no vague summaries
- After all gates pass, output: "Quality gates passed. Proceeding to HARDEN phase."
