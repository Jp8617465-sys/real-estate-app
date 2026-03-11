# Sprint State — RealFlow PM Brain

> The heartbeat of the PM brain. Claude reads this at every session start.
> Updated after every significant state change. Human-readable — spot-check any time.
> Last updated: 2026-03-10

---

## Current Sprint

**Sprint:** 8 — Hardening & Production Readiness
**Goal:** Fix all CRITICAL security/perf/error-boundary findings from UAT, clear P0 blockers, merge PR #38 to main, deploy to production
**Start:** 2026-03-09
**Target End:** 2026-03-16 (7 days)
**Branch:** `sprint-5` (PR #38 open against `main`)
**CI Status:** green (as of 2026-03-11)
**Test Baseline:** 1,782 passing → **1,978 passing after Sprint 8 COMPLETE** (shared: 168, ui: 5, integrations: 122, business-logic: 934, api: 638, mobile: 65, portal: 51)

---

## Feature Lifecycle

Phases: BACKLOG → DISCOVER → PLAN_APPROVED → BUILD → TEST → QUALITY → HARDEN → STAGED → PRODUCTION

| ID  | Feature                                              | Phase    | Status   | Depends On | Est. Days | Actual Days | PR  | Notes                                            |
| --- | ---------------------------------------------------- | -------- | -------- | ---------- | --------- | ----------- | --- | ------------------------------------------------ |
| 8.1 | P0 Blockers (env vars + route registration)          | QUALITY  | ✅ DONE   | —          | 0.5       | 0.5         | #38 | 11 env vars + 3 routes registered                |
| 8.2 | Security Hardening (C-1/C-2/C-3 + H-2/H-3/H-4/H-5) | QUALITY  | ✅ DONE   | 8.1        | 1-2       | 1           | #38 | All 7 findings fixed, tests updated              |
| 8.3 | Error Boundary Hardening (ERR-001 through ERR-009)   | QUALITY  | ✅ DONE   | —          | 1-2       | 1           | #38 | error.tsx files, getById null, onError hooks     |
| 8.4 | Performance Hardening (CRIT-1/CRIT-2/CRIT-3)         | QUALITY  | ✅ DONE   | —          | 1         | 1           | #38 | 3 N+1 fixed, AbortController on 7 clients       |
| 8.5 | Mobile Completeness (use-team hook + mutations)      | QUALITY  | ✅ DONE   | —          | 0.5       | 0.25        | #38 | use-team.ts with 6 hooks created                 |
| 8.6 | Coverage Improvement (API branch → 65%, BL → 80%)   | QUALITY  | ✅ DONE   | 8.2, 8.3   | 1         | 1           | #38 | API: 65.24%, BL: 80.47% — both targets met       |
| 8.7 | Production Deploy                                    | DEPLOY   | pending  | 8.1-8.6    | 0.5       | —           | —   | Merge PR #38, deploy, smoke test                 |

### Feature Details

#### 8.1 — P0 Blockers

Key files:

- `apps/api/.env.example` — add 11 missing env vars
- `apps/api/src/index.ts` — register `domain-webhooks.ts`, `inbox-email.ts`, `market-data.ts`

Acceptance: All routes accessible, env.example complete.

#### 8.2 — Security Hardening

Key files:

- `apps/api/src/routes/push-tokens.ts` — read userId from JWT not body
- `apps/api/src/routes/inbox.ts` — add getUser() + agent scoping to 9 handlers
- `apps/api/src/routes/workflows.ts` — add getUser(), remove createdBy from body
- `apps/api/src/routes/webhooks.ts` — make HMAC mandatory (fail-closed)
- `apps/api/src/routes/domain-sync.ts` — fix empty-string HMAC bypass
- `apps/api/src/routes/portal.ts` — replace inline service role client
- `apps/api/src/routes/social-leads.ts` — make META_APP_SECRET mandatory

Acceptance: All auth from JWT. No fail-open webhook signatures. No inline service role clients.

#### 8.3 — Error Boundary Hardening

Key files:

- All Sprint 5+6 route files — add `request.log.error` before 500 replies
- `apps/portal/src/app/error.tsx` + `(dashboard)/error.tsx` — create
- `apps/web/src/app/` — 5 new error.tsx files for Sprint 6 segments
- 21 web + 5 portal `useMutation` hooks — add `onError`
- New engine `getById` methods — return null on PGRST116

Acceptance: No silent 500s. All app segments have error boundaries. All mutations handle errors.

#### 8.4 — Performance Hardening

Key files:

- `apps/api/src/routes/workflows.ts` — batch contact fetch above loop
- `packages/business-logic/src/property-alert-engine.ts` — single .in() call
- `packages/business-logic/src/team-engine.ts` — Promise.all for snapshots
- All integration clients — AbortController with timeouts

Acceptance: 0 N+1 queries in hot paths. All external fetches have timeouts.

---

## Last Session Handoff

> Updated at end of each session. Provides enough context to resume without re-reading code.

**Date:** 2026-03-11
**Working on:** Sprint 8 — all phases complete (8.1–8.6). Docs generated. Deploy is next human gate.
**Status:** 8.1–8.6 all DONE. Tests: 1,978 passing (was 1,782 — +196). API: 638 (+136), BL: 934 (+65). API branch: 65.24%, BL branch: 80.47%. All quality gates green. Docs written.
Additional fixes beyond original scope:
- H1: inbox.ts `.parse()` → `.safeParse()`
- H2: inbox.ts GET /contacts/:contactId/channels IDOR fix (agent ownership check)
- H3: domain-sync.ts rawBody fallback removed (HMAC integrity)
- H4: social-leads.ts agentId verified against users table
Docs generated: `docs/sprints/SPRINT_8_REPORT.md`, `docs/sprints/CHANGELOG_SPRINT_8.md`
**Decisions:** getById returns null on PGRST116 (not throws). Push token userId from JWT. Webhooks fail-closed. RawBody fallback removed. AgentId verified server-side.
**Next session:**
1. PR #38 merge (human gate)
2. `/deploy-staging` → smoke test → `/deploy-production` (human gate)
**Open questions:** None. Sprint 8 code complete. Awaiting human approval to merge and deploy.

---

## Risks

| Risk                                           | Likelihood | Impact | Mitigation                                                   |
| ---------------------------------------------- | ---------- | ------ | ------------------------------------------------------------ |
| Security fixes break existing tests            | Medium     | Medium | Run full test suite after each fix; 1,782 baseline must hold |
| Route registration (P0) reveals runtime errors | Low        | Medium | Routes already have tests; registration is wiring only       |
| N+1 fixes change query behavior                | Medium     | Low    | Existing test coverage catches regressions                   |

---

## Ops Backlog

These are not sprint tasks but should be resolved when convenient:

| ID  | Item                                        | Affects          | Status                                                |
| --- | ------------------------------------------- | ---------------- | ----------------------------------------------------- |
| O-1 | Auction date cron alerts (deferred from S5) | Property alerts  | Deferred — schema/types done, cron wiring outstanding |
| O-2 | E2E tests (Playwright)                      | Confidence       | Not started                                           |
| O-3 | Sentry/LogRocket monitoring                 | Error visibility | Not started                                           |
| O-4 | Redis-backed rate limiters                  | API security     | Not started                                           |
| O-5 | Admin role checks                           | Multi-tenancy    | Not started                                           |
| O-6 | Full ESM migration                          | Build perf       | Not started                                           |
| O-7 | deploy-api.yml references Railway (stale)   | CI/CD            | Should be removed or updated to Render                |

---

## Human Gates Pending

- [ ] **Production deploy** — Always explicit; never automatic
- [ ] **PR #38 merge** — All P0+P1 items must be resolved first

---

## Sprint Metrics

| Metric                   | Current | Target                  | Delta     |
| ------------------------ | ------- | ----------------------- | --------- |
| Tests passing            | 1,978   | 1,782+ (no regressions) | +196 ✅   |
| API branch coverage      | 65.24%  | 65%+                    | +8.92% ✅ |
| BL branch coverage       | 80.47%  | 80%+                    | +5.68% ✅ |
| Security CRITICALs       | 0       | 0                       | ✅         |
| Security HIGHs           | 0       | 0                       | ✅         |
| Perf CRITICALs           | 0       | 0                       | ✅         |
| Error boundary CRITICALs | 0       | 0                       | ✅         |
| P0 blockers              | 0       | 0                       | ✅         |
| CI status                | green   | green                   | ✅         |

---

## Velocity History

| Sprint | Features Planned          | Delivered | Sprint Days | Notes                           |
| ------ | ------------------------- | --------- | ----------- | ------------------------------- |
| 1      | AI Foundation             | All       | ~7          | Baseline sprint                 |
| 2      | Smart Communication       | All       | ~7          | 145/145 api, 66/66 integrations |
| 3      | Automation & Intelligence | All       | ~7          | Migrations 00009-00012          |
| 4      | Data & Integration        | All       | ~7          | 189/189 api, 488/488 BL         |
| 5      | Client Portal + Alerts    | All       | ~7          | First production deploy         |
| 6      | Growth & Scale            | All       | ~7          | Social, off-market, team        |
| 7      | Frontend Modernisation    | All       | ~3          | Dark mode, DnD, skeletons       |
| 8      | Hardening                 | —         | 7 (target)  | First tracked sprint            |

---

## Previous Sprint Summary

| Sprint | Goal                      | Outcome                                                     |
| ------ | ------------------------- | ----------------------------------------------------------- |
| 1      | AI Foundation             | SHIPPED — AnthropicClient, AI routes, AI types              |
| 2      | Smart Communication       | SHIPPED — 145 api tests, 66 integration tests               |
| 3      | Automation & Intelligence | SHIPPED — Workflow engine, migrations 00009-00012           |
| 4      | Data & Integration        | SHIPPED — Domain sync, analytics, AML, market data          |
| 5      | Client Portal + Alerts    | SHIPPED — Portal engine, alert engine, first prod deploy    |
| 6      | Growth & Scale            | CODE COMPLETE — Social leads, off-market, team (PR #38)     |
| 7      | Frontend Modernisation    | CODE COMPLETE — Dark mode, DnD, skeletons, haptics (PR #38) |
