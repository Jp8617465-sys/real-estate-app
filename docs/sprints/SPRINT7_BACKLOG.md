# Sprint 7 Backlog — from UAT Sweep (2026-03-09)

Generated from comprehensive UAT sweep of Sprint 6 (branch: `sprint-5`).
Full report: `docs/sprints/UAT_REPORT.md`

## Current State

| Metric        | Value                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Tests passing | **1,782** (shared: 168, ui: 5, integrations: 122, business-logic: 869, api: 502, mobile: 65, portal: 51) |
| Coverage      | BL: 88% ✅ · API: 75% ✅ · shared: 99% ✅ · integrations: 94% ✅                                         |
| API health    | 🟢 HEALTHY — `https://realflow-api.onrender.com/health` → 200, ~505ms                                    |
| PR status     | APPROVED WITH WARNINGS — 0 FAIL, 4 WARN                                                                  |
| Deploy status | CLEARED FOR STAGING · BLOCKED FOR PRODUCTION (see P0 below)                                              |

---

## P0 — Before Production Deploy (blockers)

- [ ] Add 11 missing env vars to `apps/api/.env.example`:
      `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `META_APP_ID`, `META_REDIRECT_URI`, `DOMAIN_REDIRECT_URI`, `TWILIO_TWIML_URL`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `SENDGRID_WEBHOOK_SECRET`, `MAILGUN_WEBHOOK_SECRET`
- [ ] Register 3 unregistered routes in `apps/api/src/index.ts`:
      `domain-webhooks.ts` (POST /api/webhooks/domain/_), `inbox-email.ts` (POST /api/v1/inbox/email_), `market-data.ts` (GET /api/v1/market-data/\*)

---

## P1 — Security Hardening Session

Source: `docs/harden/security-report.md`

### CRITICAL (must fix before production users)

- [ ] **C-1** `push-tokens.ts` — Read `userId` from JWT (`supabase.auth.getUser()`), not request body. Any user can hijack another agent's push notifications.
- [ ] **C-2** `inbox.ts` — Add `getUser()` + agent ID scoping to all 9 handlers. Route to send messages resolves agent via un-scoped `from('users').select('id').single()` (returns arbitrary row).
- [ ] **C-3** `workflows.ts` — Add `getUser()`, remove `createdBy` from request body. Any user can create automations attributed to another agent.

### HIGH

- [ ] **H-2** `webhooks.ts` — Make HMAC signature check mandatory (currently `if (env.DOMAIN_WEBHOOK_SECRET)` — fail-open when secret unset)
- [ ] **H-3** `domain-sync.ts` — Fix empty-string HMAC key: `process.env['DOMAIN_WEBHOOK_SECRET'] ?? ''` allows HMAC bypass
- [ ] **H-4** `portal.ts` — Replace inline `createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)` with `createSupabaseServiceClient()`
- [ ] **H-5** `social-leads.ts` — Make `META_APP_SECRET` mandatory; reject request when absent (currently logs warn and continues)

---

## P2 — Error Boundary Session

Source: `docs/harden/error-boundaries-report.md`

### CRITICAL

- [ ] **ERR-001** Add `request.log.error(err, 'handler failed')` before every 500 reply in all Sprint 5+6 routes (`social-leads`, `off-market`, `team`, `alerts`, `portal`)
- [ ] **ERR-002** In `GET /:id` handlers: check `error.code === 'PGRST116'` → 404; all other errors → 500 (currently all errors return 404)
- [ ] **ERR-003** Create `apps/portal/src/app/error.tsx` and `apps/portal/src/app/(dashboard)/error.tsx` (portal has zero error boundaries)
- [ ] **ERR-004** Create `error.tsx` in: `apps/web/src/app/social/leads/`, `buyers-agent/off-market/`, `team/`, `alerts/`, `social/analytics/`
- [ ] **ERR-005** Update new engine `getById` methods to return `null` on PGRST116 instead of throwing

### HIGH

- [ ] **ERR-006** Add `AbortController` signal + timeout to all `fetch()` calls in integration clients: 10s for Meta/Twilio, 30s for Domain, 60s for Anthropic
- [ ] **ERR-007** Add `onError` handler to 21 web `useMutation` hooks (currently only `onSuccess`)
- [ ] **ERR-008** Add `onError` handler to 5 portal `useMutation` hooks (`useUploadDocument`, `useDownloadDocument`, `useSendMessage`)
- [ ] **ERR-009** Add `isError` state handling to all mobile screens (show retry affordance instead of blank list)

---

## P3 — Performance Session

Source: `docs/harden/perf-report.md`

### CRITICAL N+1s

- [ ] **CRIT-1** `workflows.ts` dispatch — Contact fetch inside per-workflow loop. Move `from('contacts').select()` above loop, reuse result.
- [ ] **CRIT-2** `property-alert-engine.ts` `handlePriceChange` — `property_alert_subscriptions` query inside per-match loop. Collect all `brief_id` values, fetch in single `.in()` call.
- [ ] **CRIT-3** `team-engine.ts` `snapshotTeamPerformance` — 5 sequential count queries per agent. Wrap in `Promise.all`, batch upsert in single call.

### HIGH

- [ ] **H-1** `contacts.ts` POST — Full table scan for deduplication. Push similarity check to PostgreSQL (`pg_trgm`).
- [ ] **H-4** Add `staleTime: 30_000` to `useContacts`, `usePipeline`, `usePortalDashboard`, `usePortalProperties`; `staleTime: 60_000` to `useProperties` and dashboard stats.
- [ ] **H-5** AbortController on all integration client `fetch()` calls (shared with ERR-006 above).

---

## P4 — Mobile Completeness

- [ ] Create `apps/mobile/src/hooks/use-team.ts` with `useTeamMembers`, `useTeamPerformance`, `useAssignmentRules`
- [ ] Add `onMutate` + `onError` + `onSettled` to Sprint 6 web mutations: `leads-client.tsx`, `off-market-client.tsx`, `assignment-rules-client.tsx`, `templates-client.tsx`
- [ ] Add `deleted_at TIMESTAMPTZ` to `team_performance_snapshots` via follow-on migration (or document intentional omission)

---

## P5 — Coverage Improvement

- [ ] Improve `apps/api` branch coverage: 55.96% → 65%+ (add error-variant tests to high-risk routes)
- [ ] Improve `packages/business-logic` branch coverage: 74.94% → 80%+ (scoring logic edge cases)

---

## PR Review WARN Items

From `docs/sprints/PR_REVIEW_SPRINT6.md`:

- **WARN-3** `team_performance_snapshots` missing `deleted_at` — add migration or document intentional
- **WARN-4** `domain-webhooks.ts`, `inbox-email.ts`, `market-data.ts` not in `index.ts` (runtime inaccessible) — covered in P0

---

## Harden Reports Index

| Report           | Location                                 | Status                 |
| ---------------- | ---------------------------------------- | ---------------------- |
| Security         | `docs/harden/security-report.md`         | 3C/5H/6M/5L            |
| Performance      | `docs/harden/perf-report.md`             | 3C/5H/6M/4L            |
| Error Boundaries | `docs/harden/error-boundaries-report.md` | 5C/4H/5M/2L            |
| Coverage         | `docs/harden/coverage-report.md`         | All targets met        |
| Known Issues     | `docs/harden/known-failures.md`          | Full catalogue         |
| PR Review        | `docs/sprints/PR_REVIEW_SPRINT6.md`      | Approved with warnings |
| Deploy Check     | `docs/sprints/DEPLOY_CHECK_SPRINT6.md`   | Staging cleared        |
