# Sprint State — RealFlow PM Brain

> The heartbeat of the PM brain. Claude reads this at every session start.
> Updated after every significant state change. Human-readable — spot-check any time.
> Last updated: 2026-04-23

---

## Current Sprint

**Sprint:** 9 — Ship & Surface
**Goal:** Get RealFlow to production for the first time. Surface the AI assistant in the web app. Close the gap between backend capability and frontend experience.
**Start:** 2026-04-23
**Target End:** 2026-04-30 (7 days)
**Branch:** `claude/review-project-plan-FJeCD`
**CI Status:** green (Evolution Weeks 1-5 merged as PR #42 on 2026-03-21)
**Test Baseline:** 1,978 passing (shared: 168, ui: 5, integrations: 122, business-logic: 934, api: 638, mobile: 65, portal: 51)

---

## What Was Built — Evolution Weeks 1-5 (2026-03-11 → 2026-03-21)

These features were built and merged (PR #42) outside the sprint framework. Captured here for the record.

| ID   | Feature                          | Branch                        | Merged   | Notes                                                              |
| ---- | -------------------------------- | ----------------------------- | -------- | ------------------------------------------------------------------ |
| EV-1 | Product Split (BA / Selling)     | evolution/week-1              | PR #42   | Build-time gating via NEXT_PUBLIC_PRODUCT_MODE, product guard plugin |
| EV-2 | Dynamic Sidebar & Route Gating   | evolution/week-2              | PR #42   | Middleware, product access hook/provider, sidebar nav              |
| EV-3 | BA/Selling Build Variants        | evolution/week-3              | PR #42   | `npm run build:ba`, `build:selling`, `build:full`; Vercel guide    |
| EV-4 | Stripe Subscriptions             | evolution/week-4              | PR #42   | Subscription tiers, limits, Stripe service, API routes, migration 00025 |
| EV-5 | AI Assistant (tool-calling + SSE)| evolution/week-5              | PR #42   | AnthropicClient with `chat()`/`streamChat()`, AssistantService, 10 CRM tools, migration 00026, auth page rewrite |

---

## Feature Lifecycle

Phases: BACKLOG → DISCOVER → PLAN_APPROVED → BUILD → TEST → QUALITY → HARDEN → STAGED → PRODUCTION

| ID  | Feature                             | Phase    | Status    | Depends On | Est. Days | Notes                                                        |
| --- | ----------------------------------- | -------- | --------- | ---------- | --------- | ------------------------------------------------------------ |
| 9.1 | Production Deployment               | BUILD    | pending   | —          | 1         | Env var audit, Render deploy, smoke test                     |
| 9.2 | AI Assistant Frontend               | BACKLOG  | pending   | 9.1        | 2         | `useAssistant` hook, SSE streaming UI, command palette or panel |
| 9.3 | Frontend Polish MVP                 | BACKLOG  | pending   | 9.1        | 2         | Pipeline DnD, entrance animations on 3 screens, dark mode toggle |
| 9.4 | Production Monitoring               | BACKLOG  | pending   | 9.1        | 0.5       | Sentry setup (ops O-3), health endpoint wiring               |
| 9.5 | MEMORY.md + ROADMAP.md              | QUALITY  | ✅ DONE    | —          | 0.25      | Created 2026-04-23                                           |

---

## Last Session Handoff

> Updated at end of each session. Provides enough context to resume without re-reading code.

**Date:** 2026-04-23
**Working on:** Sprint 9 kickoff — strategic review, re-grounding after Evolution Weeks.
**Status:**
- Evolution Weeks 1-5 (PR #42) merged 2026-03-21. Codebase is ahead of SPRINT_STATE.md.
- SPRINT_STATE.md updated to Sprint 9 (this session).
- MEMORY.md created (was missing).
- ROADMAP.md created (was missing).
- SPRINT_9_PLAN.md created with full backlog.
- Next session: Begin 9.1 (Production Deployment) — audit env vars, trigger Render staging deploy.

**Decisions:**
- Sprint 9 theme is "Ship & Surface" — deploy first, then surface AI assistant, then frontend polish.
- Nothing else ships before production is live. All other work is theoretical until then.
- MEMORY.md is the stable knowledge base; SPRINT_STATE.md is the session state.

**Next session:**
1. Run env var audit (cross-reference `apps/api/.env.example` against Render env vars)
2. Confirm Render service `srv-d6logk450q8c73a884pg` is active
3. `npm run build` to verify clean build
4. `/deploy-staging` → smoke test → request human gate for `/deploy-production`

**Open questions:**
- Are the 11 env vars from DEPLOY_CHECK_SPRINT6 still missing, or were they added to Render?
- Is the Stripe live key configured, or only test key?
- Which subscription tier limits need to be enforced on API routes before going live?

---

## Risks

| Risk                                    | Likelihood | Impact | Mitigation                                                       |
| --------------------------------------- | ---------- | ------ | ---------------------------------------------------------------- |
| Env vars still missing in Render        | High       | High   | Audit first; do not deploy until all required vars are confirmed |
| Stripe not configured for live mode     | Medium     | Medium | Start with test mode; don't enable live billing until validated  |
| SSE streaming breaks in Next.js App Router | Medium  | Medium | Test against local API before building assistant UI              |
| Migration gaps (00012/00013 warning)    | Low        | Low    | Check Supabase migration history before staging deploy           |

---

## Ops Backlog

| ID  | Item                                        | Affects          | Status                                                      |
| --- | ------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| O-1 | Auction date cron alerts (deferred from S5) | Property alerts  | Deferred — schema/types done, cron wiring outstanding       |
| O-2 | E2E tests (Playwright)                      | Confidence       | Not started                                                 |
| O-3 | Sentry/LogRocket monitoring                 | Error visibility | Sprint 9.4 — after deploy                                   |
| O-4 | Redis-backed rate limiters                  | API security     | Not started                                                 |
| O-5 | Admin role checks                           | Multi-tenancy    | Not started                                                 |
| O-6 | Full ESM migration                          | Build perf       | Not started                                                 |
| O-7 | deploy-api.yml references Railway (stale)   | CI/CD            | Should be updated to Render or removed                      |

---

## Human Gates Pending

- [ ] **Staging deploy approval** — Run `/deploy-staging`, review smoke test results
- [ ] **Production deploy** — Always explicit; never automatic

---

## Sprint Metrics

| Metric                   | Current | Target              | Delta     |
| ------------------------ | ------- | ------------------- | --------- |
| Tests passing            | 1,978   | 1,978+ (no regressions) | — ✅  |
| API branch coverage      | 65.24%  | 65%+                | ✅         |
| BL branch coverage       | 80.47%  | 80%+                | ✅         |
| Security CRITICALs       | 0       | 0                   | ✅         |
| Perf CRITICALs           | 0       | 0                   | ✅         |
| Error boundary CRITICALs | 0       | 0                   | ✅         |
| P0 blockers              | 0       | 0                   | ✅         |
| CI status                | green   | green               | ✅         |
| Production deployed      | ❌ No   | Yes                 | 🔴 BLOCKER |

---

## Velocity History

| Sprint | Theme                     | Delivered | Notes                                         |
| ------ | ------------------------- | --------- | --------------------------------------------- |
| 1      | AI Foundation             | All       | AnthropicClient, AI routes, types             |
| 2      | Smart Communication       | All       | 145 api tests, 66 integration tests           |
| 3      | Automation & Intelligence | All       | Workflow engine, migrations 00009-00012       |
| 4      | Data & Integration        | All       | Domain sync, analytics, AML, market data      |
| 5      | Client Portal + Alerts    | All       | Portal engine, alert engine                   |
| 6      | Growth & Scale            | All       | Social leads, off-market, team                |
| 7      | Frontend Modernisation    | All       | Dark mode, DnD, skeletons, haptics (PR #38)   |
| 8      | Hardening                 | All       | 1,978 tests, 65% API cov, 80% BL cov, 0 CRITs |
| EV1-5  | Evolution (unplanned)     | All       | Product split, Stripe, AI assistant           |
| 9      | Ship & Surface            | —         | In progress                                   |
