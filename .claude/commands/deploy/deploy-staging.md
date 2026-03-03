# Deploy to Staging

You are a **Staging Deployment Orchestrator** for RealFlow. You delegate the full staging deploy sequence to `@devops-engineer` and surface the result.

## Context

$ARGUMENTS

## Agent Delegation

**Specialist:** `@devops-engineer` → `subagent_type: "devops-engineer"`

```
Task prompt: "Deploy $ARGUMENTS to the RealFlow staging environment. Execute this exact sequence:
(1) Run mcp__render__list_services to identify the staging API service ID if not already known;
(2) Apply any new migrations in supabase/migrations/ via npm run db:migrate — confirm
SUPABASE_URL points to staging, not production;
(3) Trigger the staging Render deploy via mcp__render__trigger_deploy with clearCache:
do_not_clear — note the returned deploy ID;
(4) Poll mcp__render__get_deploy_logs every 30 seconds until status is 'live', 'build_failed',
or 'update_failed' — report the full error immediately if deploy fails;
(5) Confirm service health via mcp__render__get_service (status must be 'live') and curl the
/health endpoint (expect {\"status\":\"ok\"});
(6) Run smoke tests against the staging URL.
Return the staging deploy report table with status, deploy ID, timing, health check response,
and smoke test results for each step."
```

Agent returns: Staging deploy report table — step-by-step status including deploy ID, elapsed time, health check response, and smoke test pass/fail count.
Orchestrator gate: If any step returns a failure (build_failed, update_failed, health non-200, smoke test failure) → report `STAGING DEPLOY FAILED 🚫` and the error details. All steps green → report `STAGING DEPLOY SUCCESSFUL ✅` with the staging URL and `Ready for review. Run /deploy-production after QA sign-off.`

## Steps

### Step 1: Pre-Flight
Run `/deploy-check`. If any hard block is present, stop and report. Do not proceed.

### Step 2: Apply Staging Database Migrations

If new migrations exist in `supabase/migrations/` since the last deploy:
```bash
# Uses SUPABASE_URL env var — must point to staging project
npm run db:migrate
```

Verify migration applied: check Supabase dashboard → Database → Migrations. All should show green checkmarks.

### Step 3: Trigger Render Deploy

Use the Render MCP to trigger the staging API service deploy:

```
mcp__render__trigger_deploy
  serviceId: [staging service ID]
  clearCache: "do_not_clear"
```

Note the returned deploy ID.

### Step 4: Monitor Deploy Status

Poll using:
```
mcp__render__get_deploy_logs
  serviceId: [staging service ID]
  limit: 5
```

Wait for status to reach `live`. If `build_failed` or `update_failed`, read the logs and report the error.

Expected deploy time: 2–4 minutes.

### Step 5: Verify Service Health

```
mcp__render__get_service
  serviceId: [staging service ID]
```

Confirm:
- `status: live`
- `updatedAt` timestamp matches the deploy just triggered

Also curl the health endpoint:
```bash
curl -s https://realflow-api-staging.onrender.com/health
# Expected: {"status":"ok","service":"realflow-api"}
```

### Step 6: Run Smoke Tests

Run `/smoke-test https://realflow-api-staging.onrender.com`

All 5 smoke tests must pass.

### Step 7: Verify Vercel Deployments (Web + Portal)

Vercel auto-deploys on push to the connected branch. Check:
- Web dashboard deployed: visit the staging URL
- Portal deployed: visit the staging URL
- Both load without JavaScript errors (check browser console)

## Output

```
## Staging Deploy — [timestamp]

| Step | Status | Details |
|------|--------|---------|
| Pre-flight check | ✅ PASS | |
| DB migrations | ✅ Applied | 1 new migration (000014) |
| Render deploy triggered | ✅ | Deploy ID: dep-xxx |
| Deploy status | ✅ live | 3m 24s |
| Health check | ✅ | {"status":"ok"} |
| Smoke tests | ✅ 5/5 | |
| Vercel web | ✅ | https://realflow-web-staging.vercel.app |
| Vercel portal | ✅ | https://realflow-portal-staging.vercel.app |

### Result
STAGING DEPLOY SUCCESSFUL ✅

Ready for review. Run `/deploy-production` after QA sign-off.
```

## Instructions

- Never proceed past a hard block in Step 1
- If the Render deploy fails (build_failed/update_failed), read the full error in logs before reporting
- Staging and production use different Supabase projects — verify `SUPABASE_URL` points to staging before running migrations
- If Render service IDs are not known, run `mcp__render__list_services` first to find them
