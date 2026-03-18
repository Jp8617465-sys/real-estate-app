# Sprint Planner

You are a **Sprint Plan Orchestrator** for RealFlow. You set up context, spawn `@sprint-manager` (for plan structure and team assignments) and `@system-architect` (to validate the interface contracts have no hidden coupling), then assemble the final `SPRINT_N_PLAN.md`.

## Agent Delegation

### Step 1 — @sprint-manager → `subagent_type: "sprint-manager"`

```
Task prompt: "Produce a complete sprint plan for $ARGUMENTS. Read SPRINT_4_PLAN.md as the
canonical reference structure. Read MEMORY.md for the current test baseline and sprint status.
Read STRATEGIC_ROADMAP.md to confirm feature priorities. Produce all 8 sections: sprint overview,
feature list with complexity ratings, parallel team assignments (verify zero shared file
dependencies between teams before assigning), interface contracts as Zod schema shapes agreed on
Day 1, migration numbering (check supabase/migrations/ for the highest existing number), per-team
task breakdown in dependency order, test baseline, and success metrics. Flag any feature that
depends on an external API approval (Domain.com.au, Anthropic) as a risk item."
```

### Step 2 — @system-architect → `subagent_type: "system-architect"`

```
Task prompt: "Review the interface contracts and team assignments in the sprint plan for
$ARGUMENTS. Specifically: (1) verify the proposed parallel teams truly have zero shared file
dependencies — check that Team A and Team B are not both touching the same engine files or Zod
schema files; (2) review the interface contracts (API shapes and Zod schemas) for hidden coupling
that could cause merge conflicts during parallel development; (3) flag any architectural risk
(e.g. a shared utility that both teams need to modify, or a Supabase migration that depends on
another team's migration). Return a list of coupling risks with suggested resolutions."
```

Agent returns: Complete sprint plan + coupling risk assessment.
Orchestrator: If @system-architect finds coupling risks, resolve them by adjusting team assignments or adding explicit interface contracts before writing the final `SPRINT_N_PLAN.md`.

## Context

$ARGUMENTS

## Instructions

Read `SPRINT_4_PLAN.md` and `MEMORY.md` before generating this plan. Follow the exact structure below.

Produce the plan as `SPRINT_N_PLAN.md` at the repo root.

## Sprint Plan Structure

### 1. Sprint Overview

```
Sprint: N
Theme: [one sentence]
Duration: [X weeks]
Goal: [what "done" looks like for this sprint]
```

### 2. Features to Deliver

List all features with:

- Feature name
- Link to discovery doc: `docs/discovery/FEATURE.md`
- Complexity: Low / Medium / High
- Value: Core / Supporting / Nice-to-have

### 3. Parallel Team Structure

Identify features with zero shared dependencies and assign to parallel "teams":

| Team   | Feature   | Key Files                                                                     | Est. Dev-Days |
| ------ | --------- | ----------------------------------------------------------------------------- | ------------- |
| Team A | Feature 1 | `packages/business-logic/src/engine-a.ts`, `apps/api/src/routes/feature-a.ts` | N             |
| Team B | Feature 2 | `packages/business-logic/src/engine-b.ts`, `apps/api/src/routes/feature-b.ts` | N             |
| Team C | Feature 3 | ...                                                                           | N             |

### 4. Interface Contracts (Agree Day 1)

These must be defined before parallel teams begin — they prevent merge conflicts.

For each inter-team boundary:

```typescript
// API contract: Feature A endpoint
POST / api / v1 / feature - a / action;
Request: {
  field1: string;
  field2: number;
}
Response: {
  id: string;
  result: string;
}
```

For each shared Zod schema:

```typescript
// packages/shared/src/types/feature-a.ts
export const FeatureASchema = z.object({...})
```

### 5. Database Migrations

List all migrations to be created this sprint:

| Migration       | Number | Tables Created/Modified  | RLS Required |
| --------------- | ------ | ------------------------ | ------------ |
| Sprint N schema | 000XX  | table_a, table_b         | Yes          |
| Sprint N RLS    | 000XY  | (RLS policies for above) | N/A          |

⚠️ Migration numbers must be strictly sequential. Check `supabase/migrations/` for the highest existing number before assigning.

### 6. Per-Team Breakdown

For each team, list tasks in dependency order:

#### Team A: [Feature Name]

**Day 1–2: Database**

- [ ] Create migration `000XX_feature_name.sql`
- [ ] Run `npm run db:migrate`
- [ ] Run `npm run db:types`
- [ ] Verify RLS policies in Supabase Studio

**Day 2–3: Business Logic**

- [ ] Create `packages/business-logic/src/feature-engine.ts`
- [ ] Write Zod schemas in `packages/shared/src/types/feature.ts`
- [ ] Write unit tests `packages/business-logic/src/feature-engine.test.ts`

**Day 3–4: API Routes**

- [ ] Create `apps/api/src/routes/feature.ts`
- [ ] Register route in `apps/api/src/index.ts`
- [ ] Write API tests `apps/api/src/routes/feature.test.ts`

**Day 4–5: Web + Mobile**

- [ ] Web page: `apps/web/src/app/feature/page.tsx`
- [ ] Mobile screen: `apps/mobile/app/feature.tsx`
- [ ] Hooks: `apps/web/src/hooks/use-feature.ts`

### 7. Test Baseline

```
Sprint start baseline: [N]/[M] tests passing (from npm run test)
Sprint target: at least [N + new_tests] passing
Known pre-existing failures (do not count): 10 (see MEMORY.md)
```

### 8. Success Metrics

Define "done" for the sprint:

- [ ] All planned features deployed to production
- [ ] Test count equals or exceeds baseline + new tests
- [ ] No CRITICAL security findings open
- [ ] Client portal accessible to at least 1 real user
- [ ] All smoke tests passing on production

## Instructions

- Follow `SPRINT_4_PLAN.md` structure exactly — it is the canonical reference
- Assign migration numbers by reading the current highest in `supabase/migrations/`
- Parallel teams should have ZERO shared file dependencies — verify before assigning
- Interface contracts must include exact Zod schema shapes, not just route names
- Flag any dependency on external API approval (Domain.com.au, Anthropic) as a risk
