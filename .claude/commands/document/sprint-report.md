# Sprint Report Generator

You are a **Sprint Report Writer** for RealFlow. You generate a sprint completion report that becomes the primary input to `/sprint-close` and the institutional memory update.

## Context

$ARGUMENTS

## Output

Produce `docs/sprints/SPRINT_N_REPORT.md`. Create the directory if it doesn't exist.

## Report Structure

```markdown
# Sprint N Completion Report

**Sprint:** N — [Theme]
**Dates:** YYYY-MM-DD → YYYY-MM-DD
**Status:** COMPLETE ✅ / PARTIAL ⚠️ / INCOMPLETE ❌

---

## What Was Planned

From `SPRINT_N_PLAN.md`:

| Feature   | Team   | Est. Days | Status           |
| --------- | ------ | --------- | ---------------- |
| Feature A | Team A | 5         | ✅ Delivered     |
| Feature B | Team B | 4         | ✅ Delivered     |
| Feature C | Team C | 3         | ⚠️ Partial (70%) |

---

## What Was Delivered

### Feature A — [Name]

**Status:** ✅ Complete
**Key files added:**

- `packages/business-logic/src/feature-a-engine.ts` (N methods)
- `apps/api/src/routes/feature-a.ts` (N endpoints)
- `supabase/migrations/000XX_feature_a.sql`
- `apps/web/src/app/feature-a/page.tsx`
- `apps/mobile/app/feature-a/index.tsx`

**Tests:** N new tests added. All passing.

### Feature B — [Name]

[same structure]

---

## Test Count

| Metric                 | Sprint Start | Sprint End | Delta |
| ---------------------- | ------------ | ---------- | ----- |
| Total tests            | 606          | 721        | +115  |
| Passing                | 606          | 721        | +115  |
| Failing (pre-existing) | 10           | 10         | 0     |
| New regressions        | —            | 0          | —     |

---

## Database Changes

New tables created this sprint:

| Table              | Migration | Columns | RLS |
| ------------------ | --------- | ------- | --- |
| `feature_a_table`  | 000XX     | 12      | ✅  |
| `feature_b_events` | 000XY     | 8       | ✅  |

---

## Architectural Decisions Made

Document decisions made during the sprint that future engineers need to know:

| Decision                                     | Rationale                                         | Alternatives Rejected                    |
| -------------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| Use Supabase join for property-contact query | Eliminated N+1 from 50 queries to 2               | Separate queries with Promise.all        |
| Cache Domain API responses for 15min         | Rate limit is 1000/day — caching extends capacity | No cache (would hit limit with 10 users) |

---

## Technical Debt Introduced

Items deliberately deferred for speed:

| Item                                  | File                                                 | Severity | Planned Sprint |
| ------------------------------------- | ---------------------------------------------------- | -------- | -------------- |
| Missing useMemo on FeatureList filter | `apps/web/src/components/feature/FeatureList.tsx:23` | Low      | Sprint N+1     |
| Domain webhook signature verification | `apps/api/src/routes/domain-sync.ts:89`              | Medium   | Sprint N+1     |

---

## Open Issues / Bugs Found

Issues discovered during the sprint that were not fixed:

| Issue                                     | Severity | Owner | Next Sprint? |
| ----------------------------------------- | -------- | ----- | ------------ |
| Analytics dashboard slow on mobile Safari | Medium   | —     | Yes          |
| Client brief PDF export incomplete        | Low      | —     | Sprint N+2   |

---

## Retrospective Prompts

_(Fill in manually after sprint close meeting)_

## **What went well?**

## **What should change?**

## **What tech debt are we carrying that's slowing us down?**

## **Is the WORKFLOW.md process working? What phases are being skipped?**

---

## Sprint N+1 Preparation

Based on this sprint's learnings, recommended focus areas for Sprint N+1:

- [item]
- [item]
```

## Instructions

- Read `SPRINT_N_PLAN.md` to populate the "What Was Planned" section
- Run `npm run test` to get the actual test count for the "Test Count" table
- List every new file added this sprint — not just the key ones
- Architectural decisions are the most valuable part — don't skip them
- Be honest about partial deliveries — this is institutional memory, not a PR document
- The retrospective prompts are left blank for human input at the sprint close meeting
