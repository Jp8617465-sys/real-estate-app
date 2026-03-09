# RealFlow API Security Audit Report

**Date:** 2026-03-09
**Scope:** `apps/api/src/routes/` (38 route files) + supporting middleware/config
**Auditor:** Security Engineer Agent
**Branch:** sprint-5

---

## Executive Summary

The RealFlow API has a solid security foundation with several well-implemented controls:
- A correctly designed `createSupabaseClient` middleware that rejects missing/malformed JWTs before touching Supabase
- HMAC-SHA256 signature validation with timing-safe comparison on all webhook endpoints
- Zod input validation on all mutating routes
- No hardcoded production secrets found in source files
- Service-role client usage is largely confined to webhook/background handlers

However, several significant issues were identified, ranging from CRITICAL to LOW severity. The most serious is a group of user-facing route files that rely **exclusively on Supabase RLS** for access control with no application-layer ownership enforcement, creating IDOR risk if RLS policies are misconfigured or missing.

---

## Findings

### CRITICAL

---

#### C-1: `push-tokens.ts` — `userId` Accepted from Request Body, No Auth Verification

**File:** `apps/api/src/routes/push-tokens.ts` (lines 17–19)

**Description:** The `POST /push-tokens` route accepts a `userId` field directly from the request body and uses it to register the device token, without calling `supabase.auth.getUser()` to verify the caller's identity. An authenticated user can register push tokens under any arbitrary `userId`.

```typescript
// push-tokens.ts lines 7–40
fastify.post('/', async (request, reply) => {
  const supabase = createSupabaseClient(request);
  const parsed = RegisterPushTokenSchema.safeParse(request.body);
  // ...
  const body = request.body as Record<string, string | undefined>;
  const userId = body?.userId;   // <-- user-controlled, never verified against JWT

  if (!userId) return reply.status(400).send({ error: 'userId is required' });

  const { data, error } = await supabase
    .from('push_device_tokens')
    .upsert({ user_id: userId, token, ... })
```

**Impact:** An attacker can register another user's device token to their own account, redirect push notifications intended for another agent to their device, or inject arbitrary UUIDs into the `push_device_tokens` table.

**Remediation:** Remove `userId` from the accepted schema entirely. Resolve the `userId` from `supabase.auth.getUser()` and use that value when writing to the database.

---

#### C-2: `inbox.ts` — Multiple Routes Have No Auth Guard Whatsoever

**File:** `apps/api/src/routes/inbox.ts`

**Description:** `inbox.ts` contains 9 route handlers. Every handler calls `createSupabaseClient(request)` (which enforces that a Bearer token is present and well-formed), but **none of them call `supabase.auth.getUser()`**. This means:

1. The caller's identity is never verified against Supabase Auth — the JWT's claims (including `user_id` / `sub`) are never validated server-side on these routes.
2. Routes that update state (mark-as-read, soft-delete) apply mutations without confirming the caller owns the targeted records.
3. `POST /send` retrieves `agent_id` via `.from('users').select('id').single()` — a query with no `WHERE` clause, meaning it returns an arbitrary first user row rather than the authenticated agent.

Specific affected handlers:
- `GET /` (list threads) — filters by optional `agentId` query param, not by authenticated user
- `GET /contacts/:contactId` — returns all messages for any `contactId` without ownership check
- `GET /messages/:id` — returns any message by ID
- `POST /send` — resolves agent_id without auth verification (see line 121–124)
- `POST /contacts/:contactId/read` — marks all messages for a contact as read, no ownership check
- `POST /messages/:id/read` — marks any message as read by ID
- `GET /search` — searches across all messages, no agent scoping
- `GET /unread-counts` — no auth check
- `DELETE /messages/:id` — soft-deletes any message by ID

```typescript
// inbox.ts line 23-36 — no auth guard on list
fastify.get('/', async (request, reply) => {
  const supabase = createSupabaseClient(request);
  // No supabase.auth.getUser() call
  const filters = InboxFilterSchema.parse(request.query);
  let query = supabase.from('inbox_thread_summaries').select('*')...
```

```typescript
// inbox.ts lines 121-124 — agent ID from unbounded query
const { data: userData } = await supabase
  .from('users')
  .select('id')
  .single();   // <-- no WHERE clause; returns arbitrary row
```

**Impact:** Any authenticated user can read, mark, or delete messages belonging to other agents. The `POST /send` route attributes outbound messages to an arbitrary user rather than the authenticated sender.

**Remediation:** Add `supabase.auth.getUser()` at the top of every handler. Scope all queries to the authenticated `user.id`. Replace the unbounded `.from('users').select('id').single()` with the `user.id` from `getUser()`.

---

#### C-3: `workflows.ts` — No Auth Guard; `createdBy` Accepted from Request Body

**File:** `apps/api/src/routes/workflows.ts` (lines 29, 42)

**Description:** `workflows.ts` never calls `supabase.auth.getUser()`. The `createdBy` field in `CreateWorkflowBodySchema` and `CreateFromTemplateBodySchema` is a UUID accepted directly from the request body. Any authenticated user can create workflows attributed to any user ID, list all workflows without agent scoping, or delete any workflow by ID.

```typescript
const CreateWorkflowBodySchema = z.object({
  // ...
  createdBy: z.string().uuid(),   // <-- caller-supplied, never cross-checked with auth
});
```

**Impact:** Privilege escalation — a user can create automations on behalf of other agents. Unauthorized read/modify/delete access to all workflows in the system.

**Remediation:** Call `supabase.auth.getUser()` in every handler. Derive `createdBy` from `user.id`, never from the request body.

---

### HIGH

---

#### H-1: IDOR Risk — `contacts.ts`, `properties.ts`, `client-briefs.ts`, and Many Others Rely Solely on RLS with No Application-Layer Ownership Filter

**Files:**
- `apps/api/src/routes/contacts.ts`
- `apps/api/src/routes/properties.ts`
- `apps/api/src/routes/client-briefs.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/api/src/routes/settings.ts`
- `apps/api/src/routes/pipeline.ts`
- `apps/api/src/routes/pipeline-migration.ts`
- `apps/api/src/routes/offers.ts`
- `apps/api/src/routes/key-dates.ts`
- `apps/api/src/routes/due-diligence.ts`
- `apps/api/src/routes/fees.ts`
- `apps/api/src/routes/inspections.ts`
- `apps/api/src/routes/selling-agents.ts`
- `apps/api/src/routes/social-posts.ts`
- `apps/api/src/routes/follow-up-sequences.ts`
- `apps/api/src/routes/property-matches.ts`

**Description:** These 16 route files use `createSupabaseClient(request)` but never call `supabase.auth.getUser()` to resolve the authenticated user's ID, and never filter list/fetch queries by the authenticated agent. All access control is deferred entirely to Supabase Row Level Security.

This is the documented design pattern for this codebase and is safe **only if** RLS policies are correctly configured on every affected table. The risk is:
1. A missing or incomplete RLS policy on any table silently exposes all records to all authenticated users.
2. There is no defense-in-depth — if RLS is disabled (e.g., during a migration or by mistake), all data is immediately accessible to any authenticated caller.
3. PATCH/DELETE routes on resources like contacts, properties, and offers accept only an `id` URL param; without application-layer ownership verification, any authenticated user can modify/delete records owned by other agents if RLS fails.

Example in `contacts.ts` (GET by ID, no ownership filter):
```typescript
fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
  const supabase = createSupabaseClient(request);
  // No getUser() call; access control is entirely RLS-dependent
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();
```

Example in `client-briefs.ts` (GET list, no auth scoping):
```typescript
fastify.get<{ Querystring: { contactId?: string } }>('/', async (request, reply) => {
  const supabase = createSupabaseClient(request);
  // No getUser() call — returns all records filtered only by RLS
  let query = supabase
    .from('client_briefs')
    .select('*')
    .eq('is_deleted', false)
```

**Impact:** If any RLS policy is absent or incorrect, authenticated users can enumerate, read, modify, or delete records belonging to other agents. Client brief data contains sensitive financial and personal information (pre-approval amounts, broker details, AML status).

**Remediation (two-pronged):**
1. Audit every Supabase migration file to confirm RLS is `ENABLED` and policies exist for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on all affected tables.
2. For the highest-sensitivity tables (client_briefs, contacts, aml_checks), add application-layer auth guards that call `supabase.auth.getUser()` and explicitly filter by `assigned_agent_id = user.id`.

---

#### H-2: `webhooks.ts` — Domain Webhook Signature Check is Conditional; Meta Webhook Has No Rate Limiting

**File:** `apps/api/src/routes/webhooks.ts` (lines 40–48, 100–116)

**Description:** The `/domain/enquiry` webhook only validates the HMAC signature `if (env.DOMAIN_WEBHOOK_SECRET)` — if the secret is not configured, the endpoint accepts any payload without verification. The `/meta/lead` endpoint has the same conditional-secret pattern AND has no rate limiting, meaning it can be freely spammed to create arbitrary contact records.

```typescript
// webhooks.ts line 40-48
fastify.post('/domain/enquiry', async (request, reply) => {
  if (env.DOMAIN_WEBHOOK_SECRET) {  // Conditional: bypassed when secret not set
    const signature = request.headers['x-domain-signature'] as string;
    // ...
    if (!verifyDomainSignature(payload, signature, env.DOMAIN_WEBHOOK_SECRET)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }
  }
  // Falls through and creates a contact when no secret is configured
  const supabase = createSupabaseServiceClient();
  // ...inserts contact unconditionally
```

```typescript
// webhooks.ts lines 99-116
fastify.post('/meta/lead', async (request, reply) => {
  if (env.META_APP_SECRET) { ... } // Same conditional pattern
  // No rate limiting at all
  return { received: true }; // No data processing but no protection
```

**Impact:** In environments where `DOMAIN_WEBHOOK_SECRET` is not configured (development or a misconfigured staging/production), any unauthenticated actor can POST to `/webhooks/domain/enquiry` and create arbitrary contact records in the CRM. The Meta endpoint has no rate limiting.

**Remediation:**
- Change the signature check from conditional to required: reject with 401 if the secret is not configured at all (fail-closed rather than fail-open).
- Add IP-based rate limiting to `/meta/lead` matching the pattern used in `inbox-email.ts`.

---

#### H-3: `domain-sync.ts` — `/webhooks` Endpoint Signature Check Uses Empty String as HMAC Key When Secret is Unset

**File:** `apps/api/src/routes/domain-sync.ts` (lines 294–314)

**Description:** When `DOMAIN_WEBHOOK_SECRET` is not set in the environment, `secret` becomes an empty string `''`. The HMAC is then computed using an empty key:

```typescript
const secret = process.env['DOMAIN_WEBHOOK_SECRET'] ?? '';
// ...
const expected = crypto
  .createHmac('sha256', secret)  // empty string as HMAC key when unset
  .update(rawBody)
  .digest('hex');
```

An attacker who knows (or guesses) that the secret is empty can compute the correct HMAC for any payload and pass signature validation.

**Impact:** Unauthenticated actors can inject arbitrary Domain webhook events, causing the API to record false price changes or trigger unintended processing.

**Remediation:** Reject the request with 401 if `DOMAIN_WEBHOOK_SECRET` is not set, rather than defaulting to an empty key.

---

#### H-4: `portal.ts` — Service Role Key Instantiated Inline in a User-Facing Route

**File:** `apps/api/src/routes/portal.ts` (line 381)

**Description:** The `POST /portal/invite` route is a user-facing endpoint (requires agent JWT), but internally creates a second Supabase client using the service role key directly via `createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)` rather than the centralised `createSupabaseServiceClient()` factory.

```typescript
// portal.ts line 381
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
```

While functionally equivalent, this pattern is dangerous because:
1. It bypasses the project's established convention, making auditing harder.
2. The `createSupabaseServiceClient()` wrapper is the designated place to add future controls (e.g., logging, rate limiting, or environment guards).
3. An agent who can call this endpoint gains access to a code path that uses the service role — if future changes to this handler are not carefully reviewed, RLS bypass could be accidentally introduced.

**Impact:** Medium — currently contained to magic link generation, but represents a pattern that could spread incorrectly.

**Remediation:** Replace the inline `createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)` call with `createSupabaseServiceClient()`.

---

#### H-5: `social-leads.ts` — Webhook Endpoint Silently Skips Signature Verification When Secret Not Set

**File:** `apps/api/src/routes/social-leads.ts` (lines 14–28)

**Description:** The `POST /social/dms/ingest` webhook only validates the Meta HMAC signature when `env.META_APP_SECRET` is set. When it is not set, a `warn` log is emitted but the request is allowed through:

```typescript
if (env.META_APP_SECRET) {
  // ... HMAC verification ...
} else {
  fastify.log.warn('META_APP_SECRET not configured — skipping webhook signature verification');
}
// Falls through to process the DM lead regardless
```

**Impact:** Without `META_APP_SECRET` configured, any actor can POST arbitrary DM lead data and create contacts or trigger lead conversion flows with fabricated social profile data.

**Remediation:** Fail closed: return 401 if `META_APP_SECRET` is not configured, or document explicitly that deployment without this secret is only acceptable in local development.

---

### MEDIUM

---

#### M-1: `compliance.ts` — `POST /reports/generate` Does Not Use a Zod Schema for the Request Body

**File:** `apps/api/src/routes/compliance.ts` (lines 676–680)

**Description:** The `POST /reports/generate` endpoint casts the request body directly without Zod validation:

```typescript
const body = request.body as Record<string, unknown>;
const reportType = body.type as string;
const periodStart = body.periodStart as string;
const periodEnd = body.periodEnd as string;
```

Fields are only checked for truthiness, not validated for type, format, or allowed values. `reportType` is used directly in conditional branches without an allowlist, and date strings are passed directly to Supabase `.gte()` / `.lte()` queries without ISO date validation.

**Impact:** Invalid or unexpected `reportType` values produce incorrect query behavior. Malformed date strings could cause unexpected database errors whose messages leak schema details in the 500 response.

**Remediation:** Define a Zod schema (`GenerateReportBodySchema`) with `z.enum()` for `reportType` and `z.string().datetime()` or `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` for date fields. Call `.safeParse()` before processing.

---

#### M-2: `compliance.ts` — `PATCH/PUT /verifications/:id` Has No Ownership Verification

**File:** `apps/api/src/routes/compliance.ts` (lines 602–639)

**Description:** `PUT /verifications/:id` calls `getUser()` and confirms the caller is authenticated, but the Supabase `.update()` query is filtered only by `id` — there is no `.eq('agent_id', user.id)` filter. Any authenticated agent can update another agent's AML verification record if they know its UUID. The same issue exists for `PATCH /checks/:id` (lines 129–165), which also lacks an `agent_id` filter.

```typescript
// compliance.ts line 631-638
const { data, error } = await supabase
  .from('aml_checks')
  .update(payload)
  .eq('id', id)       // <-- only filtered by id, not agent_id
  .select()
  .single();
```

**Impact:** AML/KYC compliance records can be tampered with by authenticated agents who do not own them. This is a regulatory risk — AUSTRAC requires integrity of verification records.

**Remediation:** Add `.eq('agent_id', user.id)` to all `UPDATE` queries in the compliance routes and check the result row count to detect "not found or not owned" cases.

---

#### M-3: `inbox.ts` — Search Route Exposes Cross-Agent Message Content; No Agent Scoping

**File:** `apps/api/src/routes/inbox.ts` (lines 204–227)

**Description:** `GET /inbox/search?q=` queries `conversation_messages` with an `ilike` match on content text, returning results from all agents across the entire system (subject to RLS). There is no filter restricting results to the authenticated agent's conversations.

```typescript
const { data, error } = await supabase
  .from('conversation_messages')
  .select('*, contacts!inner(first_name, last_name)')
  .eq('is_deleted', false)
  .or(`content->>text.ilike.%${searchQuery}%,...`)  // no agent_id filter
```

The `searchQuery` value is interpolated directly into the Supabase `.or()` filter string. While Supabase ORM parameterises the final query, the filter string construction should be reviewed to confirm there is no string injection risk specific to the `.or()` helper syntax.

**Impact:** An authenticated agent can search and read conversation content belonging to other agents.

**Remediation:** Add `.eq('agent_id', user.id)` (after resolving via `getUser()`) to scope search results. Validate/sanitise the search query to strip Supabase PostgREST filter syntax characters before interpolation.

---

#### M-4: `market-data.ts` — `POST /refresh` and `POST /bulk-refresh` Use Service Client After User Auth Without Role Check

**File:** `apps/api/src/routes/market-data.ts` (lines 123–195)

**Description:** Both `/refresh` endpoints authenticate the user (correctly using `getUser()`), then immediately switch to a `createSupabaseServiceClient()` for the actual data refresh — bypassing RLS for writes to `market_data_snapshots`. There is no check that the authenticated user has an admin or elevated role; any authenticated agent can trigger a bulk refresh of all suburbs.

```typescript
// Verify authenticated user
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) { return reply.status(401)... }

// Use service-role client to bypass RLS for writes
const serviceSupabase = createSupabaseServiceClient();
const service = new MarketDataService(serviceSupabase);
const result = await service.bulkFetchAndUpsert(bodyParse.data.suburbs, ...);
```

**Impact:** Any authenticated agent can trigger potentially expensive bulk API calls to Domain.com.au (up to 50 suburbs per request, doubled for unit type), potentially exhausting API rate limits and incurring unexpected costs.

**Remediation:** Add a role check (e.g., verify the user has `is_admin = true` or `role = 'admin'` in the `users` table) before permitting access to the bulk refresh endpoints.

---

#### M-5: `health.ts` — `/health/ready` Uses Service Role Client and Leaks Memory Info Publicly

**File:** `apps/api/src/routes/health.ts` (lines 49–72, 100–114)

**Description:** The `/health/ready` endpoint uses `createSupabaseServiceClient()` to perform its connectivity check and returns detailed memory usage (RSS, heap used, heap total) in the response body. Both endpoints are unauthenticated by design (required by load balancers), but the readiness endpoint's response leaks operational details that are useful for an attacker performing reconnaissance.

**Impact:** Low-medium. An attacker can use heap memory values to detect service restart cycles and plan timing attacks. Use of the service-role client in a publicly accessible endpoint is a minor concern (no data is returned, only connectivity is tested).

**Remediation:** Remove `memory` from the public response body, or restrict the readiness endpoint to internal network access via network policy. The service client is acceptable here since no data is returned.

---

#### M-6: Rate Limiter and Idempotency Guard are In-Memory — Ineffective in Multi-Instance Deployments

**File:** `apps/api/src/middleware/webhook-validation.ts` (lines 115–157, 167–203)

**Description:** The `WebhookRateLimiter` and `IdempotencyGuard` classes use in-process `Map` instances. In a horizontally scaled deployment (multiple API replicas on Render), rate limiting and idempotency checks are per-instance only. The `prune()` method comment acknowledges this:

> "Not suitable for multi-instance deployments — replace with Redis-backed limiter in production at scale."

**Impact:** Webhook replay attacks and rate limit bypass are possible when the API runs on more than one instance.

**Remediation:** The codebase already has optional Redis support (`REDIS_URL` in env). Wire the rate limiter and idempotency guard to use Redis when `REDIS_URL` is configured. The `createWebhookGuards()` factory is the correct injection point.

---

### LOW

---

#### L-1: `apps/api/.env` is Committed with Non-Production Credentials

**File:** `apps/api/.env`

**Description:** The `.env` file is present in the repository at `apps/api/.env`. While its values appear to be localhost/development credentials (Supabase local dev keys starting with `sb_publishable_` and `sb_secret_`), the file itself is committed to the repository. The `.gitignore` at the root does list `.env`, but the file exists in the working tree.

```
SUPABASE_ANON_KEY=sb_publishable_[REDACTED]
SUPABASE_SERVICE_ROLE_KEY=sb_secret_[REDACTED]
```

**Impact:** Low in isolation (local dev keys). Risk escalates if `.env` is accidentally pushed to a public remote, or if developers copy this file pattern and commit production keys.

**Remediation:** Verify `apps/api/.env` is excluded from git history. Use `git ls-files apps/api/.env` to confirm it is not tracked. Rename to `.env.local` which is explicitly `.gitignore`d by convention. Ensure `.env.example` is the only committed template.

---

#### L-2: Supabase Personal Access Token Stored in `.claude/settings.local.json`

**File:** `.claude/settings.local.json`

**Description:** The Supabase personal access token `sbp_34f4264ef331d0ed7af8e8cb535943274f588ca1` is stored in multiple command-line entries in `.claude/settings.local.json`. This token provides full management access to the Supabase staging project.

**Impact:** If the `.claude/` directory is accidentally committed to a public or shared repository, the token is exposed. The token grants admin-level access to the staging database.

**Remediation:** Confirm `.claude/settings.local.json` is in `.gitignore`. Rotate the token after this audit. Use environment variables or a secrets manager instead of inlining tokens in config files.

---

#### L-3: `ai.ts` — `extractUserIdFromToken` Decodes JWT Without Signature Verification

**File:** `apps/api/src/routes/ai.ts` (lines 32–44)

**Description:** The `extractUserIdFromToken` function decodes the JWT payload locally (base64url decode) without verifying the signature, then uses the extracted `sub` claim as a rate-limiting key:

```typescript
function extractUserIdFromToken(request: FastifyRequest): string | null {
  const token = request.headers.authorization?.slice(7);
  // ...
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { sub?: string };
  return payload.sub ?? null;
}
```

The comment acknowledges this: "Supabase has already validated the token." This is correct — `createSupabaseClient(request)` has already rejected tokens without valid structure. However, the Supabase RLS validation happens lazily (on first DB query), not eagerly on client construction. For the `GET /ai/status` endpoint, `requireAuth` only checks for the presence of a `Bearer` prefix, not that the token is valid. A caller could forge a JWT payload with any `sub` value to manipulate rate limit accounting.

**Impact:** Low — rate limit bypass using a crafted token `sub`. Does not grant data access.

**Remediation:** Either call `supabase.auth.getUser()` on the `GET /ai/status` and `POST /extract-email-signals` endpoints to eagerly validate the token, or fall back to IP-based rate limiting when the token cannot be locally decoded.

---

#### L-4: `inbox.ts` — Search Query Interpolated into Supabase `.or()` Filter String

**File:** `apps/api/src/routes/inbox.ts` (lines 218–223)

**Description:** User-supplied search text is interpolated directly into a Supabase PostgREST filter string:

```typescript
.or(
  `content->>text.ilike.%${searchQuery}%,content->>subject.ilike.%${searchQuery}%`,
)
```

Supabase's JS client does not apply automatic escaping to `.or()` string arguments. If `searchQuery` contains PostgREST filter syntax characters (e.g., commas, dots, parentheses), it could distort the filter expression. This is distinct from SQL injection (PostgREST uses parameterised queries internally), but malformed filter strings may cause unexpected results or errors.

**Impact:** Low — no SQL injection risk, but potential for query manipulation or DoS via crafted search strings.

**Remediation:** Validate/strip the search query before interpolation (allow only alphanumeric, spaces, and basic punctuation). Consider using `.textSearch()` or `.ilike()` with separate column calls instead of string interpolation in `.or()`.

---

#### L-5: `notifications.ts` — `POST /:id/dismiss` and `POST /:id/snooze` Lack Ownership Filter

**File:** `apps/api/src/routes/notifications.ts` (lines 82–99, 103–124)

**Description:** The dismiss and snooze endpoints use `getUser()` for auth but filter their `UPDATE` queries only by `id`, not by `user_id`:

```typescript
// dismiss - line 88-98
const { error } = await supabase
  .from('notifications')
  .update({ status: 'dismissed', ... })
  .eq('id', id);   // No .eq('user_id', userId) filter

// snooze - line 110-118
const { data, error } = await supabase
  .from('notifications')
  .update({ status: 'snoozed', ... })
  .eq('id', id)   // No .eq('user_id', userId) filter
```

Any authenticated user can dismiss or snooze another user's notifications if they know the ID.

**Impact:** Low — notifications are not sensitive data, but this represents a pattern inconsistency with the `GET /` and `/unread-count` endpoints in the same file which do filter by `user_id`.

**Remediation:** Add `.eq('user_id', userId)` to the `UPDATE` queries in dismiss and snooze.

---

## Summary Table

| ID  | Severity | File(s) | Issue |
|-----|----------|---------|-------|
| C-1 | CRITICAL | `push-tokens.ts` | `userId` from request body, no auth verification |
| C-2 | CRITICAL | `inbox.ts` | No auth guard on any of 9 handlers; unbounded agent ID query |
| C-3 | CRITICAL | `workflows.ts` | No auth guard; `createdBy` from request body |
| H-1 | HIGH | 16 route files | IDOR risk — RLS-only access control, no app-layer ownership |
| H-2 | HIGH | `webhooks.ts` | Conditional signature validation (fail-open when secret unset) |
| H-3 | HIGH | `domain-sync.ts` | Empty string HMAC key when webhook secret unset |
| H-4 | HIGH | `portal.ts` | Service role key instantiated inline in user-facing route |
| H-5 | HIGH | `social-leads.ts` | Webhook skips signature verification when secret unset |
| M-1 | MEDIUM | `compliance.ts` | `POST /reports/generate` uses cast instead of Zod schema |
| M-2 | MEDIUM | `compliance.ts` | AML update/patch endpoints lack `agent_id` ownership filter |
| M-3 | MEDIUM | `inbox.ts` | Message search has no agent scoping |
| M-4 | MEDIUM | `market-data.ts` | Bulk refresh endpoints lack role/admin check |
| M-5 | MEDIUM | `health.ts` | Memory details exposed in public readiness endpoint |
| M-6 | MEDIUM | `webhook-validation.ts` | In-memory rate limiter/idempotency guard ineffective at scale |
| L-1 | LOW | `apps/api/.env` | `.env` file with credentials exists in working tree |
| L-2 | LOW | `.claude/settings.local.json` | Supabase PAT stored in Claude settings file |
| L-3 | LOW | `ai.ts` | JWT decoded without signature verification for rate limit key |
| L-4 | LOW | `inbox.ts` | Search query interpolated into PostgREST filter string |
| L-5 | LOW | `notifications.ts` | Dismiss/snooze lack `user_id` ownership filter |

---

## What is Working Well

1. **`createSupabaseClient` middleware** correctly rejects missing Bearer tokens and structurally malformed JWTs (non-3-part tokens) with 401 before any Supabase call is made. This prevents a class of 500 errors from leaking internal details.

2. **Domain webhook HMAC validation** (`domain-webhooks.ts`) correctly uses `crypto.timingSafeEqual` with length pre-check, and captures the raw body via `preParsing` hook before JSON parsing, ensuring the signature covers the exact bytes sent by Domain.

3. **`inbox-email.ts` webhook protection** implements IP-based rate limiting, idempotency guards, and per-provider signature validation correctly.

4. **Compliance routes** (`compliance.ts`) consistently call `supabase.auth.getUser()` and filter queries by `agent_id = user.id` on read operations, which is the correct pattern.

5. **`env.ts` configuration** validates all required env vars at startup using Zod, and provides sensible test defaults without leaking real credentials.

6. **No hardcoded production secrets** were found in any source file (`.ts`, `.js`). Test helper files use clearly labelled placeholder values (`'test-jwt-token'`, `'test-anon-key'`).

7. **Soft deletes everywhere** — the `is_deleted` / `deleted_at` pattern is consistent across all tables, providing an audit trail.

8. **Zod input validation** is present on all `POST` and `PATCH` routes in the newer route files (Sprint 5/6), using `safeParse()` and returning structured 400 errors.

---

## Recommended Remediation Priority

1. **Immediate (before next production deployment):**
   - C-1: Fix `push-tokens.ts` — derive `userId` from `getUser()`
   - C-2: Add `getUser()` to all `inbox.ts` handlers; fix unbounded `users.select('id').single()`
   - C-3: Add `getUser()` to all `workflow.ts` handlers; remove `createdBy` from request schema
   - H-2: Make `webhooks.ts` Domain/Meta signature validation fail-closed
   - H-3: Make `domain-sync.ts` webhook reject when `DOMAIN_WEBHOOK_SECRET` is unset
   - H-5: Make `social-leads.ts` DM ingest reject when `META_APP_SECRET` is unset

2. **Short-term (current sprint):**
   - H-1: Audit all 16 RLS-only route files; confirm RLS policies exist on all tables
   - H-4: Replace inline `createClient` call in `portal.ts` with `createSupabaseServiceClient()`
   - M-2: Add `agent_id` filter to AML update/patch endpoints
   - L-5: Add `user_id` filter to notification dismiss/snooze

3. **Medium-term:**
   - M-1: Add Zod schema to `POST /reports/generate`
   - M-3: Add agent scoping to inbox search; sanitise search query
   - M-4: Add admin role check to market data bulk refresh endpoints
   - M-6: Wire rate limiter/idempotency guard to Redis when `REDIS_URL` is set

4. **Operations:**
   - L-1: Remove `apps/api/.env` from working tree; ensure only `.env.example` is committed
   - L-2: Rotate the Supabase PAT found in `.claude/settings.local.json`
   - M-5: Strip `memory` from the public `/health/ready` response

---

*Report generated by Security Engineer Agent — RealFlow Audit 2026-03-09*
