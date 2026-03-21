# WORKFLOW.md — RealFlow Development Lifecycle

> The operating manual for how features move from idea to production.
> Read alongside `CLAUDE.md` (coding standards + command reference) and `docs/pm/SPRINT_STATE.md` (current sprint state).
> Last updated: 2026-03-09 (Sprint 8 — Hardening)

---

## Core Principle: Automate Until Gate

Claude chains phases automatically between human gates. No "shall I proceed?" prompts — just do the work. Stop only when:

1. A **human gate** (🔐) is reached
2. A **CRITICAL failure** is found
3. The phase sequence is complete

```
DISCOVER → PLAN → BUILD → TEST → QUALITY → HARDEN → DOCUMENT → DEPLOY → MONITOR → FINISH
   🔐        🔐      ⚡       ⚡       ⚡         ⚡          ⚡         🔐          ⚡       🔐
```

**Automation flow:** After PLAN is approved, Claude auto-runs BUILD → TEST → QUALITY → HARDEN → DOCUMENT without stopping. DEPLOY (staging) runs automatically; DEPLOY (production) requires explicit human command.

---

## Phase 1 — DISCOVER 🔐

**Entry:** New feature request or sprint kickoff.
**Exit:** `docs/discovery/$FEATURE.md` signed off by human.

### `/discover $FEATURE`

Agent: `requirements-analyst`

Produces `docs/discovery/$FEATURE.md` containing:

- User problem statement and goals
- User journey map (happy path + edge cases)
- Acceptance criteria (Given/When/Then)
- Risks and open questions

### `/user-stories $FEATURE`

Agent: `requirements-analyst`

Generates story map with persona, goal, acceptance criteria, priority.

**🔐 GATE:** Human reviews discovery doc. Do not proceed to PLAN until approved.

---

## Phase 2 — PLAN 🔐

**Entry:** Discovery doc signed off.
**Exit:** Migration SQL + API contracts agreed by human.

### `/sprint-plan $N: features`

Agent: `system-architect`

Auto-runs:

```bash
npm run test 2>&1 | tail -1    # Record test baseline count
```

Produces `docs/sprints/SPRINT_$N_PLAN.md`:

- Feature breakdown with phase assignments
- Interface contracts (API shapes, DB schema)
- Dependency graph
- Test baseline count

### `/db-design $FEATURE`

Agent: `backend-architect`

Produces:

- Migration SQL in `supabase/migrations/` (follows existing numbering)
- Zod schema stubs in `packages/shared/src/types/`
- RLS policy checklist

### `/api-design $FEATURE`

Agent: `backend-architect`

Produces `docs/api/$FEATURE.md`:

- Route shapes (method, path, auth, request, response)
- Error cases and status codes
- Rate limiting requirements

### `/architect $FEATURE`

Agent: `system-architect`

Produces architecture doc with:

- Cross-package dependencies
- Data flow diagram
- Trade-off analysis (≥2 alternatives)
- ADR (Architecture Decision Record)

**🔐 GATE:** Human agrees on migration SQL + API contracts. After this, Claude auto-chains BUILD → TEST → QUALITY → HARDEN → DOCUMENT.

---

## Phase 3 — BUILD ⚡

**Entry:** Plan approved. Auto-starts immediately.
**Exit:** All routes return non-500, types generated, tests skeleton in place.

**Build order within a feature:**

```
DB (migration + types) → Engine/service → API routes → Frontend hooks → UI components → Tests
```

### `/build-db $FEATURE`

Agent: `backend-architect`

Auto-runs:

```bash
# 1. Apply migration via Supabase MCP
# 2. Regenerate TypeScript types
npm run db:types
# 3. Verify build still passes
npm run build -- --filter=@realflow/shared
```

### `/build-engine $ENGINE`

Agent: `backend-architect`

Scaffolds in `packages/business-logic/src/`:

- Engine class with typed methods
- Vitest test skeleton with proper UUID fixtures

### `/build-mobile $FEATURE`

Agent: `frontend-architect`

Scaffolds Expo Router screens with NativeWind styling.

### Built-in Skills

| Skill                  | What it produces                         |
| ---------------------- | ---------------------------------------- |
| `/api-new $ROUTE`      | Fastify route with Zod validation + auth |
| `/component-new $SPEC` | React component with TypeScript          |
| `/page-new $SPEC`      | Next.js App Router page                  |
| `/supabase:types-gen`  | TypeScript types from live schema        |

**Auto-transitions to TEST** when build is complete.

---

## Phase 4 — TEST ⚡

**Entry:** BUILD complete. Auto-starts.
**Exit:** 0 new failures, engine at 80%+ coverage.

Auto-runs:

```bash
npm run test                    # Full suite — must pass
npm run test:coverage           # Coverage report
```

### `/api-test $ROUTE`

Skill: generates API endpoint tests (happy path, 401, 400/422, edge cases).

### `/test-unit $FILE`

Agent: `qa-engineer`. Generates Vitest unit tests following MEMORY.md patterns.

### `/test-integration $FEATURE`

Agent: `qa-engineer`. Full route → engine → DB path tests.

### `/test-coverage`

Agent: `qa-engineer`

Auto-runs:

```bash
npm run test:coverage
```

Compares against baseline from `docs/pm/SPRINT_STATE.md`. Reports delta.

**Auto-transitions to QUALITY** when all tests pass.

---

## Phase 5 — QUALITY ⚡

**Entry:** Tests passing. Auto-starts.
**Exit:** All gates green.

Auto-runs (in sequence, stops on first failure):

```bash
npm run lint                    # ESLint
npm run type-check              # TypeScript strict
npx prettier --check .          # Format check
```

If lint or format issues found, auto-fixes:

```bash
npm run lint -- --fix
npx prettier --write .
```

Then re-runs checks to verify fix.

### `/quality-check`

Runs all gates above in sequence. Reports PASS/FAIL per gate.

### `/pr-review $BRANCH`

Agent: `refactoring-expert`

Auto-runs:

```bash
git diff main...$BRANCH --stat
```

Reviews against:

- Does implementation match API contract?
- RLS on all new tables?
- Rate limiting on mutating endpoints?
- N+1 queries?
- Test coverage meets baseline?
- No hardcoded secrets?

**Auto-transitions to HARDEN** when all gates green.

---

## Phase 6 — HARDEN ⚡

**Entry:** Quality green. Auto-starts.
**Exit:** 0 CRITICAL findings. Produces `docs/harden/$SPRINT.md`.

### `/harden $SPRINT`

Orchestrates two agents in sequence:

**Security check** (agent: `security-engineer`):

- OWASP Top 10 on new routes
- JWT handling (Bearer + query param paths)
- RLS policies on all new tables
- Zod schema coverage on all inputs
- Rate limiting on public endpoints
- No secrets in source code

**Performance check** (agent: `performance-engineer`):

- N+1 query detection in new routes
- Bundle size impact of new components
- Re-render analysis for new React components
- Response time vs. <200ms p95 target

### `/security-scan`

Agent: `security-engineer`. Standalone security audit.

### `/perf-audit`

Agent: `performance-engineer`. Standalone performance audit.

### `/error-boundaries`

Agent: `qa-engineer`. Audit missing error handling across routes, frontend, integrations.

**CRITICAL findings BLOCK DOCUMENT phase.** Fix them first, then re-run harden.

**Auto-transitions to DOCUMENT** when 0 CRITICALs.

---

## Phase 7 — DOCUMENT ⚡

**Entry:** Harden complete, 0 CRITICAL findings. Auto-starts.
**Exit:** API docs + changelog updated.

### `/api-docs $FEATURE`

Agent: `technical-writer`

Produces `docs/api/$FEATURE.md`:

- Route summary table
- Request/response examples (curl)
- Auth requirements
- Error codes

### `/changelog $SPRINT`

Agent: `technical-writer`

Auto-runs:

```bash
git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD
```

Produces Keep-a-Changelog entry: Added / Changed / Fixed / Security.

### `/sprint-report $N`

Agent: `technical-writer`

Auto-runs:

```bash
npm run test 2>&1 | tail -1    # Final test count
```

Produces `docs/sprints/SPRINT_$N_REPORT.md`:

- Features delivered vs. planned
- Test count delta (baseline → final)
- Decisions made with rationale
- Retro: what went well / what to improve

**Auto-transitions to DEPLOY** when docs complete.

---

## Phase 8 — DEPLOY 🔐 (production only)

**Entry:** DOCUMENT complete.
**Exit:** Smoke tests pass on staging + production.

### `/deploy-check`

Agent: `devops-engineer`

Auto-runs:

```bash
npm run build                   # Build must pass
npm run test                    # Tests must pass
npm run quality                 # Quality must pass
```

Verifies:

- [ ] Build passes
- [ ] All migrations applied via Supabase MCP
- [ ] No new env vars missing from Render config
- [ ] `/health` returns 200
- [ ] 0 CRITICAL harden findings open
- [ ] PR merged with CI green

### `/deploy-staging`

Agent: `devops-engineer`

Auto-runs:

1. Render MCP: `trigger_deploy` on staging service
2. Render MCP: `get_deploy_logs` to monitor progress
3. Wait for deploy to complete
4. `/smoke-test $STAGING_URL`

### `/smoke-test $URL`

5-point automated check:

```bash
# 1. Health
curl -sf "$URL/health"
# 2. Auth endpoint exists
curl -s -o /dev/null -w "%{http_code}" -X POST "$URL/api/v1/auth/login"
# 3. Protected route → 401
curl -s -o /dev/null -w "%{http_code}" "$URL/api/v1/contacts"
# 4. Invalid token → 401
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid" "$URL/api/v1/contacts"
# 5. Property route exists
curl -s -o /dev/null -w "%{http_code}" "$URL/api/v1/properties"
```

Report PASS/FAIL per check.

### `/deploy-production`

**🔐 EXPLICIT HUMAN COMMAND ONLY.** Never auto-chained. Never triggered by `/ship`.

Uses Render MCP to deploy to production. Always confirms:

> "Deploy to production? This will affect live users at realflow-api.onrender.com."

After deploy, auto-runs `/smoke-test https://realflow-api.onrender.com`.

---

## Phase 9 — MONITOR ⚡

**Entry:** 24–48h after production deploy.
**Exit:** No CRITICAL errors for 24h.

### `/health-check`

Agent: `devops-engineer`

Auto-runs:

```bash
curl -sf https://realflow-api.onrender.com/health | jq .
```

Via Render MCP:

- Service status and uptime
- Recent error rate from logs
- Deploy history

### `/error-triage $ERROR`

Agent: `backend-architect`

Root-cause analysis:

1. Search codebase for error origin
2. Check Render MCP logs for frequency and context
3. Identify root cause
4. Propose fix with test

---

## Phase 10 — FINISH 🔐

**Entry:** 24h of clean monitor logs.
**Exit:** Sprint tagged, MEMORY.md updated.

### `/sprint-close`

Agent: `sprint-manager`

Auto-runs:

```bash
npm run test 2>&1 | tail -1    # Final test count
```

1. Verify all sprint features deployed to production
2. Run `/sprint-report $N`
3. Update `docs/pm/SPRINT_STATE.md`:
   - Move all features to PRODUCTION
   - Clear "Last Session Handoff"
   - Update velocity history
   - Move current sprint to "Previous Sprint Summary"
4. Update `memory/MEMORY.md` if any stable knowledge changed
5. Output: `git tag sprint-$N && git push origin sprint-$N` for human to run

**🔐 GATE:** Human runs the git tag command manually.

---

## The `/ship $FEATURE` Command

Chains phases 5–8 in one shot. Most common use case: feature code is done, ready to ship.

```
Step 1:  npm run quality             ← QUALITY (auto)
Step 2:  npx prettier --check .      ← QUALITY (auto)
Step 3:  npm run test                ← TEST verification (auto)
Step 4:  npm run test:coverage       ← Coverage vs baseline (auto)
Step 5:  /security-scan              ← HARDEN (auto)
Step 6:  /perf-audit                 ← HARDEN (auto)
Step 7:  /api-docs $FEATURE          ← DOCUMENT (auto)
Step 8:  /changelog                  ← DOCUMENT (auto)
Step 9:  /deploy-check               ← DEPLOY (auto)
Step 10: /deploy-staging             ← DEPLOY + smoke test (auto)
```

On success: _"$FEATURE is ready for production. Run `/deploy-production` to complete."_
On failure: Stops immediately, reports which step failed and why.

**Never** auto-deploys to production.

---

## Sprint Lifecycle Commands

### `/sprint-start`

1. Read `docs/pm/SPRINT_STATE.md` for current state
2. Read `STRATEGIC_ROADMAP.md` for next sprint scope
3. Run `/discover` for each planned feature
4. **🔐 GATE:** Human reviews discovery docs
5. Record current test count as baseline
6. Output sprint plan doc
7. Create `docs/pm/SPRINT_STATE.md` entry for new sprint

### `/sprint-close`

1. Verify all features deployed to production
2. Run `/sprint-report $N`
3. Update `docs/pm/SPRINT_STATE.md` (velocity, summary, clear handoff)
4. Update `memory/MEMORY.md` if stable knowledge changed
5. Output: `git tag sprint-$N` command for human to run
6. **🔐 GATE:** Human runs tag command

---

## Typical Sprint — Start to Production

```bash
# === DISCOVER (human-gated) ===
/sprint-start
/discover feature-a
/discover feature-b
# 🔐 HUMAN: review docs/discovery/ ————————————————

# === PLAN (human-gated) ===
/sprint-plan 8: feature-a, feature-b
/db-design feature-a
/api-design feature-a
# 🔐 HUMAN: agree on migration SQL + API contracts ——

# === AUTO-CHAIN: BUILD → TEST → QUALITY → HARDEN → DOCUMENT ===
# Claude runs all of these without stopping:
/build-db feature-a
/build-engine FeatureEngine
/api-new /api/v1/feature
/component-new FeatureComponent
/api-test /api/v1/feature
/test-coverage
# Quality auto-runs: npm run quality + prettier
# Harden auto-runs: /security-scan + /perf-audit
# Document auto-runs: /api-docs + /changelog

# === DEPLOY (staging auto, production human-gated) ===
/ship feature-a              # Chains quality → staging
# 🔐 HUMAN: review staging ————————————————————————

/deploy-production            # Explicit human command

# === MONITOR (24-48h later) ===
/health-check
/error-triage "TypeError: ..."

# === FINISH ===
/sprint-close
# 🔐 HUMAN: run git tag command ———————————————————
```

---

## Conventions

### Migration Naming

- Format: `000XX_description.sql` (zero-padded sequential)
- Never duplicate prefix numbers
- Always check `supabase/migrations/` before numbering

### Test Fixtures

- UUID fields: `crypto.randomUUID()` or proper UUID string
- Never `'contact-1'` or `'check-1'` — Zod throws
- `vi.mock()` factories: use `vi.hoisted()` for shared mocks
- Arrow mocks: can't be constructors — use DI

### Commit Messages

`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`, `security:`

### Branch Names

- Feature: `feature/descriptive-name`
- Sprint: `sprint/sprint-N`
- Fix: `fix/descriptive-name`

### Soft Deletes

`deleted_at TIMESTAMPTZ` — never hard delete. Filter `WHERE deleted_at IS NULL`.

### Session End

Always update `docs/pm/SPRINT_STATE.md` → "Last Session Handoff" before ending.

---

## Glossary

### Australian Real Estate Terms

- **Buyers agent** — agent who acts exclusively for the buyer
- **Vendor** — seller of a property (AU term)
- **Due diligence** — pre-purchase inspection and legal review (state-specific)
- **Section 32 / Vendor Statement** — Victorian legal disclosure
- **AUSTRAC** — Australian AML regulator
- **100-point ID check** — AU identity verification standard
- **REA** — realestate.com.au (largest AU portal)
- **Domain** — domain.com.au (second-largest, our v1 data source)

### RealFlow Terms

- **Client brief** — 60+ field structured requirements for buyers agent engagement
- **Property match** — AI-scored comparison of listing against client brief
- **Buyer pipeline** — 8 stages: Lead → Qualified → Brief → Searching → Shortlisted → Offer → Exchange → Settlement
- **Seller pipeline** — 6 stages: Appraisal → Listed → Under Offer → Exchanged → Settlement → Settled
- **Sprint baseline** — test count at sprint start (recorded in SPRINT_STATE.md)
- **Hard gate** — quality check that blocks next phase on failure
- **Feature lifecycle** — BACKLOG → DISCOVER → PLAN_APPROVED → BUILD → TEST → QUALITY → HARDEN → STAGED → PRODUCTION
