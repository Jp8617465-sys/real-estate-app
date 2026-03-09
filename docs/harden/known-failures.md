# Known Pre-Existing Issues — RealFlow

Last updated: 2026-03-09 (UAT sweep for Sprint 6)

## Test Failures (previously pre-existing — now resolved)

During the Sprint 6 UAT sweep, all 10 previously documented pre-existing test failures were found to be **already fixed**:
- 7 `pipeline-migration.test.ts` failures — resolved
- 2 `integration-registry.test.ts` failures — resolved
- 1 `social-posts.test.ts` failure — resolved

Current status: **0 failing tests** across all 1,782 tests.

---

## TypeScript Type Errors (pre-existing, non-blocking)

These TypeScript errors exist in the codebase and are NOT introduced by Sprint 6. They are pre-existing issues in Sprint 3/4 code:

### 1. `apps/mobile` — NativeWind `className` TypeScript Errors

**Location:** Mobile components using `className` prop on React Native primitives
**Root Cause:** NativeWind extends React Native types but TypeScript doesn't always pick up the extended types
**Impact:** Type-check fails on `apps/mobile` but builds and runs correctly
**Status:** Pre-existing, earmarked for Sprint 7 mobile type fixes

### 2. `apps/api/src/services/workflow-scheduler.ts` — `isDigestItem` Error

**Location:** `apps/api/src/services/workflow-scheduler.ts`
**Root Cause:** Type narrowing issue with digest item discriminated union
**Impact:** Type error only, no runtime impact
**Status:** Pre-existing since Sprint 3

### 3. `apps/api/src/routes/workflow-engine.ts` — `rootDir` Error

**Location:** Possibly `tsconfig.json` rootDir configuration
**Root Cause:** tsconfig path resolution
**Impact:** Type error only, no runtime impact
**Status:** Pre-existing since Sprint 3

---

## Security Findings (documented, tracked for Sprint 7)

From `docs/harden/security-report.md`:

### CRITICAL (3)
- **C-1**: `push-tokens.ts` — `userId` from request body (should be from JWT)
- **C-2**: `inbox.ts` — No auth guard on any handler; agent ID resolved via un-scoped query
- **C-3**: `workflows.ts` — No auth guard; `createdBy` from request body

### HIGH (5)
- **H-1**: 16 routes rely solely on RLS (no application-layer auth check)
- **H-2**: `webhooks.ts` — HMAC signature validation is optional when secret not set (fail-open)
- **H-3**: `domain-sync.ts` — Empty string HMAC key when secret unset
- **H-4**: `portal.ts` — Service role client instantiated inline
- **H-5**: `social-leads.ts` — DM ingest bypasses signature when `META_APP_SECRET` unset

**Fix sprint:** Sprint 7 security hardening session

---

## Performance Findings (documented, tracked for Sprint 7)

From `docs/harden/perf-report.md`:

### CRITICAL (3)
- **CRIT-1**: N+1 contact fetch in `workflows.ts` dispatch loop
- **CRIT-2**: N+1 subscription fetch in `property-alert-engine.ts` price-change handler
- **CRIT-3**: 6 sequential DB round-trips per agent in `team-engine.ts` snapshot cron

**Fix sprint:** Sprint 7 performance hardening session

---

## Error Boundary Findings (documented, tracked for Sprint 7)

From `docs/harden/error-boundaries-report.md`:

### CRITICAL (5)
- **ERR-001**: No `request.log.error` in any new route catch block
- **ERR-002**: `GET /:id` handlers swallow all errors as 404
- **ERR-003**: Portal app has zero `error.tsx` boundaries
- **ERR-004**: Sprint 6 web segments missing segment-level `error.tsx`
- **ERR-005**: No PGRST116 differentiation in new engine `getById`

**Fix sprint:** Sprint 7 error boundary hardening session

---

## Routes Missing from `apps/api/src/index.ts`

These route files exist and have tests but are NOT registered in `index.ts` (unreachable at runtime):
- `domain-webhooks.ts` — POST /api/webhooks/domain/*
- `inbox-email.ts` — POST /api/v1/inbox/email*
- `market-data.ts` — GET /api/v1/market-data/*

**Fix:** Add these 3 route registrations to `index.ts` in Sprint 7.

---

## Missing `.env.example` Documentation

From `docs/sprints/DEPLOY_CHECK_SPRINT6.md`, 11 env vars used in code are not in `.env.example`:

| Env Var | Used In |
|---------|---------|
| `GOOGLE_CLIENT_ID` | `integration-registry.ts`, `settings.ts` |
| `GOOGLE_CLIENT_SECRET` | `integration-registry.ts` |
| `GOOGLE_REDIRECT_URI` | `settings.ts` |
| `META_APP_ID` | `settings.ts` |
| `META_REDIRECT_URI` | `settings.ts` |
| `DOMAIN_REDIRECT_URI` | `settings.ts` |
| `TWILIO_TWIML_URL` | `inbox.ts` |
| `META_WEBHOOK_VERIFY_TOKEN` | `inbox-webhooks.ts` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | `inbox-webhooks.ts` |
| `SENDGRID_WEBHOOK_SECRET` | `inbox-email.ts` |
| `MAILGUN_WEBHOOK_SECRET` | `inbox-email.ts` |

**Fix:** Add these to `apps/api/.env.example` before production deploy.
