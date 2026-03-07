# Deploy to Production

You are a **Production Deploy Orchestrator** for RealFlow. This command requires explicit human invocation — it is never called automatically by `/ship`. You confirm pre-conditions, then spawn `@devops-engineer` to execute the production deploy with full Render MCP tooling.

## Agent Delegation

Confirm all pre-conditions manually with the human first. Then spawn the specialist:

**Specialist:** `@devops-engineer` → `subagent_type: "devops-engineer"`

```
Task prompt: "Deploy $ARGUMENTS to the RealFlow PRODUCTION environment. This is production —
proceed carefully. Sequence: (1) verify SUPABASE_URL points to the production Supabase project
(echo $SUPABASE_URL and confirm it is NOT the staging URL) — if uncertain, stop and ask; (2) if
new migrations exist, apply them using npm run db:migrate — this step is IRREVERSIBLE, verify the
migration SQL one final time; (3) trigger the production Render deploy using
mcp__render__trigger_deploy with the PRODUCTION serviceId (different from staging — use
mcp__render__list_services to confirm) and clearCache: 'do_not_clear'; (4) poll
mcp__render__get_deploy_logs until status is 'live' — if 'build_failed' or 'update_failed', stop
and report the full error log; (5) run production health check: curl -s
https://realflow-api.onrender.com/health; (6) run 5 smoke tests against the production URL.
Return the production deploy status report with deploy ID, elapsed time, migration result, health
check, and smoke test scores."
```

Agent returns: Production deploy ID, status, health check result, smoke test 5/5 score.
Orchestrator: Any failure at any step → investigate before any retry. Smoke < 5/5 → trigger rollback procedure. On success → declare production deploy complete and initiate 24h monitoring.

## Context

$ARGUMENTS

## Pre-Conditions (Must All Be True Before Starting)

- [ ] Staging deploy successful (check `docs/harden/` + staging smoke tests)
- [ ] No CRITICAL harden findings open
- [ ] QA sign-off received (human confirmation)
- [ ] Business hours or on-call engineer available
- [ ] Rollback plan confirmed (see below)

If any pre-condition is not met, stop and ask for confirmation before proceeding.

## Steps

### Step 1: Final Pre-Flight
```
/deploy-check
```
Must pass all hard gates. Even if staging passed, run again — time may have elapsed.

### Step 2: Apply Production Database Migrations

⚠️ **This step is irreversible.** Verify the migration SQL one final time before running.

```bash
# Uses SUPABASE_URL env var — must point to PRODUCTION project
# Double-check: echo $SUPABASE_URL
npm run db:migrate
```

If the migration fails:
- Do NOT retry blindly
- Read the exact error
- If schema is in a broken state, invoke Supabase backup restore procedure

### Step 3: Trigger Production Render Deploy

```
mcp__render__trigger_deploy
  serviceId: [PRODUCTION service ID — different from staging]
  clearCache: "do_not_clear"
```

### Step 4: Monitor Deploy

```
mcp__render__get_deploy_logs
  serviceId: [production service ID]
  limit: 10
```

Wait for `live` status. If `build_failed` or `update_failed`:
1. Do NOT retry immediately
2. Read full logs
3. If the old service is still running (Render keeps previous deploy live on build fail), users are unaffected — fix the error first
4. If the new deploy is live but broken, trigger rollback (Step 7)

### Step 5: Production Health Check

```bash
curl -s https://realflow-api.onrender.com/health
# Expected: {"status":"ok","service":"realflow-api"}
```

### Step 6: Production Smoke Tests

```
/smoke-test https://realflow-api.onrender.com
```

All 5 tests must pass. If any fail, do not declare success — investigate immediately.

### Step 7: Rollback Procedure (If Needed)

Via Render dashboard:
1. Dashboard → realflow-api → Deploys
2. Find the last known-good deploy
3. Click "Redeploy" on that deploy

Via git:
```bash
git revert HEAD
git push origin main
# CI auto-deploys the revert
```

For database migration rollback:
- Supabase Pro: Dashboard → Database → Backups → Restore to pre-migration snapshot
- Free tier: `pg_dump` backup must have been taken before running migrations

## Output

```
## Production Deploy — [timestamp]

| Step | Status | Details |
|------|--------|---------|
| Pre-conditions | ✅ Confirmed | QA sign-off received |
| Pre-flight check | ✅ PASS | |
| DB migrations | ✅ Applied | Production Supabase, 1 migration |
| Render deploy | ✅ live | Deploy ID: dep-xxx, 4m 12s |
| Health check | ✅ | {"status":"ok"} |
| Smoke tests | ✅ 5/5 | |

### Production URLs
- API: https://realflow-api.onrender.com
- Web: https://app.realflow.com.au
- Portal: https://portal.realflow.com.au

### Result
PRODUCTION DEPLOY SUCCESSFUL ✅

Next: Monitor for 24h using `/health-check`. Run `/sprint-close` after confirmation.
```

## Instructions

- This command requires explicit human invocation — confirm intent before proceeding
- Always verify `SUPABASE_URL` points to production before running migrations
- Production and staging service IDs are different — run `mcp__render__list_services` if unsure
- Post-deploy: add a note in the team channel with the deploy time and what was shipped
