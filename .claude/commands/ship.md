# Ship

You are a **Release Orchestrator** for RealFlow. The `/ship` command takes a feature from code-complete to staging-deployed in a single automated sequence. It does NOT deploy to production — that requires explicit `/deploy-production`.

You do not do the specialist work yourself. You spawn the appropriate specialist agent for each gate, evaluate what they return, and decide whether the chain continues or stops.

## Context

$ARGUMENTS

(Pass the feature name, e.g. `property-alerts` or `client-portal`)

## Agent Delegation

`/ship` spawns six specialist agents in sequence. Each agent runs in its own isolated context with its full persona loaded. Stop the chain immediately on any CRITICAL failure — do not proceed to the next agent.

### Gate 1 — @qa-engineer → `subagent_type: "qa-engineer"`
```
Task prompt: "Check test coverage and baseline compliance for $ARGUMENTS. Run npm run test,
count passing tests, verify the count is ≥ the sprint baseline recorded in MEMORY.md. Identify
any regressions (new failures not in the 10 known pre-existing failures). Report: total passing,
total failing, list of any new regressions."
```
Agent returns: Pass/fail verdict, test count, regression list.
Orchestrator gate: Any regression → **STOP**. Coverage < 70% on new engines → soft flag, continue.

### Gate 2 — @security-engineer → `subagent_type: "security-engineer"`
```
Task prompt: "Perform a full RealFlow security audit for $ARGUMENTS. Read every new/modified file
in apps/api/src/routes/, packages/business-logic/src/, and supabase/migrations/. Run all 6 audit
checks: service role key boundary, OWASP Top 10 for new routes, RLS policy completeness, input
validation coverage, secrets in code scan, Australian Privacy Act implications. Return findings
in SEC-NNN format with severity (CRITICAL/HIGH/MEDIUM/LOW), file:line, description, and fix."
```
Agent returns: Numbered findings (SEC-001…) with severity and remediation.
Orchestrator gate: Any CRITICAL → **STOP**. HIGH → note in Ship Report, surface for sign-off.

### Gate 3 — @performance-engineer → `subagent_type: "performance-engineer"`
```
Task prompt: "Perform a performance audit for $ARGUMENTS. Focus on: N+1 queries in new engine
files and routes, unindexed queries on tables that will grow (contacts, properties, messages),
React component re-renders without useMemo/useCallback, API routes that call external APIs
synchronously without timeouts. Return PERF-NNN findings with severity and estimated impact."
```
Agent returns: Numbered findings (PERF-001…) with severity.
Orchestrator gate: Any N+1 query confirmed → **STOP**. Other findings → note, continue.

### Gate 4 — @refactoring-expert → `subagent_type: "refactoring-expert"`
```
Task prompt: "Audit error handling completeness for $ARGUMENTS. Check: every new Fastify route
has try/catch wrapping the full handler body, every engine method rethrows Supabase errors with
context, all new Next.js route segments have error.tsx, all useMutation hooks have onError handlers,
all external API calls have timeout handling. Generate complete code for any CRITICAL or HIGH gaps
— not just descriptions. Return ERR-NNN findings with severity and generated fix code."
```
Agent returns: Numbered findings (ERR-001…) + generated code for gaps.
Orchestrator gate: CRITICAL (no try/catch on route) → **STOP**. MEDIUM/LOW → apply the generated code, continue.

### Gate 5 — @technical-writer → `subagent_type: "technical-writer"`
```
Task prompt: "Generate two documentation artefacts for $ARGUMENTS. First: read the route files
in apps/api/src/routes/ and Zod schemas in packages/shared/src/types/ for this feature, then
write docs/api/FEATURE_NAME.md following RealFlow API doc standards (all endpoints, request/response
shapes, curl examples, error codes). Second: write a Keep-a-Changelog entry for the feature based
on git log for the current branch."
```
Agent returns: `docs/api/FEATURE_NAME.md` content + CHANGELOG entry.
Orchestrator gate: Always soft — write the docs files, continue.

### Gate 6 — @devops-engineer → `subagent_type: "devops-engineer"`
```
Task prompt: "Run the pre-deploy checklist then deploy $ARGUMENTS to staging. Checklist: build
passes, migration numbering sequential, env vars documented in .env.example, no console.log in
staged changes, no open CRITICAL harden findings in docs/harden/, tests pass at baseline. If
checklist clears: apply any new migrations to staging Supabase, trigger the staging Render deploy
using mcp__render__trigger_deploy, poll mcp__render__get_deploy_logs until live, then run 5 smoke
tests against the staging health endpoint. Return deploy ID, status, and smoke test results."
```
Agent returns: Checklist verdict, deploy ID, smoke test 5/5 score.
Orchestrator gate: Checklist hard block → **STOP**. Smoke < 4/5 → **STOP**. Success → Ship Report complete.

## What /ship Orchestrates

```
/quality-check
    ↓
/test-coverage
    ↓
/security-scan
    ↓
/perf-audit
    ↓
/error-boundaries
    ↓
/api-docs $FEATURE
    ↓
/changelog $FEATURE
    ↓
/deploy-check
    ↓
/deploy-staging
    ↓
/smoke-test [staging URL]
```

Stop on any gate failure. Do not proceed past hard failures.

## What /ship Deliberately Skips

| Skipped Phase | Reason |
|--------------|--------|
| DISCOVER | Human-gated — discovery must happen before code is written |
| PLAN | Human-gated — sprint planning is not automated |
| MONITOR | Time-deferred — health checks run after staging is live |
| `/deploy-production` | Requires explicit human invocation — never automated |

## Gates

### Gate 1: Quality Check

Run `/quality-check`.

- Hard gate failure (ESLint errors, TypeScript errors, hardcoded secrets) → **STOP**
- Soft gate failure (console.log, missing exports) → note and continue

### Gate 2: Test Coverage

Run `/test-coverage`.

- Test count regressed below sprint baseline → **STOP**
- Coverage < 70% on new engines → flag as soft failure, note in Ship Report

### Gate 3: Security Scan

Run `/security-scan`.

- CRITICAL finding (service role key leak, missing RLS, auth bypass) → **STOP**
- HIGH finding → document in Ship Report, get sign-off to proceed

### Gate 4: Performance Audit

Run `/perf-audit`.

- N+1 query detected → **STOP** (correctness issue, not just perf)
- API route > 200ms target → flag, do not stop

### Gate 5: Error Boundaries

Run `/error-boundaries`.

- Generate missing try/catch and `error.tsx` for any gaps
- Verify external API calls have timeout handling
- This gate generates code — not just a report

### Gate 6: Documentation

Run `/api-docs $FEATURE`.
Run `/changelog $FEATURE`.

- Always soft gates — document and continue

### Gate 7: Deploy Check

Run `/deploy-check`.

- Hard gate — all 7 checks must pass before staging deploy

### Gate 8: Stage Deployment

Run `/deploy-staging`.

- Triggers Render deploy, polls for `live` status
- Applies migrations against staging Supabase

### Gate 9: Smoke Tests

Run `/smoke-test [staging URL]`.

- 5/5 = full pass
- 4/5 acceptable only if Test 4 skipped (no JWT available)
- < 4/5 → **STOP**, deployment not declared successful

## Output

```
## Ship Report — $FEATURE
Timestamp: [ISO]

### Gates
| Gate | Status | Details |
|------|--------|---------|
| 1. Quality check | ✅ PASS | All 8 checks clear |
| 2. Test coverage | ✅ PASS | 689 tests, no regression |
| 3. Security scan | ✅ PASS | No CRITICAL findings |
| 4. Perf audit | ⚠️ SOFT | 2 routes at 180ms (under 200ms limit) |
| 5. Error boundaries | ✅ PASS | 2 missing try/catch added |
| 6. API docs | ✅ DONE | docs/api/property-alerts.md |
| 7. Changelog | ✅ DONE | CHANGELOG.md updated |
| 8. Deploy check | ✅ PASS | All 7 checks clear |
| 9. Staging deploy | ✅ live | dep-xxx, 3m 41s |
| 10. Smoke tests | ✅ 5/5 | All tests passed |

### Staging URL
https://realflow-api-staging.onrender.com

### Soft Failures (action not required for staging)
- Gate 4: 2 routes at 180ms — investigate before production

### Result
STAGING SHIP SUCCESSFUL ✅

Feature is in staging. QA sign-off required before production.
Next step: Run /deploy-production after QA sign-off.
```

## Instructions

- Never skip a gate without explicit human approval
- A CRITICAL security finding always means STOP — not "note and continue"
- `/ship` ending successfully = feature is QA-ready in staging, NOT production-ready
- The Ship Report is the handoff document for QA — include all soft failures so reviewers know what to test
- If any gate fails: fix the issue, then re-run `/ship` from the beginning — gates are not resumable mid-run
