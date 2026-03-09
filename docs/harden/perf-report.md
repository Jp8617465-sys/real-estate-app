# RealFlow Performance Audit Report

**Date:** 2026-03-09
**Audited by:** Performance Engineer (Claude Sonnet 4.6)
**Scope:** apps/api/src/routes/, packages/business-logic/src/, supabase/migrations/, packages/integrations/src/, apps/portal/src/hooks/, apps/mobile/src/hooks/, apps/web/ and apps/portal/ bundle deps

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 5     |
| MEDIUM   | 6     |
| LOW      | 4     |

---

## CRITICAL

### CRIT-1: N+1 contact fetch inside workflow dispatch loop

**File:** `apps/api/src/routes/workflows.ts` — lines 399–442

**Pattern:** The `POST /workflows/dispatch` handler loads all active workflows with one query, then enters a `for...of` loop over every matching workflow. Inside that loop, if the event has a `contactId`, it executes a fresh `supabase.from('contacts').select('*').eq('id', event.contactId).single()` call **per workflow iteration**.

```typescript
// workflows.ts:399
for (const wf of workflows) {
  // ...trigger evaluation...
  if (event.contactId) {
    const { data: contact } = await supabase   // <-- DB hit per workflow
      .from('contacts')
      .select('*')
      .eq('id', event.contactId)
      .single();
  }
  // ...then runs the workflow
}
```

**Impact:** If 20 active workflows match a `stage_change` event, this issues 20 identical contact fetches. Each Supabase round-trip to a Render Sydney instance adds ~5–15 ms, producing 100–300 ms of avoidable latency on every dispatch call. The `/dispatch` endpoint is called synchronously from the mobile and web clients on every stage transition.

**Fix:** Fetch the contact once before the loop and re-use the value inside. Move the contact lookup to immediately after `event.contactId` is confirmed non-null, before the `for...of` block begins.

---

### CRIT-2: N+1 subscription fetch inside `handlePriceChange` loop

**File:** `packages/business-logic/src/property-alert-engine.ts` — lines 259–308

**Pattern:** `handlePriceChange` first fetches all active `property_matches` for the changed property (correct). It then enters a `for...of` loop over those matches and, **inside the loop**, queries `property_alert_subscriptions` for each match's `brief_id`:

```typescript
// property-alert-engine.ts:259
for (const match of matches) {
  const { data: subsData } = await this.supabase   // <-- DB hit per match
    .from('property_alert_subscriptions')
    .select('*')
    .eq('brief_id', match.brief_id)
    .eq('is_active', true)
    .is('deleted_at', null);
  // ...
  for (const subRow of subs) {
    // ...dispatch and log event (two more DB inserts per sub)
  }
}
```

For a high-demand suburb (e.g., 10 active matches), this generates 10 subscription queries + up to 10×N insert calls. The dispatch and `property_alert_events` inserts inside the inner loop compound the problem.

**Impact:** A single price change event on a popular listing can trigger 30–50+ sequential DB round-trips, stalling the event pipeline and delaying push notifications to agents.

**Fix:** Collect all `brief_id` values from `matches` into an array, fetch subscriptions in a single `.in('brief_id', briefIds)` query, then group results by `brief_id` in memory before dispatching.

---

### CRIT-3: N+1 snapshot writes in `snapshotTeamPerformance`

**File:** `packages/business-logic/src/team-engine.ts` — lines 177–244

**Pattern:** `snapshotTeamPerformance` iterates over every active agent in the office. For each agent it executes **5 sequential DB queries** (active contacts count, active deals count, deals closed count, leads received count, leads converted count) plus 1 upsert — 6 DB round-trips per agent:

```typescript
// team-engine.ts:183
for (const member of members) {
  const { count: activeContacts } = await this.db.from('contacts')...   // hit 1
  const { count: activeDeals }    = await this.db.from('transactions')... // hit 2
  const { count: dealsClosed }    = await this.db.from('transactions')... // hit 3
  const { count: leadsReceived }  = await this.db.from('social_dm_leads')... // hit 4
  const { count: leadsConverted } = await this.db.from('social_dm_leads')... // hit 5
  await this.db.from('team_performance_snapshots').upsert(...)           // hit 6
}
```

For an office with 15 agents this is 90 sequential round-trips. This runs as a daily cron — but if called via an HTTP endpoint during business hours it can hold a Fastify worker for several seconds.

**Fix:** (a) Parallelize the 5 count queries per agent with `Promise.all`. (b) Batch-upsert all agent rows in a single `upsert([...rows])` call after the loop. This reduces round-trips from 6N to 5 + 1 (counts in parallel) or closer to O(1) with aggregation SQL.

---

## HIGH

### HIGH-1: Duplicate detection fetches entire contacts table without limit

**File:** `apps/api/src/routes/contacts.ts` — lines 66–69

**Pattern:** On every `POST /contacts` (contact creation), the route fetches every non-deleted contact in the database to run in-memory duplicate detection:

```typescript
// contacts.ts:66
const { data: existing } = await supabase
  .from('contacts')
  .select('id, first_name, last_name, email, phone, secondary_phone')
  .eq('is_deleted', false);   // no .limit() — full table scan
```

**Impact:** At 10 000 contacts this transfers ~60 KB of data per contact creation. At 100 000 contacts (~600 KB) this will noticeably slow every lead capture. Because the CLAUDE.md target is < 60 s from enquiry to agent notification, this is a bottleneck on the critical path.

**Fix:** Push candidate filtering to the database. Use PostgreSQL's `pg_trgm` trigram index (already enabled in migration 00001) to find contacts with a similar name or exact email/phone match before loading them. A targeted query — `WHERE email = $1 OR phone = $1 OR similarity(first_name || ' ' || last_name, $2) > 0.6` — would return at most a handful of candidates rather than the entire table.

---

### HIGH-2: `GET /workflows/dispatch` and `GET /workflows/evaluate` load all active workflows without limit

**File:** `apps/api/src/routes/workflows.ts` — lines 385–395 and 342–346

**Pattern:** Both endpoints load every active, non-deleted workflow row:

```typescript
// workflows.ts:386
const { data: workflows } = await supabase
  .from('workflows')
  .select('*')
  .eq('is_active', true)
  .eq('is_deleted', false);   // no .limit()
```

There is no limit, no cursor, and no pagination. As the workflow count grows — especially after agents create team templates — this will return progressively larger payloads and take longer to scan in memory.

**Fix:** Add `.limit(500)` as a safety ceiling and log a warning when the count approaches it. Longer term, pre-filter in the database by indexing `trigger->>'type'` as a generated column so only workflows with a matching trigger type are loaded.

---

### HIGH-3: `GET /pipeline` loads all transactions for a pipeline type without pagination

**File:** `apps/api/src/routes/pipeline.ts` — lines 8–24
**Also:** `apps/mobile/src/hooks/use-pipeline.ts` — lines 5–25

**Pattern:** Both the route and the mobile hook query the full `transactions` table for a pipeline type with no `.limit()`:

```typescript
// pipeline.ts:12
const { data, error } = await supabase
  .from('transactions')
  .select(`*, contact:contacts(...), property:properties(...)`)
  .eq('pipeline_type', pipelineType)
  .eq('is_deleted', false)
  .order('updated_at', { ascending: false });   // no limit
```

The join to `contacts` and `properties` multiplies the response size. An agency with 200 active buyer transactions will transfer a large payload on every pipeline view. The mobile hook renders this directly in a Kanban board.

**Fix:** Add `.limit(100)` on the server route and implement cursor-based pagination. The mobile hook should pass a `limit` parameter and load more on scroll.

---

### HIGH-4: No `staleTime` on high-frequency mobile hooks — causes waterfall re-fetches

**Files:**
- `apps/mobile/src/hooks/use-contacts.ts` — `useContacts`, `useContact`
- `apps/mobile/src/hooks/use-pipeline.ts` — `usePipeline`
- `apps/mobile/src/hooks/use-properties.ts` — `useProperties`, `useProperty`
- `apps/mobile/src/hooks/use-dashboard.ts` — `useDashboardStats`
- `apps/portal/src/hooks/use-portal-properties.ts` — `usePortalProperties`
- `apps/portal/src/hooks/use-portal-dashboard.ts` — `usePortalDashboard`

**Pattern:** None of these hooks set `staleTime`. React Query's default `staleTime` is `0`, meaning every component mount triggers a background refetch even if data was just loaded milliseconds ago. When the mobile pipeline screen mounts, it calls `usePipeline` (no staleTime) at the same time as `useDashboardStats` (no staleTime), leading to duplicated simultaneous requests and visible loading states on navigation.

**Contrast:** The correctly configured hooks are `useOffMarketProperties` (`staleTime: 60_000`) and `useOffMarketStats` (`staleTime: 300_000`) in `apps/mobile/src/hooks/use-off-market.ts`.

**Fix:** Apply appropriate staleTime values:
- `useDashboardStats`: `staleTime: 60_000` (1 minute — counts change slowly)
- `usePipeline`: `staleTime: 30_000`
- `useContacts`: `staleTime: 30_000`
- `useProperties`: `staleTime: 60_000`
- `usePortalDashboard`: `staleTime: 30_000`
- `usePortalProperties`: `staleTime: 30_000`

---

### HIGH-5: Meta and Twilio `fetch()` calls have no timeout

**Files:**
- `packages/integrations/src/meta/client.ts` — `request()` method
- `packages/integrations/src/twilio/client.ts` — `request()` method

**Pattern:** Both clients use bare `fetch()` with no `signal` or `AbortController` timeout:

```typescript
// meta/client.ts:35
const response = await fetch(url.toString(), {
  ...options,
  headers: { ... },
});   // no AbortController, no timeout
```

Node.js `fetch` has no built-in connection timeout (it can hang indefinitely on a stalled socket). If Meta or Twilio returns a slow response or a half-open TCP connection, the Fastify worker handling an inbox send or social post will be held indefinitely. This can exhaust the Node.js event loop under concurrent load.

**Contrast:** `DomainClient` and `AnthropicClient` implement rate limiting and retry logic, but they also have no per-request `AbortSignal` timeout on the underlying `fetch()` call, though their retry-on-429 logic partially mitigates this.

**Fix:** Wrap every `fetch()` call with an `AbortController` signal and a configurable timeout (e.g. 10 s for Meta/Twilio, 30 s for Domain, 60 s for Anthropic given AI latency):

```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
try {
  const response = await fetch(url, { ...options, signal: controller.signal });
  // ...
} finally {
  clearTimeout(timer);
}
```

---

## MEDIUM

### MED-1: `usePortalMessages` polls every 30 s without limit — unbounded message fetch

**File:** `apps/portal/src/hooks/use-portal-messages.ts` — lines 35–43

**Pattern:** Fetches all messages for a contact with no `.limit()`, then re-fetches every 30 seconds via `refetchInterval`. A long-running portal client with 6 months of messages could accumulate thousands of rows.

**Fix:** Add `.limit(100)` with oldest-first ordering and implement infinite scroll / "load earlier" pagination. Also consider switching to Supabase Realtime subscription instead of polling to eliminate the 30 s interval overhead entirely.

---

### MED-2: `useNotifications` polls every 15–30 s; `useUnreadCount` polls every 15 s

**File:** `apps/mobile/src/hooks/use-notifications.ts` — lines 27 and 43

**Pattern:** `useNotifications` polls every 30 s; `useUnreadCount` polls every 15 s. Both make authenticated HTTP requests to the API on every tick, even when the app is in the background. On a slow AU mobile connection this can contribute to battery drain and background data usage.

**Fix:** Replace the polling approach with Supabase Realtime (`useRealtimeNotifications.ts` already exists in the mobile hooks directory — it should be the primary mechanism). Retain polling only as a fallback with a longer interval (120 s).

---

### MED-3: `property_matches` list query has no limit and no status filter by default

**File:** `apps/api/src/routes/property-matches.ts` — lines 14–27

**Pattern:** `GET /property-matches` applies no `.limit()` when neither `clientBriefId` nor `clientId` is provided. A superadmin or misconfigured client could inadvertently load all matches in the system.

**Fix:** Apply a default `.limit(200)` and require at least one filter parameter (return 400 if neither is provided).

---

### MED-4: `workflow_dead_letters` and `workflow_runs` endpoints have no limit

**File:** `apps/api/src/routes/workflows.ts` — lines 291–305 and 218–227

**Pattern:** `GET /workflows/dead-letters` and `GET /:id/runs` load all rows for the respective table/workflow with no pagination or limit. In a production system with many workflow failures or a long-running workflow, these could return very large response payloads.

**Fix:** Add `.limit(100)` and accept `limit`/`offset` query parameters on both endpoints.

---

### MED-5: `property_alert_engine.dispatch()` makes per-channel user lookup queries

**File:** `packages/business-logic/src/property-alert-engine.ts` — lines 328–383

**Pattern:** Inside `dispatch()`, for each delivery channel (`push`, `email`, `sms`) a separate DB query fetches the agent's token or contact details. When an agent subscribes to all three channels, three sequential DB round-trips are made per agent per alert.

**Fix:** Denormalize the agent's push token, email, and phone into the subscription row at subscription creation/update time, or batch-fetch agent details (users + push tokens) once before the dispatch loop using a single JOIN query.

---

### MED-6: `framer-motion` imported in both `apps/web` and `apps/portal` without dynamic import guard

**Files:** `apps/web/package.json` and `apps/portal/package.json`

**Pattern:** `framer-motion@^11.18.2` is a dependency in both Next.js apps. The full `framer-motion` bundle is approximately 100 KB gzipped. If it is imported at the module level in page or layout components (e.g., `import { motion } from 'framer-motion'`), it is included in the initial JS bundle for every page, increasing Time to Interactive.

**Fix:** Audit usage and either (a) use `dynamic(() => import('framer-motion'), { ssr: false })` for animation-heavy components that are below the fold, or (b) use the lighter `@motionone/dom` for simple CSS-based transitions that do not need React bindings.

---

## LOW

### LOW-1: `DomainClient.authenticate()` uses in-memory token cache — not process-safe on multi-instance deploys

**File:** `packages/integrations/src/domain/client.ts` — lines 92–117

**Pattern:** The OAuth2 token is cached in an instance variable (`this.accessToken`). When the API scales to multiple Render instances, each instance will independently request a new Domain API token on startup and after expiry, multiplying token requests and potentially hitting Domain's rate limits on the auth endpoint.

**Fix:** Store the token in Redis (the project already has Redis wired as a caching layer based on the `REDIS_URL` env var reference in other config). Fall back to in-memory if Redis is unavailable.

---

### LOW-2: `AnthropicClient` request timestamp array grows unbounded between GC cycles

**File:** `packages/integrations/src/ai/client.ts` — lines 474–486

**Pattern:** `enforceRateLimit()` filters `requestTimestamps` to remove entries older than 60 seconds. However, in a long-running process with sustained AI traffic, the array is rebuilt on every call. This is not a memory leak per se, but it causes a linear scan proportional to `rateLimitPerMinute` (default 50) on every AI request.

**Fix:** Use a circular buffer or a sliding window with a deque (e.g., `Array.shift()` + `Array.push()`) to avoid repeated filter scans. This is low-priority given the 50-request limit.

---

### LOW-3: `contacts.ts` route uses `.select('*')` on list and detail endpoints

**File:** `apps/api/src/routes/contacts.ts` — lines 12–14 and 44–47

**Pattern:** Both the list and single-contact endpoints use `.select('*')`, pulling all 30+ columns including large JSONB fields (`buyer_profile`, `seller_profile`) even when callers only need name, phone, and email.

**Fix:** Define a projection constant for the list endpoint (e.g., `id, first_name, last_name, phone, email, types, lead_score, assigned_agent_id, tags, updated_at`) and use `.select('*')` only on the single-contact detail endpoint.

---

### LOW-4: Missing composite index on `property_matches` for the most common query

**Files:** `supabase/migrations/00003_buyers_agent_tables.sql` — lines 382–386

**Pattern:** Individual indexes exist on `client_brief_id`, `property_id`, `client_id`, `status`, and `overall_score`. However, the most common access pattern from `usePortalProperties` and the `/property-matches` route is `WHERE client_id = $1 ORDER BY overall_score DESC`, which requires PostgreSQL to intersect the `client_id` index and then sort. A composite index would avoid the sort step.

**Fix:** Add a new migration with:

```sql
CREATE INDEX IF NOT EXISTS idx_property_matches_client_score
  ON property_matches (client_id, overall_score DESC)
  WHERE status NOT IN ('rejected', 'purchased');
```

---

## Positive Findings (No Action Required)

The following areas were audited and found to be well-implemented:

- **Core table indexes** (`contacts`, `properties`, `transactions`, `activities`): Comprehensive partial indexes covering the most common filter columns (`assigned_agent_id`, `pipeline_type`, `listing_status`) with `WHERE NOT is_deleted` predicates are present in `00001_initial_schema.sql`. These align exactly with the query patterns in the route files.
- **Inbox thread query**: `GET /inbox` uses the `inbox_thread_summaries` view and applies `.limit(50)` — correct.
- **`SocialLeadEngine.listLeads`**: Correctly uses `.range()` with configurable offset and limit — good pagination pattern.
- **`TeamEngine.getTeamPerformance`**: Correctly uses a single batch query with `.in('id', agentIds)` for user name resolution — no N+1.
- **`PropertyAlertEngine.getAlertEvents`**: Two-query pattern (subscriptions then events with `.in('subscription_id', subIds)`) is correct and avoids N+1.
- **`DomainClient`**: Implements token bucket rate limiting, per-path TTL caching, and a 429 retry mechanism.
- **`AnthropicClient`**: Implements exponential backoff with jitter on 429/529, rate limit enforcement, and cost tracking.
- **React Query `useOffMarketProperties`** and **`useOffMarketStats`**: Both correctly configure `staleTime` — these are the pattern all other hooks should follow.
- **Off-market and social lead migrations** (`00020`, `00021`): Both include appropriate partial composite indexes for the expected query patterns.

---

## Recommended Fix Priority

| Priority | Item | Estimated Effort |
|----------|------|-----------------|
| 1 (this sprint) | CRIT-1: workflow dispatch N+1 contact fetch | 30 min |
| 2 (this sprint) | HIGH-1: contacts duplicate detection full-table scan | 2 h |
| 3 (this sprint) | HIGH-4: add staleTime to all React Query hooks missing it | 1 h |
| 4 (this sprint) | HIGH-5: add AbortController timeouts to Meta + Twilio fetch | 1 h |
| 5 (next sprint) | CRIT-2: price change alert N+1 subscription fetches | 2 h |
| 6 (next sprint) | CRIT-3: team snapshot — parallelize counts + batch upsert | 2 h |
| 7 (next sprint) | HIGH-2 + HIGH-3: limits on workflow/pipeline queries | 1 h |
| 8 (backlog) | MED-1 through MED-6 | varies |
| 9 (backlog) | LOW-1 through LOW-4 | varies |
