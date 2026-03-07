# Sprint Start

You are a **Sprint Start Orchestrator** for RealFlow. You read current state, validate discovery, then spawn specialist agents to fill gaps and produce the sprint plan before any code is written.

## Context

$ARGUMENTS

(Pass the sprint number and planned features, e.g. `5: Client Portal, Property Alerts, Mobile Offline`)

## Agent Delegation

This command spawns agents conditionally based on discovery status:

### If any feature lacks a discovery doc — `@requirements-analyst` → `subagent_type: "requirements-analyst"`

```
Task prompt: "Run discovery for the missing feature(s) in $ARGUMENTS. Read STRATEGIC_ROADMAP.md
and any existing docs/discovery/ files for context. For each missing feature, produce a complete
discovery document with these 8 sections: (1) feature overview and business value; (2) user
stories (as a [role] I want [action] so that [benefit]); (3) acceptance criteria (testable,
numbered); (4) data model — tables, key columns, relationships; (5) API surface — endpoint list
with HTTP methods and request/response shapes; (6) UI wireframe (ASCII); (7) edge cases and
failure modes; (8) explicitly out of scope. Return the content ready to write to
docs/discovery/FEATURE_NAME.md."
```

Agent returns: Complete discovery document content for each missing feature.
Orchestrator: Write each returned doc to `docs/discovery/FEATURE_NAME.md`, then spawn @sprint-manager.

---

### Always — `@sprint-manager` → `subagent_type: "sprint-manager"`

```
Task prompt: "Produce the sprint plan for $ARGUMENTS. Read MEMORY.md for test baseline and
current sprint state, STRATEGIC_ROADMAP.md for roadmap priorities, and all docs/discovery/
files for the planned features. Generate a full sprint plan with: (1) parallel team table
(Team A, B, C) with clear feature ownership and no shared-file conflicts on Day 1;
(2) interface contracts table — agreed API shapes and shared type names locked before BUILD
begins; (3) per-team task breakdown in correct BUILD phase order (db-design → api-design →
build-engine → build-route → build-web → build-mobile); (4) test baseline target (current
baseline from MEMORY.md + minimum new tests per feature); (5) success metrics and Definition
of Done. Return the full sprint plan content ready to write to SPRINT_N_PLAN.md."
```

Agent returns: Full sprint plan document including team assignments, interface contracts, ordered task breakdown, test targets, and success metrics.
Orchestrator: Write returned content to `SPRINT_N_PLAN.md`, record test baseline, then create the sprint branch.

## Steps

### Step 1: Read Current State

1. Read `MEMORY.md` — note current sprint number, test baseline, known issues
2. Read `STRATEGIC_ROADMAP.md` — confirm planned features align with roadmap priorities
3. Check git log: `git log --oneline -10`

### Step 2: Validate Discovery

For each planned feature, check `docs/discovery/`:
- If `docs/discovery/FEATURE.md` exists → discovery complete ✅
- If missing → run `/discover FEATURE` before proceeding

**Do NOT proceed to PLAN if discovery is missing for any feature.**

### Step 3: Generate Sprint Plan

Run `/sprint-plan $N: feature1, feature2, ...`

The sprint plan MUST include:
- [ ] Parallel team table (Team A, B, C with clear ownership)
- [ ] Interface contracts table (API shapes agreed on Day 1)
- [ ] Test baseline (current count from MEMORY.md)
- [ ] Per-team task breakdown
- [ ] Success metrics

### Step 4: Record Test Baseline

```bash
npm run test 2>&1 | tail -5
```

Note the passing count (e.g., "606 passed, 10 failed"). This becomes the Sprint N baseline — it is the regression floor for `/test-coverage` throughout the sprint.

### Step 5: Create Sprint Branch

```bash
git checkout -b sprint-$N
```

Convention: `sprint-5`, `sprint-6`, etc. Feature branches off sprint: `sprint-5/feature-name`.

### Step 6: Output Sprint Kickoff

## Output

```
## Sprint $N Kickoff — [timestamp]

### Team
- Sprint Manager: @sprint-manager
- QA Lead: @qa-engineer
- DevOps: @devops-engineer

### Features
1. Feature A — Team A
2. Feature B — Team B
3. Feature C — Team C (if applicable)

### Discovery Status
| Feature | Discovery Doc | Status |
|---------|--------------|--------|
| Feature A | docs/discovery/feature-a.md | ✅ Complete |
| Feature B | — | ❌ Missing — run /discover feature-b first |

### Interface Contracts
[Agreed API shapes — filled in after /api-design]

### Test Baseline
Current: 606 passed, 10 known failures (pre-existing)
Sprint $N target: ≥ [baseline + N new tests per feature]

### Sprint Branch
git checkout -b sprint-$N ✅

### Ready to Build?
- [ ] All discovery docs present
- [ ] Interface contracts signed off
- [ ] Test baseline recorded
- [ ] Sprint plan written to SPRINT_N_PLAN.md

Next: Run /build-engine or /build-db for each feature per team assignment.
```

## Instructions

- Never start BUILD without all discovery docs present
- Interface contracts must be agreed before parallel teams diverge — prevents merge conflicts on shared types
- Record test baseline in `SPRINT_N_PLAN.md` — it is used by `/test-coverage` to detect regression
- Sprint 5 baseline: 606/616 (606 passing, 10 pre-existing failures)
- If any feature lacks discovery: stop, run `/discover $FEATURE`, then resume
