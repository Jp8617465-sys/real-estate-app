# RealFlow Handover Note

**Date:** 2026-03-09 | **Branch:** `sprint-5` | **Last commit:** `27f36c8`

---

## What was done this session

### Sprint 7 — Frontend Modernisation (COMPLETE ✅)

- All Sprint 7 UI/animation/DnD/haptics code committed in `091cb27`
- PR #38 open: `sprint-5 → main`
- Test count: **1761 passing** (up from 1391 at Sprint 5 close)

### Supabase MCP configured

`.mcp.json` now has three MCP servers:

- **`supabase`** — stdio, scoped to staging (`hfwgymqjnwlewmbskuim`)
- **`supabase-all-projects`** — stdio, unscoped (can see and manage all projects including production)
- **`render`** — HTTP, Render deployments (was already present)

`.claude/settings.json` now has `"enableAllProjectMcpServers": true`.

**Action required:** Restart Claude Code — MCP servers only load on startup.

---

## What needs to happen next

### 1. Merge PR #38 → main

```
gh pr merge 38 --squash
```

This gets Sprint 7 (Frontend Modernisation) into production.

### 2. Apply migrations 00020–00023 to production

Sprint 6 migrations are on staging but not production. After restarting Claude Code with the Supabase MCP active, ask:

> "Use the supabase-all-projects MCP to list my projects, find the production project, and apply migrations 00020–00023"

Migrations to apply in order:

- `supabase/migrations/00020_social_dm_leads.sql`
- `supabase/migrations/00021_off_market_properties.sql`
- `supabase/migrations/00022_team_agency_features.sql`
- `supabase/migrations/00023_round_robin_function.sql`

### 3. Trigger Render redeploy

After merging PR #38, trigger a new deploy on Render service `srv-d6logk450q8c73a884pg`.
The Render MCP is already connected in `.mcp.json`.

---

## Key references

| Item                        | Value                      |
| --------------------------- | -------------------------- |
| Staging Supabase project    | `hfwgymqjnwlewmbskuim`     |
| Render service              | `srv-d6logk450q8c73a884pg` |
| Open PR                     | #38 (sprint-5 → main)      |
| Test baseline               | 1761 passing               |
| Known pre-existing failures | 10 (see MEMORY.md)         |

---

## Sprint 8 — what's next

Roadmap shows next priorities (see `STRATEGIC_ROADMAP.md`). Recommended continuation prompt:

```
Continue RealFlow development. Read MEMORY.md and STRATEGIC_ROADMAP.md.
Sprint 7 (Frontend Modernisation) is complete — PR #38 open, needs merge.
Migrations 00020-00023 need to be applied to production via Supabase MCP.
Start Sprint 8 planning with /sprint-plan once deployment is confirmed.
Test baseline: 1761 passing.
```
