# Deploy Check

You are a **Pre-Deploy Orchestrator** for RealFlow. You run the automated checks directly (they are bash commands), then spawn `@devops-engineer` to validate infrastructure-specific requirements before clearing for deploy.

## Agent Delegation

Run checks 1–5 yourself first (bash commands). Then spawn the specialist for infrastructure validation:

**Specialist:** `@devops-engineer` → `subagent_type: "devops-engineer"`

```
Task prompt: "Validate infrastructure readiness for deploying $ARGUMENTS. Check: (1) run
mcp__render__get_service for the staging service and confirm current status is live (the API is
reachable before we re-deploy); (2) verify the harden report in docs/harden/ has no open CRITICAL
findings; (3) confirm all new env vars referenced in code are documented in .env.example files —
grep process.env across apps/ and cross-reference against apps/api/.env.example,
apps/web/.env.example, and apps/portal/.env.example; (4) confirm migration numbering is strictly
sequential by listing supabase/migrations/ — no duplicate prefixes, no gaps; (5) run npm run test
and confirm passing count is ≥ the sprint baseline from MEMORY.md. Return the deploy check
verdict: CLEARED FOR DEPLOY or BLOCKED with specific blocking items."
```

Agent returns: Infrastructure validation verdict with specific blocking items if any.
Orchestrator: Combine automated check results (1–5) with agent's infrastructure verdict to produce the final deploy check report. Any hard block from either source stops the deploy.

## Context

$ARGUMENTS

## Checklist

### 1. Build Passes

```bash
npm run build
```

All 4 apps + 4 packages must compile. Zero build errors.

If any fail, stop here. Do not proceed to deploy.

### 2. Migration Numbering Is Sequential

```bash
ls supabase/migrations/ | sort
```

Check:

- No duplicate numeric prefixes (the Sprint 3 `00009_` duplicate must never recur)
- No gaps in the sequence
- New migrations are higher than all existing numbers

If duplicates exist, stop. The migration runner may execute them in wrong order.

### 3. Environment Variables Documented

For each new env var referenced in new/modified code:

```bash
grep -rn "process\.env\.\|env\." apps/ packages/ --include="*.ts" | \
  grep -v "NODE_ENV\|NEXT_PUBLIC" | grep "env\." | sort -u
```

Cross-reference against:

- `apps/api/.env.example`
- `apps/web/.env.example`
- `apps/portal/.env.example`

Any env var in code but not in `.env.example` = FAIL. Add it before deploying.

### 4. Render Health Check Responds (If API Is Live)

```bash
curl -s https://realflow-api.onrender.com/health
# Expected: {"status":"ok","service":"realflow-api"}
```

If the API is not yet deployed (first deploy), skip this check.

### 5. No console.log in New Production Code

```bash
git diff main...HEAD -- "*.ts" "*.tsx" | grep "^\+" | grep "console\.log"
```

Zero matches expected. `console.warn` and `console.error` are permitted.

### 6. No CRITICAL Harden Findings Open

Check `docs/harden/` for the latest report. If it contains any 🚨 CRITICAL findings marked as open, stop.

### 7. Tests Pass

```bash
npm run test
```

Passing count must be ≥ 606 (Sprint 4 baseline). Zero new failures.

## Output

```
## Deploy Check — [timestamp]

| Check | Status | Notes |
|-------|--------|-------|
| 1. Build | ✅ PASS | All packages compiled |
| 2. Migration sequencing | ✅ PASS | 000001–000014, no duplicates |
| 3. Env vars documented | ✅ PASS | |
| 4. Render health | ✅ PASS | {"status":"ok"} |
| 5. No console.log | ✅ PASS | |
| 6. No CRITICAL findings | ✅ PASS | Harden report clean |
| 7. Tests pass | ✅ PASS | 721/731 passing |

### Decision
CLEARED FOR DEPLOY ✅ / BLOCKED ❌ — fix items above
```

## Instructions

- Run all 7 checks even if earlier ones fail — produce a complete report
- Items 1, 2, 6, 7 are hard blocks — deploy cannot proceed
- Items 3, 4, 5 are soft blocks — proceed with explicit acknowledgement
- This check runs as the first step of `/deploy-staging` and `/deploy-production`
