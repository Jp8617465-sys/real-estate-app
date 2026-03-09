# Sprint 5 Report — Client Portal + Property Alerts

**Project:** RealFlow
**Sprint:** 5 of 6
**Theme:** Client Experience
**Dates:** February 2026 – March 7, 2026
**Status:** CODE COMPLETE — Deployed to Staging
**Author:** Sprint Manager Agent
**Generated:** 2026-03-08

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Sprint Goals vs. Outcomes](#sprint-goals-vs-outcomes)
3. [Features Delivered](#features-delivered)
4. [Database Changes](#database-changes)
5. [API Surface Added](#api-surface-added)
6. [Test Coverage](#test-coverage)
7. [Deployment Lessons — Staging Handoff](#deployment-lessons--staging-handoff)
8. [Architectural Decisions](#architectural-decisions)
9. [Tech Debt Introduced](#tech-debt-introduced)
10. [Lessons Learned](#lessons-learned)
11. [Sprint Commit Log](#sprint-commit-log)
12. [Next Sprint Preview](#next-sprint-preview)

---

## Executive Summary

Sprint 5 delivered the two features that most directly justify buyers agent subscription fees: the **Client Portal** and the **Property Alert Engine**. Clients can now log into a secure portal, review their brief, see matched properties their agent has curated for them, give structured feedback, and track their purchase journey. Agents receive real-time push, email, and SMS alerts when new property matches or price drops meet a configurable score threshold.

The sprint closed with **1,305 tests passing** across all packages (up from 1,215 at the Sprint 4 baseline), migrations 00014 and 00015 applied to the remote Supabase staging database, and a Render API service provisioned and live.

The handoff to staging surfaced five significant infrastructure issues. All five were diagnosed and resolved within the same session. The resolutions — particularly the CommonJS migration and the Redis connection guard — are documented below and have been hardened into the codebase for all subsequent sprints.

---

## Sprint Goals vs. Outcomes

| Goal (from Roadmap) | Outcome |
|---|---|
| Secure client login via Supabase Auth magic link | Delivered — portal uses magic-link flow |
| Brief review and sign-off | Delivered — `acknowledgeBrief` with IP audit field |
| Property shortlist with agent notes and match scores | Delivered — `getSentMatches` + match feedback |
| Inspection calendar and feedback forms | Delivered — `recordInspectionFeedback` |
| Document sharing (portal-visible toggle) | Delivered — `portal_visible` column + RLS policies |
| Progress tracker (pipeline stage with timeline) | Delivered — `/transaction` and `/key-dates` portal routes |
| Property alert subscriptions per brief | Delivered — `PropertyAlertEngine.createSubscription` |
| Real-time new-match notifications | Delivered — `handleNewMatch` wired to `DomainSyncEngine` |
| Price-drop alerts | Delivered — `handlePriceChange` wired to Domain sync |
| Mobile alerts screen | Delivered — `apps/mobile/app/alerts/index.tsx` |
| Offer tracker web parity | Partially delivered — offer routes exist; dedicated offer management UI deferred to Sprint 6 |
| Inspection logger enhancement (photo/AI summary) | Deferred — out of scope for Sprint 5 |

---

## Features Delivered

### Team A — Client Portal

#### PortalEngine (`packages/business-logic/src/portal-engine.ts`)

The `PortalEngine` class provides all server-side logic for client portal interactions. It is constructed with an injected `SupabaseClient`, which isolates it from the request context and makes it straightforwardly testable.

Key methods:

| Method | What It Does |
|---|---|
| `getPortalClient(authId)` | Fetches the active `portal_clients` row for the current Supabase auth user. Throws if the client does not exist or is inactive. |
| `acknowledgeBrief(briefId, authId, ip?)` | Validates ownership, then writes `acknowledged_at` and `acknowledged_ip` to `client_briefs`. Provides an audit trail for digital sign-off. |
| `getSentMatches(briefId)` | Returns all `property_matches` with `status = 'sent_to_client'`, ordered newest first. This is the client's property shortlist. |
| `recordMatchFeedback(matchId, feedback, authId)` | Validates the feedback value (interested / not_interested / ask_agent) via Zod, confirms ownership, and writes `client_feedback`, `client_feedback_at`, and `client_feedback_note`. |
| `recordInspectionFeedback(inspectionId, feedback, authId)` | Validates a 1-5 star rating plus free-text note, confirms ownership, and writes `client_rating` and `client_feedback` to `inspections`. |

All ownership checks follow the same pattern: resolve the portal client from the JWT `auth_id`, then traverse the FK chain to confirm the requested record belongs to that contact. This prevents one portal client from reading or mutating another client's data even if they obtain a valid ID.

#### Portal Routes (`apps/api/src/routes/portal.ts`)

Extends the existing portal route file with 10+ new endpoints served under the `/portal` prefix. Key additions:

- `GET /me` — returns the portal client profile with joined contact and agent details
- `GET /transaction` — the active transaction for progress tracking
- `GET /brief` — the client's brief (read-only)
- `POST /brief/acknowledge` — triggers `PortalEngine.acknowledgeBrief`
- `GET /matches` — calls `PortalEngine.getSentMatches`
- `POST /matches/:matchId/feedback` — calls `PortalEngine.recordMatchFeedback`
- `GET /inspections` — upcoming and past inspections for the client
- `POST /inspections/:id/feedback` — calls `PortalEngine.recordInspectionFeedback`
- `GET /documents` — documents where `portal_visible = true`
- `GET /key-dates` — key dates joined through the transaction
- `POST /invite` — generates a Supabase magic link and emails it to the contact

#### Agent Web — Document Toggle and Invite Button (`apps/web`)

- Document list gains a `portal_visible` toggle (rendered as a switch component). Updates `documents.portal_visible` via a `useDocuments` hook with optimistic mutation.
- Contact detail page gains a "Send Portal Invite" button that calls `POST /api/v1/portal/invite` and shows a toast on success.

#### Portal App Pages (`apps/portal`)

Pages were reorganised from a flat route structure into a `(dashboard)` route group to resolve a duplicate route conflict that prevented the portal from building. Updated pages:

- `/brief` — displays brief fields in read-only format with an "Acknowledge Brief" button
- `/documents` — filtered to `portal_visible = true`, with download links
- `/inspections` — upcoming inspections list with a five-star feedback form on past inspections
- `/messages` — conversation thread with the assigned agent

---

### Team B — Property Alert Engine

#### PropertyAlertEngine (`packages/business-logic/src/property-alert-engine.ts`)

The `PropertyAlertEngine` class handles all alert subscription lifecycle operations and notification dispatch. It accepts injected notifier functions for push, email, and SMS, making channel-level behaviour swappable without changing engine logic.

Key methods:

| Method | What It Does |
|---|---|
| `isQuietHours(start, end, nowUtc)` | Converts UTC to AEST (UTC+10) and checks whether the current time falls within the configured quiet window. Handles midnight wrap-around (e.g. 21:00–07:00). |
| `handleNewMatch(propertyMatchId)` | Triggered by `DomainSyncEngine` after a new property match is created. Finds active subscriptions for the brief where `overall_score >= score_threshold`. Respects digest mode and quiet hours. Dispatches alerts and writes audit events. |
| `handlePriceChange(priceChangeId)` | Triggered after a `property_price_changes` row is detected. Finds active matches for the affected property, then dispatches `price_drop` alerts to subscribed agents. |
| `dispatch(sub, score, title, body, data)` | Private method. Iterates the subscription's channel list (push/email/SMS). Looks up the agent's push token, email, or phone as needed. Per-channel errors are caught so one failed channel never blocks others. Returns the list of channels that successfully delivered. |
| `createSubscription(agentId, data)` | Validates input with `CreateAlertSubscriptionSchema`, inserts a new `property_alert_subscriptions` row, and returns the mapped domain object. |
| `updateSubscription(id, agentId, data)` | Verifies agent ownership before applying partial updates. |
| `deleteSubscription(id, agentId)` | Soft-deletes by writing `deleted_at` rather than removing the row. |
| `getAlertEvents(agentId, limit)` | Returns the recent alert event log, joined through subscriptions to enforce agent ownership. |
| `sendMatchToClient(matchId, agentId)` | Sets `property_matches.status = 'sent_to_client'` and inserts a notification row for the portal client user. |

#### Integration with DomainSyncEngine

`DomainSyncEngine.runSyncJob` was extended to collect `newMatchIds` from the property match upsert step. After the sync completes, each new match ID fires `handleNewMatch` as a non-blocking call. Price changes detected during the sync trigger `handlePriceChange` per change record. This means alert delivery does not add latency to the sync job response.

#### Alert Routes (`apps/api/src/routes/alerts.ts`)

Seven endpoints under the `/alerts` prefix:

| Method | Path | Description |
|---|---|---|
| GET | `/alerts/subscriptions` | List all subscriptions for the authenticated agent |
| POST | `/alerts/subscriptions` | Create a new subscription |
| PATCH | `/alerts/subscriptions/:id` | Update threshold, channels, digest mode, or quiet hours |
| DELETE | `/alerts/subscriptions/:id` | Soft-delete a subscription |
| POST | `/alerts/matches/:matchId/send-to-client` | Mark a match as sent to the portal client |
| DELETE | `/alerts/matches/:matchId/send-to-client` | Retract a match (sets status back to `reviewed`) |
| GET | `/alerts/events` | List recent alert events (default limit 50, max 100) |

All endpoints verify the JWT caller owns the resource before performing any mutation. 403 is returned for unauthorised access; 404 for not found; 400 for schema validation failures.

#### Agent Web — Alerts UI (`apps/web`)

- `/alerts` — event history page showing recent alert events with match-score pills and a "Send to Client" action button
- `/buyers-agent/briefs/[id]/alerts` — per-brief subscription management with a score-threshold slider, channel checkboxes, digest mode toggle, and quiet-hours time pickers
- `use-alerts.ts` — six React Query hooks covering events, subscriptions, create, update, delete, and `sendMatchToClient` with optimistic updates

#### Mobile — Alerts Screen (`apps/mobile/app/alerts/index.tsx`)

Full alerts screen combining:

- Recent alert events list (newest first) with alert type badge, match score, and delivery channel indicators
- Active subscriptions section with brief name, threshold, and enabled channels
- Push-notification routing: tapping a notification navigates to the relevant screen

Additionally, the contact detail screen gains a "Portal Invite" quick-action button that calls `POST /api/v1/portal/invite` with the agent's auth token.

---

## Database Changes

### Migration 00014 — Portal Completions

Applied to: `client_briefs`, `documents`, `inspections`, `property_matches`

```
client_briefs
  + acknowledged_at       TIMESTAMPTZ
  + acknowledged_ip       INET

documents
  + portal_visible        BOOLEAN NOT NULL DEFAULT FALSE

inspections
  + client_rating         INTEGER CHECK (client_rating BETWEEN 1 AND 5)
  + client_feedback       TEXT
  + client_feedback_at    TIMESTAMPTZ

property_matches
  + client_feedback       TEXT CHECK (client_feedback IN ('interested','not_interested','ask_agent'))
  + client_feedback_at    TIMESTAMPTZ
  + client_feedback_note  TEXT
```

RLS policies added (9 total):
- `portal_client_read_brief` — clients read own briefs via `portal_clients.contact_id`
- `portal_client_acknowledge_brief` — clients update own brief's acknowledgement fields
- `portal_client_read_sent_matches` — clients read `status = 'sent_to_client'` matches only
- `portal_client_feedback_match` — clients write feedback on sent matches
- `portal_client_read_inspections` — clients read own inspections
- `portal_client_feedback_inspection` — clients write inspection ratings
- `portal_client_read_key_dates` — clients read key dates joined through their transaction
- `portal_client_read_documents` — clients read documents where `portal_visible = true`

The existing `portal_clients_read_documents` policy was dropped and replaced with the new scoped policy.

### Migration 00015 — Property Alerts

Two new tables:

**`property_alert_subscriptions`**

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
agent_id          UUID NOT NULL REFERENCES users(id)
brief_id          UUID NOT NULL REFERENCES client_briefs(id)
score_threshold   INTEGER NOT NULL DEFAULT 70 CHECK (score_threshold BETWEEN 50 AND 100)
channels          TEXT[] NOT NULL DEFAULT '{push}'
digest_mode       BOOLEAN NOT NULL DEFAULT FALSE
digest_time       TIME NOT NULL DEFAULT '07:00:00'
quiet_hours_start TIME NOT NULL DEFAULT '21:00:00'
quiet_hours_end   TIME NOT NULL DEFAULT '07:00:00'
is_active         BOOLEAN NOT NULL DEFAULT TRUE
deleted_at        TIMESTAMPTZ
created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE (agent_id, brief_id)
```

**`property_alert_events`** (append-only audit log)

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
subscription_id   UUID NOT NULL REFERENCES property_alert_subscriptions(id)
property_match_id UUID REFERENCES property_matches(id) ON DELETE SET NULL
alert_type        TEXT NOT NULL CHECK (alert_type IN ('new_match','price_drop','auction_date','status_change'))
channels_attempted TEXT[] NOT NULL DEFAULT '{}'
channels_delivered TEXT[] NOT NULL DEFAULT '{}'
match_score       INTEGER NOT NULL
sent_at           TIMESTAMPTZ
actioned_at       TIMESTAMPTZ
action            TEXT CHECK (action IN ('viewed','sent_to_client','dismissed','snoozed'))
snooze_until      TIMESTAMPTZ
created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Indexes: partial indexes on `agent_id` and `brief_id` where `deleted_at IS NULL` (subscriptions); composite index on `(subscription_id, created_at DESC)` and `property_match_id` (events).

RLS policies:
- `agents_own_subscriptions` — full access for the owning agent
- `agents_read_own_events` — agents read events via subscription ownership join

### Migration Renumbering

Duplicate-numbered migrations were discovered during staging push: two `00006_*` and two `00009_*` files. All subsequent files were renumbered to produce a clean sequential series (00016–00019 for Sprint 3–4 content). The full applied series on staging after Sprint 5 is 00001–00019.

---

## API Surface Added

Sprint 5 added the following net-new endpoints to the RealFlow API:

**Portal routes** (`/api/v1/portal/...`)

| Method | Path |
|---|---|
| GET | `/portal/me` |
| GET | `/portal/transaction` |
| GET | `/portal/brief` |
| POST | `/portal/brief/acknowledge` |
| GET | `/portal/matches` |
| POST | `/portal/matches/:matchId/feedback` |
| GET | `/portal/inspections` |
| POST | `/portal/inspections/:id/feedback` |
| GET | `/portal/documents` |
| GET | `/portal/key-dates` |
| POST | `/portal/invite` |

**Alert routes** (`/api/v1/alerts/...`)

| Method | Path |
|---|---|
| GET | `/alerts/subscriptions` |
| POST | `/alerts/subscriptions` |
| PATCH | `/alerts/subscriptions/:id` |
| DELETE | `/alerts/subscriptions/:id` |
| POST | `/alerts/matches/:matchId/send-to-client` |
| DELETE | `/alerts/matches/:matchId/send-to-client` |
| GET | `/alerts/events` |

The API route count grew from 33 to 36 files total.

---

## Test Coverage

### Test Count Delta

| Package | Sprint 4 Baseline | Sprint 5 Final | Delta |
|---|---|---|---|
| `@realflow/shared` | ~150 | 168 | +18 |
| `@realflow/integrations` | ~100 | 122 | +22 |
| `@realflow/business-logic` | ~580 | 730 | +150 |
| `apps/api` | ~185 | 285 | +100 |
| **Total** | **~1,215** | **1,305** | **+90** |

### New Test Files

- `packages/business-logic/src/portal-engine.test.ts` — 445 lines, covering all five `PortalEngine` methods including ownership rejection cases
- `packages/business-logic/src/property-alert-engine.test.ts` — 654 lines (expanded to 716 lines after post-review addition of `handlePriceChange` happy path and error path tests)
- `apps/api/src/routes/alerts.test.ts` — 584 lines, covering all seven alert endpoints
- `apps/api/src/routes/portal.test.ts` — expanded by 480 lines for new portal endpoints

### Pre-existing Failures

The following failures existed before Sprint 5 and were not introduced by this sprint. They remain tracked as known debt:

| Test File | Count | Root Cause |
|---|---|---|
| `apps/api/src/routes/pipeline-migration.test.ts` | 7 | Supabase mock not intercepting route-level calls correctly |
| `apps/api/src/services/integration-registry.test.ts` | 2 | Arrow-function class constructor mocks in Vitest |
| `apps/api/src/routes/social-posts.test.ts` | 1 | Same arrow-function mock issue as above |

Total pre-existing failures: 10. These were inherited from Sprint 4 and have no impact on Sprint 5 deliverables.

---

## Deployment Lessons — Staging Handoff

Sprint 5 was the first sprint where all migrations were applied to the remote Supabase staging database and the Render API service was fully provisioned. Five distinct infrastructure failures were encountered and resolved during the staging handoff session. These are documented here in full because they affect every future deployment.

---

### Issue 1 — Turbo Workspace Resolution: `packageManager` Field

**Symptom:** Render build exited 127 (command not found). Turbo 2.8.14 could not resolve workspace packages.

**Root cause:** The `packageManager` field in root `package.json` was absent. Turbo 2.8.14 requires this field to identify the package manager and resolve workspace dependency links. Without it, the workspace graph was not built correctly and inter-package imports failed at runtime.

**Resolution:** The `packageManager` field was added back. A subsequent conflict arose because Render's build environment invoked Corepack when `packageManager` was present, and Corepack was not installed on the Render base image, producing the same exit-127 error via a different path. The final fix pins the Render build command to `npm install --ignore-scripts` and ensures Corepack is explicitly disabled in the Render environment.

**Commits:** `147df94`, `f5225ea`, `1059df7`

---

### Issue 2 — CommonJS Migration: Workspace Packages Must Compile to `dist/`

**Symptom:** API server crashed on startup with `ERR_REQUIRE_ESM` when importing `@realflow/shared`, `@realflow/business-logic`, and `@realflow/integrations`.

**Root cause:** All three workspace packages were configured with `"type": "module"` and their `package.json` `main` field pointed directly at TypeScript source files (e.g. `src/index.ts`). Node.js in the Render environment loaded them as ES modules via the source path, but the API server (Fastify, CommonJS) used `require()`, producing the ESM interop error.

**Resolution:** All three workspace packages were reconfigured to compile to `dist/` as CommonJS. The build steps are:

1. Each package's `tsconfig.json` sets `"module": "CommonJS"` and `"outDir": "dist"`.
2. Each package's `package.json` `main` field points to `"dist/index.js"`.
3. Turbo's build pipeline for each package runs `tsc` before the API server starts.
4. The API's `tsconfig.json` also moved to `"module": "CommonJS"` to align with the runtime.

**Files changed:** `packages/shared/package.json`, `packages/business-logic/package.json`, `packages/integrations/package.json`, plus their respective `tsconfig.json` files, and `apps/api/tsconfig.json`.

**Commit:** `61ac86d`, `337e144`

**Ongoing impact:** All future packages added to the monorepo must follow the same compiled-CommonJS pattern. Do not expose TypeScript source as the package entry point.

---

### Issue 3 — Missing Explicit Dependency: `@realflow/integrations` in `business-logic`

**Symptom:** Turbo's parallel build occasionally failed with a module-not-found error for `@realflow/integrations` when building `@realflow/business-logic`.

**Root cause:** `PropertyAlertEngine` in `@realflow/business-logic` was importing channel notifiers that internally referenced `@realflow/integrations` types, but `@realflow/integrations` was not listed in `business-logic/package.json`'s `dependencies`. Turbo's dependency graph therefore did not guarantee that `integrations` was built before `business-logic`, creating a race condition in parallel builds.

**Resolution:** `@realflow/integrations` added to `packages/business-logic/package.json` `dependencies`. Turbo then enforces build order: `integrations` builds before `business-logic`.

**Commit:** `021c7c2`

**Lesson:** Any cross-package import — even of types — must be declared as an explicit `dependency` in `package.json`. TypeScript's `references` field in `tsconfig` is not sufficient for Turbo's build-order resolution.

---

### Issue 4 — Redis Hang: `cache.connect()` Without Timeout

**Symptom:** The API server started but never became healthy. Health check requests timed out. No error was logged.

**Root cause:** The cache layer called `redis.connect()` unconditionally during startup. When `REDIS_URL` is not set in the environment, `ioredis` attempts to connect to `localhost:6379` by default, retries indefinitely with exponential back-off, and never throws. The startup await on `cache.connect()` hung forever, blocking the Fastify `listen()` call.

**Resolution:** The cache initialisation is now guarded:

```typescript
if (process.env.REDIS_URL) {
  await cache.connect();
} else {
  logger.warn('REDIS_URL not set — cache disabled, running in passthrough mode');
}
```

When Redis is unavailable, all cache reads return a miss and all cache writes are no-ops. The API runs fully without Redis; Redis is an optional performance optimisation, not a hard dependency.

**Commit:** `6d6a144`

**Lesson:** Never await an external connection without a timeout guard and a graceful degradation path. Infrastructure dependencies should be optional unless explicitly required for correctness.

---

### Issue 5 — JWT Validation: Malformed JWTs Returned 500

**Symptom:** Requests from the portal app with an expired or malformed JWT received a 500 Internal Server Error instead of 401 Unauthorized.

**Root cause:** `createSupabaseClient` passed the raw `Authorization` header value to the Supabase client without validating its structure. When the token was malformed (e.g. wrong segment count, invalid base64), the Supabase JS client threw a JSON parse error deep in its internals. Fastify's global error handler caught the unchecked exception and returned 500.

**Resolution:** Two changes:

1. `createSupabaseClient` validates the JWT structure (three dot-separated segments, valid base64 middle segment) before constructing the client. A malformed token throws an `AuthError` immediately.
2. The global error handler maps `AuthError` instances to 401.

This means all malformed or expired tokens now return 401 before any Supabase call is made, which is the correct HTTP semantics.

**Commits:** `d0e5c4d`, `d890731`

---

### PostgreSQL 17 Compatibility

Two SQL patterns that work on PG14/15 fail silently or error on PG17 (Supabase staging is PG17):

| Pattern | PG17 Behaviour | Fix |
|---|---|---|
| `uuid_generate_v4()` | Function does not exist — the `uuid-ossp` extension is not loaded by default | Use `gen_random_uuid()` (built-in, no extension required) |
| `CURRENT_DATE` in `GENERATED ALWAYS AS` | Fails — generated columns require immutable expressions; `CURRENT_DATE` is stable, not immutable | Use a plain `TIMESTAMPTZ` column and compute the value in application code |

All new migrations from Sprint 5 onward use `gen_random_uuid()` exclusively.

---

## Architectural Decisions

### CommonJS as the Standard Module Format for Workspace Packages

**Decision:** All workspace packages (`@realflow/shared`, `@realflow/business-logic`, `@realflow/integrations`) compile to CommonJS and expose their entry point through `dist/index.js`.

**Context:** The monorepo originally used ESM source exposure (pointing `package.json` `main` at `src/index.ts`). This worked in development because `ts-node` or Vitest handled the compilation transparently. It failed in production because Node.js 20 on Render treats `.js` files with `"type": "module"` as ES modules, and `require()` in the Fastify server cannot import them.

**Trade-off accepted:** Developers must run `npm run build` (or rely on Turbo's watch mode) to see cross-package changes reflected. The alternative — full ESM throughout — would require `"type": "module"` in every package and dynamic `import()` in Fastify, which is a larger migration with Fastify plugin compatibility risks.

**Future path:** When the team is ready to migrate fully to ESM, the correct sequence is: migrate Fastify server first (it has ESM support), then switch packages one at a time, then update tsconfig files. Do not attempt a big-bang ESM migration.

---

### Alert Dispatch as Fire-and-Forget

**Decision:** `handleNewMatch` and `handlePriceChange` are called without `await` from the Domain sync job.

**Rationale:** Alert delivery (push notifications, email, SMS) may take 50–500ms per channel. Blocking the sync job response on alert delivery would degrade sync throughput when many matches are found. The audit log in `property_alert_events` ensures no alert is silently lost — if dispatch fails for a subscription, the event row is still written with `sent_at = null`, enabling retry logic in a future sprint.

**Risk:** If the API process crashes between the sync completing and the alert being dispatched, some alerts may be missed. This is acceptable for v1; a persistent job queue (e.g. Supabase Edge Functions + pg_queue) is the correct long-term solution.

---

### Quiet Hours in AEST, Not Agent Timezone

**Decision:** All quiet-hour calculations use a static AEST offset (UTC+10) rather than a per-agent timezone setting.

**Rationale:** The target market is Australian buyers agents. The overwhelming majority operate in Sydney/Melbourne (AEST/AEDT). A static UTC+10 offset is correct 6 months of the year and off by one hour during AEDT. This is an acceptable approximation for v1. Per-agent timezone support (storing `timezone` on the `users` table and using a proper timezone library) is tracked as Sprint 6 tech debt.

---

### makeAlertEngine Factory

A factory function `makeAlertEngine(supabase)` was extracted to `apps/api/src/lib/make-alert-engine.ts` to avoid constructing notifier functions inline at six separate route call sites. This keeps the route handlers free of integration configuration logic and makes the construction point for `PropertyAlertEngine` a single auditable location.

---

## Tech Debt Introduced

The following items were deferred or left intentionally imperfect in Sprint 5. Each has a suggested resolution.

| ID | Description | Impact | Suggested Fix |
|---|---|---|---|
| TD-S5-01 | AEST static offset ignores AEDT (daylight saving) — quiet hours are one hour off for ~6 months/year | Low — one-hour drift on notifications | Store `timezone` on `users`, use `date-fns-tz` or `Intl` for conversion |
| TD-S5-02 | `auction_date` and `status_change` alert types exist in the DB schema but have no dispatch implementation | Low — alerts simply never fire for these types | Implement auction-date cron job in Sprint 6 or 7 |
| TD-S5-03 | Alert retry logic is absent — events with `sent_at = null` are not automatically retried | Medium — missed alerts require manual intervention | Add a Supabase cron or Edge Function that retries null `sent_at` events after 15 minutes |
| TD-S5-04 | Portal invite uses GmailClient directly in the route handler rather than through the communication hub | Low — inconsistent with other email dispatch | Route invite email through the unified messaging layer |
| TD-S5-05 | Mobile hook tests (`use-tasks`, `use-property-matches`) fail with "document is not defined" — jsdom is not installed in the mobile test environment | Medium — mobile test coverage understated | Install `jsdom` as a dev dependency in the mobile package and configure `vitest.config.ts` `environment: 'jsdom'` |
| TD-S5-06 | No E2E tests for the client portal flow (login → brief acknowledge → match feedback) | High — critical user journey untested outside unit scope | Add Playwright tests targeting the staging portal URL |
| TD-S5-07 | `portal_visible` toggle on the web documents page does not confirm before toggling — accidental toggling could expose sensitive documents | Medium — UX risk | Add a confirmation dialog for toggling `portal_visible = true` |

---

## Lessons Learned

### Infrastructure Issues Compound During First Staging Push

Sprint 5 was the first sprint where code was deployed to a real environment with a real database. Four of the five deployment issues were categories of problem that would never surface in local development — module format mismatches, missing production environment variables, connection hang-on-startup patterns, and JWT error handling. These issues are solved once; every future sprint benefits.

**Recommendation:** Add a staging smoke-test step to the CI pipeline that runs a health check and a basic authenticated request against the staging URL immediately after deployment. Catching infrastructure failures in CI is cheaper than debugging them in a sprint session.

### Explicit Package Dependencies Are Non-Negotiable in Turbo

TypeScript's path aliases and `references` give the impression that packages know about each other. Turbo's build graph is driven entirely by `package.json` `dependencies` and `devDependencies`. Any import that crosses package boundaries must be accompanied by an explicit declaration in `package.json`, or the parallel build will fail non-deterministically.

**Recommendation:** Add a lint rule or pre-commit check that verifies cross-package imports are declared in `package.json`. This can be implemented as a simple script that parses `import` statements and cross-references `package.json`.

### Redis and Other Optional Infrastructure Must Degrade Gracefully

The API should start and serve traffic correctly whether or not Redis, email, or SMS providers are available. Hard startup dependencies make deployments fragile and make local development require a full infrastructure stack.

**Recommendation:** Audit all remaining infrastructure connections (Redis, external email, Twilio) and apply the same guard pattern used for Redis in this sprint: check for the environment variable, log a warning if absent, operate in passthrough mode.

### Malformed JWTs Are a Normal Input, Not an Exceptional Error

Clients — especially mobile apps — routinely send expired or malformed tokens. Treating this as an unhandled exception that surfaces as 500 is incorrect HTTP behaviour and confusing to API consumers. All authentication-related errors should be caught at the boundary and mapped to 401 before reaching any business logic.

### Post-Review Fixes Are Cheaper Before Merge

The Sprint 5 post-review commit (`e944bdb`) added `handlePriceChange` tests and refactored `makeAlertEngine` extraction — work that would have been caught by a PR review checklist. Formalising review criteria (test coverage for all public methods, no inline construction of injected dependencies, no duplicated fetch helpers) in a `CONTRIBUTING.md` or PR template reduces the size of post-review fix batches.

---

## Sprint Commit Log

The following commits comprise Sprint 5 work on the `sprint-5` branch, in reverse chronological order:

| Hash | Description |
|---|---|
| `e944bdb` | fix: Sprint 5 post-review quality and correctness fixes |
| `ee9b81f` | fix: skip husky in CI environments (is-ci guard for Render build) |
| `b6ce610` | feat: Sprint 5 complete — Client Portal + Property Alerts + staging deployment |
| `76b4cdc` | feat: complete Sprint 5 — wire alert engine + agent alert UI + mobile portal invite |

Infrastructure fixes applied during staging handoff (resolved within the sprint session):

| Hash | Description |
|---|---|
| `d0e5c4d` | fix: reject malformed JWTs with 401 before calling Supabase |
| `d80efc1` | fix: add @realflow/business-logic dep to portal so turbo builds it first |
| `d890731` | fix: map JWT parse errors to 401 in global error handler |
| `6d6a144` | fix: skip Redis connection when REDIS_URL is not set |
| `e150a49` | fix: resolve PR #35 CI build + code quality issues |
| `021c7c2` | fix: add @realflow/integrations as explicit dep of business-logic |
| `61ac86d` | fix: compile workspace packages as CommonJS and resolve main to dist/ |
| `337e144` | fix: switch API tsconfig to CommonJS to fix Node ESM module resolution at startup |

---

## Next Sprint Preview

**Sprint 6 — Growth and Scale** is currently in PR-ready state with approximately 1,391 tests passing (+86 from this sprint's baseline).

Sprint 6 deliverables:

- **SocialLeadEngine** — DM-to-CRM ingestion from Facebook Messenger and Instagram DMs
- **OffMarketEngine** — manual off-market property creation, matching against active briefs, and agent-only visibility
- **TeamEngine** — multi-agent dashboard, round-robin lead assignment rules (implemented as an atomic PostgreSQL function), and team performance snapshots
- **New tables:** `social_dm_leads`, `off_market_properties`, `off_market_matches`, `lead_assignment_rules`, `team_performance_snapshots`
- **Migrations:** 00020 (social DM leads), 00021 (off-market), 00022 (team/agency), 00023 (atomic round-robin function)

The CommonJS migration and Redis guard work completed in Sprint 5 will carry forward without modification. The `docs/sprints/` reporting pattern established by this document will continue as `SPRINT_6_REPORT.md`.
