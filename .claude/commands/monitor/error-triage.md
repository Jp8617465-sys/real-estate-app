# Error Triage

You are an **Error Triage Specialist** for RealFlow. Given an error message or log snippet, you identify the root cause and suggest a fix.

## Context

$ARGUMENTS

(Pass the error message, stack trace, or Render log snippet as `$ARGUMENTS`)

## Triage Process

### Step 1: Identify the Error Layer

```
DB Layer:        PostgrestError, PGRST codes, connection refused, SSL errors
Engine Layer:    TypeError in packages/business-logic/, ZodError, Failed to [action]
Route Layer:     FastifyError, validation error, 500 in apps/api/src/routes/
Client Layer:    Network error, CORS error, 401/403 responses in browser console
Mobile Layer:    RN red screen, Expo error, Metro bundler errors
Build Layer:     TypeScript errors, tsc compilation failures, turbo build errors
```

### Step 2: Check Known Pre-Existing Issues

**Do NOT raise these as new bugs** — they are known and tracked in MEMORY.md:

| Error Pattern | Location | Known Issue |
|---|---|---|
| `isDigestItem` type mismatch | `apps/api/src/services/workflow-scheduler.ts` | Pre-existing TypeScript error, Sprint 3 |
| `PostgrestQueryBuilder` generic | `apps/api/src/routes/` | Pre-existing type error, not runtime |
| `rootDir` error | `apps/api/src/services/workflow-engine.ts` | Pre-existing build config issue |
| 7 failing tests | `packages/business-logic/src/pipeline-migration.test.ts` | Pre-existing mock setup |
| 2 failing tests | `packages/integrations/src/integration-registry.test.ts` | Arrow fn mock constructor |
| 1 failing test | `apps/api/src/routes/social-posts.test.ts` | Same constructor issue |

If the error matches a known issue, note it and move on.

### Step 3: Root Cause Analysis

Based on the error layer and message, identify:

1. **Most likely cause** — what specific code or config is the problem?
2. **Relevant files** — which files should be read to investigate?
3. **Reproduction steps** — how to reproduce reliably?

### Common Error Patterns

**`ECONNREFUSED 127.0.0.1:54321`**
Cause: Supabase local instance not running
Fix: `supabase start` — or, in production, check `SUPABASE_URL` points to production not localhost

**`JWSInvalidSignature` / `invalid JWT`**
Cause: JWT token issued by wrong Supabase project (staging JWT against production API)
Fix: Ensure client and API use the same Supabase project URL and anon key

**`PGRST116: Row not found`**
Cause: Record doesn't exist or is soft-deleted (deleted_at IS NOT NULL)
Fix: Check if the record was soft-deleted; query should return 404 not 500

**`relation "table_name" does not exist`**
Cause: Migration not applied to this Supabase project
Fix: `npm run db:migrate` against the correct project

**`ZodError: Required at "field_name"`**
Cause: API request missing a required field, or DB response missing a column
Fix: Check schema, add missing field to request or update Zod schema

**`Cannot read properties of undefined (reading 'X')`**
Cause: Supabase query returned `null` data but code didn't handle it
Fix: Add null check before accessing `.data`

**Render `build_failed` — `Cannot find module`**
Cause: Missing package or incorrect import path in monorepo
Fix: Check `tsconfig.json` paths aliases and `npm install` ran from root

**Render `update_failed` after build succeeded**
Cause: Runtime crash on startup (port conflict, missing env var, DB connection fail)
Fix: Check Render deploy logs for the startup error; verify env vars set in Render dashboard

## Output

```
## Error Triage — [timestamp]

### Input
[paste of error message]

### Layer
API Route layer — Fastify handler

### Known Issue?
No — this is a new error

### Root Cause
Missing SUPABASE_URL environment variable in Render production service.
The API is falling back to localhost:54321 which doesn't exist in production.

### Evidence
Error: ECONNREFUSED 127.0.0.1:54321
This is the default from apps/api/.env (local dev value)

### Relevant Files
- apps/api/src/index.ts — where Supabase client is initialised
- apps/api/.env.example — check SUPABASE_URL is documented

### Fix
1. Go to Render dashboard → realflow-api → Environment
2. Add: SUPABASE_URL=https://[your-project].supabase.co
3. Add: SUPABASE_ANON_KEY=[your-anon-key]
4. Save → Render auto-deploys

### Verification
After fix: run /smoke-test https://realflow-api.onrender.com
Expected: Test 4 (contacts endpoint) passes
```

## Instructions

- Always check against the known pre-existing issues list first
- Be specific about which file and line to investigate
- If the fix requires a deploy, include the deploy command sequence
- If unsure of root cause, list the top 2–3 hypotheses with evidence for each
