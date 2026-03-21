# Changelog — Sprint 8

All notable changes in Sprint 8 (Hardening & Production Readiness).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Sprint 8 scope: 2026-03-09 to 2026-03-11.

---

## [8.0.0] - 2026-03-11

### Security

- **C-1 — `push-tokens.ts`: userId no longer accepted from request body.** The `userId` field has been removed from `RegisterPushTokenSchema`. The authenticated user's ID is now resolved exclusively from `supabase.auth.getUser()` before any write to `push_device_tokens`. An authenticated user can no longer register a push token on behalf of an arbitrary user ID.

- **C-2 — `inbox.ts`: authentication guard added to all 9 route handlers.** Every handler in `inbox.ts` now calls `supabase.auth.getUser()` at the entry point. All list, read, and write queries are scoped to the authenticated agent's ID. The unbounded `.from('users').select('id').single()` call that returned an arbitrary first user row has been replaced with the verified `user.id` from `getUser()`.

- **C-3 — `workflows.ts`: authentication guard added; `createdBy` removed from accepted input.** All workflow route handlers now call `getUser()`. The `createdBy` field has been removed from `CreateWorkflowBodySchema` and `CreateFromTemplateBodySchema`. The value is derived from the authenticated user's JWT and cannot be caller-supplied.

- **H-2 — `webhooks.ts`: HMAC signature validation is now fail-closed.** The Domain enquiry and Meta lead webhook endpoints previously skipped signature verification when the corresponding secret environment variable was not configured. Both endpoints now return 401 if the secret is absent, preventing unauthenticated payload injection in misconfigured environments.

- **H-3 — `domain-sync.ts`: empty-string HMAC key bypass removed.** The webhook handler previously used `DOMAIN_WEBHOOK_SECRET ?? ''`, allowing an attacker who knew the secret was unset to forge a valid HMAC using an empty key. The handler now returns 401 immediately if `DOMAIN_WEBHOOK_SECRET` is not set.

- **H-4 — `portal.ts`: inline service role client replaced with factory.** The `POST /portal/invite` handler was instantiating a Supabase service role client inline via `createClient(url, key)`, bypassing the project's `createSupabaseServiceClient()` factory. The inline instantiation has been replaced with the factory call, restoring the single auditable construction point for the service role client.

- **H-5 — `social-leads.ts`: `META_APP_SECRET` is now mandatory.** The DM ingest endpoint previously logged a warning and continued processing when `META_APP_SECRET` was not configured. It now returns 401. Deployment without this secret is not permitted in staging or production.

- **H1 (additional) — `inbox.ts`: Zod `.parse()` replaced with `.safeParse()`.** Unhandled Zod parse exceptions from malformed request bodies have been replaced with controlled 400 responses across all inbox handlers.

- **H2 (additional) — `inbox.ts`: IDOR vulnerability fixed on `GET /contacts/:contactId/channels`.** The handler now verifies the authenticated agent owns the specified contact before returning channel data.

- **H3 (additional) — `domain-sync.ts`: `rawBody` fallback removed.** The previous implementation fell back to `JSON.stringify(body)` when the raw body buffer was absent, silently degrading the HMAC to a derived string. The fallback has been removed; requests without a raw body buffer are rejected.

- **H4 (additional) — `social-leads.ts`: `agentId` verified against users table before lead ingestion.** The webhook payload's `agentId` field is now confirmed to reference an existing user before any lead creation proceeds, preventing phantom agent assignments.

### Fixed

- **P0 — Three routes were unreachable at runtime.** `domain-webhooks.ts`, `inbox-email.ts`, and `market-data.ts` existed in `apps/api/src/routes/` but were not registered in `apps/api/src/index.ts`. All three are now registered and reachable.

- **P0 — Eleven environment variables missing from `.env.example`.** Variables referenced in application code but absent from `apps/api/.env.example` have been documented with descriptions. Production deployments will no longer silently fail due to undocumented required configuration.

- **ERR-001 — Silent 500 errors in Sprint 5 and Sprint 6 route files.** All catch blocks that returned a 500 reply without logging now call `request.log.error(err)` first. Errors are now observable in structured logs without requiring a debugger.

- **ERR-002 / ERR-005 — `getById` methods no longer swallow all errors as 404.** Engine `getById` methods (`social-lead-engine.ts`, `off-market-engine.ts`, `portal-engine.ts`) now discriminate PGRST116 (row not found — returns `null`, maps to 404) from all other errors (propagates as exception, maps to 500). Genuine server errors are no longer masked as not-found responses.

- **ERR-003 — Portal app had no error boundaries.** Created `apps/portal/src/app/error.tsx` and `apps/portal/src/app/(dashboard)/error.tsx`. Unhandled rendering or data-fetching errors in the portal now render a recoverable error UI instead of a blank screen.

- **ERR-004 — Sprint 6 web route segments had no error boundaries.** Created five `error.tsx` files in `apps/web/src/app/` covering all Sprint 6 route segments. The agent-facing web app now has error recovery at all segment boundaries.

- **ERR-007 / ERR-008 — 26 `useMutation` hooks had no `onError` handler.** Added `onError` handlers to 21 web mutation hooks and 5 portal mutation hooks. API failures are now surfaced to the user interface rather than being silently swallowed.

### Added

- **`apps/mobile/src/hooks/use-team.ts` — team hooks for mobile.** Added 6 hooks to give mobile screens access to `TeamEngine` data: `useTeamMembers`, `useTeamPerformance`, `useAssignmentRules` (queries) and `useSyncTeamPerformance`, `useUpdateAssignmentRule`, `useDeleteAssignmentRule` (mutations with optimistic updates).

- **196 new tests** across `apps/api` (+136) and `@realflow/business-logic` (+65). Tests cover security fix scenarios (auth-scoping, ownership rejection, fail-closed webhook behaviour) and branch coverage gaps across error paths.

### Performance

- **CRIT-1 — N+1 query in workflow dispatch eliminated.** `apps/api/src/routes/workflows.ts` previously fetched one contact per dispatch iteration inside the workflow loop. The contact fetch has been hoisted above the loop as a single batched query.

- **CRIT-2 — N+1 query in alert price-change handler eliminated.** `packages/business-logic/src/property-alert-engine.ts` previously issued one subscription query per affected property match. Replaced with a single `.in()` query covering all subscription IDs.

- **CRIT-3 — Sequential team snapshot queries parallelised.** `packages/business-logic/src/team-engine.ts` previously issued up to 90 sequential database round-trips during a team performance snapshot cron run. Snapshot fetches are now parallelised with `Promise.all` and writes are batched into a single upsert.

- **AbortController timeouts added to 7 integration clients.** All external HTTP calls in the integration package now carry an `AbortController` signal. Requests to Meta and Twilio time out at 10 seconds; Domain.com.au at 30 seconds; Anthropic at 60 seconds. Hung external calls can no longer block API worker threads indefinitely.

- **`staleTime` set on 5 React Query hooks.** Five hooks that were running with the default `staleTime: 0` (refetch on every mount) now have explicit stale windows appropriate to their data freshness requirements, reducing unnecessary background refetches.

---

## Coverage Summary

| Package | Metric | Before | After | Target |
|---|---|---|---|---|
| `apps/api` | Branch | 56.32% | 65.24% | 65% |
| `@realflow/business-logic` | Branch | 74.79% | 80.47% | 80% |

---

## Files Changed (Summary)

### `apps/api/src/`

| File | Change Type | Reason |
|---|---|---|
| `index.ts` | Fix | Register 3 previously unreachable routes |
| `.env.example` | Fix | Document 11 missing environment variables |
| `routes/push-tokens.ts` | Security | C-1: userId from JWT, not body |
| `routes/inbox.ts` | Security | C-2, H1, H2: auth guard, agent scoping, IDOR fix, safeParse |
| `routes/workflows.ts` | Security + Perf | C-3: auth guard, derived createdBy; N+1 contact fetch batched |
| `routes/webhooks.ts` | Security | H-2: fail-closed HMAC validation |
| `routes/domain-sync.ts` | Security | H-3, H3: fail-closed HMAC; rawBody fallback removed |
| `routes/portal.ts` | Security | H-4: replace inline service role client |
| `routes/social-leads.ts` | Security | H-5, H4: mandatory secret; agentId verified |
| Sprint 5+6 route files | Fix | ERR-001: `request.log.error` before all 500 replies |

### `packages/business-logic/src/`

| File | Change Type | Reason |
|---|---|---|
| `property-alert-engine.ts` | Perf | CRIT-2: batch `.in()` replaces per-subscription queries |
| `team-engine.ts` | Perf | CRIT-3: `Promise.all` + batch upsert |
| `social-lead-engine.ts` | Fix | ERR-002/ERR-005: `getById` returns null on PGRST116 |
| `off-market-engine.ts` | Fix | ERR-002/ERR-005: `getById` returns null on PGRST116 |
| `portal-engine.ts` | Fix | ERR-002/ERR-005: `getById` returns null on PGRST116 |

### `apps/portal/src/app/`

| File | Change Type | Reason |
|---|---|---|
| `error.tsx` | Fix | ERR-003: root error boundary |
| `(dashboard)/error.tsx` | Fix | ERR-003: dashboard segment error boundary |
| Portal `useMutation` hooks (5) | Fix | ERR-008: `onError` handlers added |

### `apps/web/src/app/`

| File | Change Type | Reason |
|---|---|---|
| 5 × `error.tsx` (Sprint 6 segments) | Fix | ERR-004: segment error boundaries |
| Web `useMutation` hooks (21) | Fix | ERR-007: `onError` handlers added |

### `apps/mobile/src/hooks/`

| File | Change Type | Reason |
|---|---|---|
| `use-team.ts` | Feature | 6 team hooks for mobile — UAT PR review gap |

### Integration clients (7)

| Change | Reason |
|---|---|
| `AbortController` timeout added | Perf H-5: prevent hung external calls |

---

_Sprint 8 report generated by Technical Writer Agent — RealFlow 2026-03-11_
