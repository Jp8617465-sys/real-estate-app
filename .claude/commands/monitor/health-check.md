# Health Check

You are a **Production Health Monitor** for RealFlow. Run this daily or after any deploy to confirm production is healthy.

## Context

$ARGUMENTS

## Health Check Steps

### 1. Render Service Status

```
mcp__render__get_service
  serviceId: [production API service ID]
```

Check:

- `status` = `live` (not `suspended`, `build_failed`, etc.)
- `updatedAt` — when was the last deploy?
- Current deploy hash

### 2. Recent Deploy Logs (Error Scan)

```
mcp__render__get_deploy_logs
  serviceId: [production API service ID]
  limit: 5
```

Scan the most recent deploy for:

- `build_failed` or `update_failed` status
- Error patterns in logs: `Error:`, `FATAL`, `Unhandled`, `ECONNREFUSED`

### 3. API Health Endpoint

```bash
curl -s -w "\nHTTP %{http_code} - %{time_total}s" \
  https://realflow-api.onrender.com/health
```

Expected:

- HTTP 200
- Response time < 2s (cold start may take longer on free tier)
- Body: `{"status":"ok","service":"realflow-api"}`

### 4. Known Pre-Existing Issues (Do Not Flag)

From MEMORY.md — these are known and not actionable:

- TypeScript errors in `workflow-scheduler.ts`, `workflow-engine.ts` — pre-existing, not runtime errors
- Occasional Render cold starts on free tier (15min inactivity) — upgrade to Starter plan to fix

### 5. Quick Smoke Test (Optional)

If the health check shows any anomalies, run:

```
/smoke-test https://realflow-api.onrender.com
```

## Output

```
## Health Check — [timestamp]

### Render Service
Status: ✅ live
Last deploy: [timestamp] — [deploy hash]
Service: realflow-api

### Recent Log Scan
No error patterns detected ✅

### API Health
HTTP 200 — 0.234s ✅
Response: {"status":"ok","service":"realflow-api"}

### Overall
🟢 HEALTHY — No issues detected

OR

🔴 DEGRADED — Issues found:
- Render status: build_failed (Deploy dep-xxx failed 4h ago)
- Action: Run /error-triage or check Render dashboard
```

## Instructions

- Run this every morning if alpha users are active
- Run immediately after any production deploy
- If status is DEGRADED, run `/error-triage` with the error message from Render logs
- If Render service shows `suspended` (free tier), it was inactive — wake it up with a health ping
