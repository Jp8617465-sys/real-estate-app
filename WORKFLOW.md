# WORKFLOW.md — RealFlow Development Lifecycle

> The operating manual for how features move from idea to production. Read alongside `CLAUDE.md` (coding standards) and `STRATEGIC_ROADMAP.md` (priorities).

---

## Overview

Every feature and sprint moves through 10 phases in sequence. Human sign-off is required at phase transitions marked **🔐 human gate**. Automated gates are marked **⚡ automated**.

```
DISCOVER → PLAN → BUILD → TEST → QUALITY → HARDEN → DOCUMENT → DEPLOY → MONITOR → FINISH
   🔐        🔐      ⚡       ⚡       ⚡         ⚡          ⚡         ⚡          ⚡       🔐
```

The `/ship` command runs phases 5–8 (QUALITY → HARDEN → DOCUMENT → DEPLOY) automatically.
The `/sprint-start` and `/sprint-close` commands manage phases 1–2 and 10 respectively.

---

## Phase Reference

| # | Phase | Trigger | Primary Commands | Exit Criteria |
|---|-------|---------|-----------------|---------------|
| 1 | **DISCOVER** | New feature or sprint kickoff | `/discover`, `/user-stories` | `docs/discovery/FEATURE.md` signed off |
| 2 | **PLAN** | Discovery doc exists | `/sprint-plan`, `/db-design`, `/api-design`, `/architect` | Migration SQL + API surface agreed |
| 3 | **BUILD** | Plan + interface contracts exist | `/build-db`, `/build-engine`, `/build-mobile`, `/api-new`, `/component-new` | All routes return non-500, types generated |
| 4 | **TEST** | BUILD complete | `/test-unit`, `/test-integration`, `/test-coverage`, `/test-mobile`, `/api-test` | 0 new test failures, engine at 80%+ coverage |
| 5 | **QUALITY** | TEST passing | `/quality-check`, `/pr-review`, `/lint`, `/code-cleanup` | All gates green, PR review PASS |
| 6 | **HARDEN** | QUALITY green | `/harden`, `/security-scan`, `/perf-audit`, `/error-boundaries` | 0 CRITICAL findings, all error paths handled |
| 7 | **DOCUMENT** | HARDEN complete | `/api-docs`, `/changelog`, `/sprint-report`, `/docs-generate` | API docs updated, CHANGELOG entry written |
| 8 | **DEPLOY** | DOCUMENT complete | `/deploy-check`, `/deploy-staging`, `/deploy-production`, `/smoke-test` | Smoke tests pass on staging + production |
| 9 | **MONITOR** | 24–48h post deploy | `/health-check`, `/error-triage` | No CRITICAL errors for 24h, service live |
| 10 | **FINISH** | MONITOR clean | `/sprint-close` | MEMORY.md updated, sprint tagged, retrospective done |

---

## Quality Gates

| Gate | Command | Blocks Deploy? | Runs During |
|------|---------|---------------|-------------|
| ESLint (no-any:error) | `npm run lint` | Yes | QUALITY, pre-commit, CI |
| TypeScript strict | `npm run type-check` | Yes | QUALITY, pre-commit, CI |
| Prettier format | `npx prettier --check .` | No | QUALITY |
| Test suite | `npm run test` | Yes | TEST, pre-commit, CI |
| Full quality bundle | `npm run quality` | Yes | QUALITY (runs lint + type-check) |
| Test coverage | `npm run test:coverage` | No (reports only) | TEST |
| Security scan | `/security-scan` | Yes (CRITICAL) | HARDEN |
| Perf audit | `/perf-audit` | No (reports N+1s) | HARDEN |
| Full build | `npm run build` | Yes | DEPLOY |
| Smoke tests | `/smoke-test $URL` | Yes | DEPLOY (staging + prod) |
| Render health | `mcp__render__get_service` | No (monitoring) | MONITOR |

---

## The `/ship` Command

`/ship $FEATURE` runs everything from QUALITY to DEPLOY in a single orchestrated sequence:

```
/quality-check  →  /test-coverage  →  /security-scan  →  /perf-audit
     →  /api-docs  →  /changelog  →  /deploy-check  →  /deploy-staging
     →  /smoke-test staging-url
```

Stops immediately on any CRITICAL failure. On success, outputs:
> "Feature `$FEATURE` is ready for production. Run `/deploy-production` to complete."

**Deliberately excludes:** DISCOVER + PLAN (human-gated). MONITOR + FINISH (time-deferred — run 24–48h later).

Production deploy is a **separate explicit command** (`/deploy-production`) — never automated by `/ship`. This is intentional: production promotion requires a conscious human decision after reviewing staging results.

---

## Sprint Lifecycle

```
/sprint-start                          /sprint-close
     │                                       │
     ├─ Read MEMORY.md (current sprint)      ├─ Verify all features deployed
     ├─ Read STRATEGIC_ROADMAP.md            ├─ Run npm run test (final count)
     ├─ Check docs/discovery/ exists         ├─ Generate /sprint-report
     ├─ Run /sprint-plan                     ├─ Produce MEMORY.md update block
     ├─ Output interface contracts           ├─ Produce STRATEGIC_ROADMAP.md update
     └─ Record test baseline                 ├─ Output retrospective prompts
                                             └─ Output git tag command
```

**Current sprint:** Sprint 5 (Client Experience) is next. Sprints 1–4 complete.

Branch convention: `sprint/sprint-N` for sprint branches, `feature/NAME` for feature branches.

---

## Pre-Commit Hook

Located at `.husky/pre-commit`. Runs on every `git commit`:

1. `npm run lint` — ESLint 9 (no-any:error blocks commit)
2. `npm run type-check` — TypeScript strict (any error blocks commit)
3. `npm run test` — Vitest (any failure blocks commit)

**Escape hatch:** `git commit --no-verify` is acceptable ONLY for WIP commits on feature branches that will never be merged directly to `main`. Merging to `main` always goes through CI which has no escape hatch.

---

## Agent Reference

| Agent | When to Invoke | Produces |
|-------|---------------|----------|
| `@requirements-analyst` | DISCOVER phase, ambiguous specs | PRD, user stories, acceptance criteria |
| `@system-architect` | PLAN phase, cross-package design | Architecture doc, dependency graph |
| `@backend-architect` | PLAN + BUILD, engine + route design | DB schema, engine design, route shapes |
| `@frontend-architect` | PLAN + BUILD, component design | Component hierarchy, state management plan |
| `@qa-engineer` | TEST phase, coverage analysis | Test strategy, missing test cases |
| `@security-engineer` | HARDEN phase | Security audit, OWASP findings |
| `@performance-engineer` | HARDEN phase | Perf audit, N+1 queries, bundle analysis |
| `@technical-writer` | DOCUMENT phase | API docs, user guides |
| `@devops-engineer` | DEPLOY phase, CI/CD | Render deploy, GitHub Actions config |
| `@sprint-manager` | Sprint lifecycle | Sprint plan, MEMORY.md updates |
| `@refactoring-expert` | QUALITY phase | Code quality review, tech debt |
| `@deep-research-agent` | DISCOVER, research tasks | Research synthesis, competitor analysis |
| `@tech-stack-researcher` | PLAN, new technology decisions | Technology evaluation report |
| `@learning-guide` | Anytime, teaching/explanation | Concept explanations, code walkthroughs |

---

## Command Reference

### DISCOVER
| Command | Description |
|---------|-------------|
| `/discover $FEATURE` | Full discovery session → `docs/discovery/FEATURE.md` |
| `/user-stories $FEATURE` | Generate user story map in buyers-agent context |

### PLAN
| Command | Description |
|---------|-------------|
| `/sprint-plan $N: features` | Generate `SPRINT_N_PLAN.md` (parallel teams, interface contracts) |
| `/db-design $FEATURE` | Migration SQL + Zod schema stubs |
| `/api-design $FEATURE` | API surface document (interface contract) |
| `/architect $FEATURE` | Systems architecture review |
| `/backend-architect $FEATURE` | Backend design review |
| `/feature-plan $FEATURE` | Full feature implementation plan |
| `/workflow-design $FEATURE` | Automation workflow design |

### BUILD
| Command | Description |
|---------|-------------|
| `/build-db $FEATURE` | Guide DB build: migrate → types → RLS checklist |
| `/build-engine $ENGINE` | Scaffold business-logic engine + test file |
| `/build-mobile $FEATURE` | Scaffold Expo Router screens |
| `/api-new $ROUTE` | Generate Fastify route with validation |
| `/component-new $SPEC` | Generate React component |
| `/page-new $SPEC` | Generate Next.js page |
| `/supabase:types-gen` | Regenerate TypeScript types from schema |

### TEST
| Command | Description |
|---------|-------------|
| `/test-unit $FILE` | Generate Vitest unit tests (encodes 4 MEMORY.md rules) |
| `/test-integration $FEATURE` | Generate integration tests (route → engine → DB) |
| `/test-coverage` | Run coverage, check vs baseline (606/616), report gaps |
| `/test-mobile $SCREEN` | Generate React Native component tests |
| `/api-test $ROUTE` | Generate API endpoint tests |
| `/test-review $MODULE` | Review existing test quality and coverage |

### QUALITY
| Command | Description |
|---------|-------------|
| `/quality-check` | Run all quality gates: lint → type-check → prettier → secret scan |
| `/pr-review $BRANCH` | Structured review against 8 RealFlow criteria |
| `/lint` | ESLint + Prettier fix |
| `/code-cleanup $FILE` | Refactor and clean up |
| `/code-optimize $FILE` | Performance optimisation |

### HARDEN
| Command | Description |
|---------|-------------|
| `/harden $SPRINT` | Orchestrate security-scan + perf-audit + error-boundaries |
| `/security-scan` | OWASP Top 10, RLS policies, Zod coverage, secrets hygiene |
| `/perf-audit` | N+1 queries, bundle size, re-renders, <200ms target |
| `/error-boundaries` | Audit and generate missing error handling |

### DOCUMENT
| Command | Description |
|---------|-------------|
| `/api-docs $FEATURE` | Generate `docs/api/FEATURE.md` |
| `/changelog $SPRINT` | Write Keep-a-Changelog entry from git log |
| `/sprint-report $N` | Generate `docs/sprints/SPRINT_N_REPORT.md` |
| `/docs-generate $FILE` | Generate JSDoc/TSDoc |

### DEPLOY
| Command | Description |
|---------|-------------|
| `/deploy-check` | Pre-deploy checklist (build, migrations, env vars, health) |
| `/deploy-staging` | Deploy to staging via Render MCP + smoke test |
| `/deploy-production` | Deploy to production (explicit human invocation only) |
| `/smoke-test $URL` | 5 smoke tests: health, auth, 401 gate, DB query, Realtime |

### MONITOR
| Command | Description |
|---------|-------------|
| `/health-check` | Check Render service status + error patterns |
| `/error-triage $ERROR` | Structured error root-cause analysis |

### SPRINT LIFECYCLE
| Command | Description |
|---------|-------------|
| `/sprint-start` | Kickoff: roadmap → discovery → plan → branch → baseline |
| `/sprint-close` | Close: verify → report → MEMORY.md → tag → retro |

### META
| Command | Description |
|---------|-------------|
| `/ship $FEATURE` | QUALITY → HARDEN → DOCUMENT → DEPLOY chain |

---

## Conventions

### Migration Naming
- Format: `000XX_description.sql` where XX is zero-padded sequential number
- **Anti-pattern:** Two files MUST NOT share the same prefix (the `00009_` duplicate in Sprint 3 must never recur)
- Always review `supabase/migrations/` before numbering a new file

### Test Fixtures
- UUID fields: use `crypto.randomUUID()` or a proper UUID string (e.g. `'00000000-0000-0000-0000-000000000001'`)
- **NEVER** use shorthand strings like `'contact-1'` or `'check-1'` — Zod uuid() validation will throw
- `vi.mock()` factories cannot reference top-level `const` vars — use `vi.hoisted()` for shared mocks
- Arrow function mocks cannot be used as class constructors — use dependency injection instead
- When Supabase chain terminates at `.select()` (no chaining after), use `mockResolvedValue`, not `mockReturnThis`

### Commit Messages
Conventional commits required: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`

### Branch Names
- Feature: `feature/descriptive-name`
- Sprint: `sprint/sprint-N`
- Chore/infra: `chore/descriptive-name`
- Fix: `fix/descriptive-name`

### Soft Deletes
**Never hard delete.** All tables use `deleted_at TIMESTAMPTZ` for soft deletes. Queries must filter `WHERE deleted_at IS NULL`.

### Zod Schemas
Define in `packages/shared/src/types/` — never duplicate across apps. Export from the relevant `index.ts`.

---

## CI/CD Pipeline

```
Push to any branch → ci.yml
  ├─ npm ci
  ├─ npm run build
  ├─ npm run lint
  ├─ npm run type-check
  └─ npm run test

Push to staging branch → deploy-staging.yml
  ├─ CI gates (above)
  ├─ npm run db:migrate (staging Supabase)
  ├─ Render deploy (staging service)
  └─ /smoke-test staging-url

Push to main → deploy-production.yml
  ├─ CI gates
  ├─ Manual approval gate (GitHub environment protection)
  ├─ npm run db:migrate (production Supabase)
  ├─ Render deploy (production service)
  ├─ /smoke-test production-url
  └─ GitHub release (with changelog entry)
```

---

## Glossary

### Australian Real Estate Terms
- **Buyers agent** — agent who acts exclusively for the buyer, not the vendor
- **Vendor** — seller of a property (AU term for seller)
- **Due diligence** — pre-purchase inspection, searches, and legal review (state-specific)
- **Section 32 / Vendor Statement** — Victorian legal disclosure document
- **Contract of Sale** — binding purchase agreement (varies by state)
- **AUSTRAC** — Australian Transaction Reports and Analysis Centre (AML regulator)
- **100-point ID check** — AU identity verification standard (passport = 70 pts, driver licence = 40 pts, etc.)
- **AML/KYC** — Anti-Money Laundering / Know Your Customer (required for licensed agents)
- **REA** — realestate.com.au (Australia's largest property portal)
- **Domain** — domain.com.au (second-largest portal, our v1 data source)

### RealFlow Terms
- **Client brief** — structured 60+ field requirements document for a buyers agent engagement
- **Property match** — AI-scored comparison of a listing against a client brief
- **Buyer pipeline** — 8-stage workflow: Lead → Qualified → Brief → Searching → Shortlisted → Offer → Exchange → Settlement
- **Seller pipeline** — 6-stage workflow: Appraisal → Listed → Under Offer → Exchanged → Settlement → Settled
- **Sprint baseline** — test count at sprint start (currently 606/616 passing)
- **Hard gate** — quality check that blocks the next phase on failure
- **Soft gate** — quality check that reports findings but does not block

---

*Last updated: Sprint 4 complete (2026-03-02). Sprint 5 (Client Experience) is next.*
