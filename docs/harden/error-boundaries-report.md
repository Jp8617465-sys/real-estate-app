## Error Boundary Audit — 2026-03-09

Scope: Sprint 5 + Sprint 6 new code only. Existing pre-Sprint-5 routes and engines are out of scope except where a new Sprint 6 pattern reveals a system-wide gap.

---

### ERR-001 CRITICAL — No `request.log.error` call in any catch-all handler across all new routes

File: `apps/api/src/routes/social-leads.ts:40-42`, `apps/api/src/routes/off-market.ts:26-28`, `apps/api/src/routes/team.ts:33-35`, `apps/api/src/routes/alerts.ts:26-28`, `apps/api/src/routes/portal.ts` (multiple handlers)

Issue: Every catch-all block in every Sprint 5/6 route returns `reply.status(500).send(...)` but never calls `request.log.error(err, ...)`. Fastify's structured logger is the only mechanism wiring to production log aggregation (Render log drains, DataDog, etc.). Silent 500s are invisible in production.

Fix: Replace the catch-all pattern in each route. Example applied to `social-leads.ts` `POST /social/dms/ingest`:

```typescript
// BEFORE
} catch (err) {
  return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
}

// AFTER (apply this pattern to every catch block in all new routes)
} catch (err) {
  request.log.error({ err }, 'Unhandled error in POST /social/dms/ingest');
  return reply.status(500).send({ error: 'Internal server error' });
}
```

Apply the same substitution to:
- `social-leads.ts` lines 40, 65, 111, 130, 153
- `off-market.ts` lines 26, 56, 74, 116, 134, 152, 171, 194, 217
- `team.ts` lines 33, 58, 79, 105, 128, 146, 173, 194, 212, 230
- `alerts.ts` lines 26, 52, 138, 221
- `portal.ts` lines (all 500 returns not already inside named error paths)

---

### ERR-002 CRITICAL — `GET /social/leads/:id` and `GET /off-market/:id` swallow all errors as 404

File: `apps/api/src/routes/social-leads.ts:85-87`, `apps/api/src/routes/off-market.ts:93-95`

Issue: Both `getById` handlers use a bare `catch { return reply.status(404)... }` with no binding of the error variable. This means DB connection failures, Supabase timeouts, and permissions errors are all reported to the client as "not found". A 500-class error is silently converted to a 404, masking real failures and making debugging impossible.

Fix:

```typescript
// social-leads.ts GET /social/leads/:id — replace lines 81-88:
const engine = new SocialLeadEngine(supabase);
try {
  const lead = await engine.getById(request.params.id);
  if (lead.agentId !== user.id) return reply.status(403).send({ error: 'Forbidden' });
  return { data: lead };
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  request.log.error({ err }, 'Error in GET /social/leads/:id');
  if (msg.toLowerCase().includes('not found') || (err as { code?: string }).code === 'PGRST116') {
    return reply.status(404).send({ error: 'Lead not found' });
  }
  return reply.status(500).send({ error: 'Internal server error' });
}
```

```typescript
// off-market.ts GET /off-market/:id — replace lines 88-95:
const engine = new OffMarketEngine(supabase);
try {
  const property = await engine.getById(request.params.id);
  if (property.agentId !== user.id) return reply.status(403).send({ error: 'Forbidden' });
  return { data: property };
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  request.log.error({ err }, 'Error in GET /off-market/:id');
  if (msg.toLowerCase().includes('not found') || (err as { code?: string }).code === 'PGRST116') {
    return reply.status(404).send({ error: 'Off-market property not found' });
  }
  return reply.status(500).send({ error: 'Internal server error' });
}
```

---

### ERR-003 CRITICAL — No `error.tsx` exists anywhere in the portal app

File: `apps/portal/src/app/` (entire directory tree)

Issue: The portal has zero `error.tsx` files. Next.js App Router requires `error.tsx` boundaries at the segment level to catch thrown errors in `page.tsx` components. Without them, an unhandled error in any portal page bubbles all the way to the root `not-found.tsx` or crashes the entire render, displaying a blank page to the client. The portal is a client-facing product — a white screen on document load is a critical UX failure.

Fix: Create `error.tsx` at the root of the portal app and inside the `(dashboard)` route group. The portal is in `apps/portal/src/app/`.

```typescript
// File: apps/portal/src/app/error.tsx  (NEW FILE)
'use client';

import { useEffect } from 'react';

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function PortalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Portal Error]', error.message, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-gray-500">
        We could not load this page. Please try again.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-4 max-w-lg rounded bg-red-50 p-3 text-left text-xs text-red-700">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-portal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-portal-700"
      >
        Try again
      </button>
    </div>
  );
}
```

```typescript
// File: apps/portal/src/app/(dashboard)/error.tsx  (NEW FILE)
// Identical content to apps/portal/src/app/error.tsx above.
// The (dashboard) route group has its own layout, so it needs its own boundary.
'use client';

import { useEffect } from 'react';

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Portal Dashboard Error]', error.message, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-gray-500">
        We could not load this page. Please try again.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-4 max-w-lg rounded bg-red-50 p-3 text-left text-xs text-red-700">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-portal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-portal-700"
      >
        Try again
      </button>
    </div>
  );
}
```

---

### ERR-004 CRITICAL — No `error.tsx` for new Sprint 6 web route segments

Files: `apps/web/src/app/social/leads/page.tsx`, `apps/web/src/app/buyers-agent/off-market/page.tsx`, `apps/web/src/app/team/page.tsx`, `apps/web/src/app/team/performance/page.tsx`, `apps/web/src/app/team/assignment-rules/page.tsx`, `apps/web/src/app/team/templates/page.tsx`, `apps/web/src/app/social/analytics/page.tsx`

Issue: The web app has only a single root-level `error.tsx`. All Sprint 6 route segments (`/social/leads`, `/buyers-agent/off-market`, `/team/*`, `/social/analytics`) have no segment-level `error.tsx`. The root boundary catches them but renders a full-screen takeover that tears down the entire layout, disrupting the nav bar and forcing a full reload. Segment-level boundaries allow in-place recovery.

Fix: Create `error.tsx` in each new Sprint 6 directory. Example for `social/leads`:

```typescript
// File: apps/web/src/app/social/leads/error.tsx  (NEW FILE)
'use client';

import { useEffect } from 'react';

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function SocialLeadsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[SocialLeads Error]', error.message);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <h2 className="text-lg font-semibold text-gray-900">Unable to load social leads</h2>
      <p className="mt-1 text-sm text-gray-500">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
```

Apply an equivalent `error.tsx` to:
- `apps/web/src/app/buyers-agent/off-market/error.tsx`
- `apps/web/src/app/team/error.tsx`
- `apps/web/src/app/social/analytics/error.tsx`
- `apps/web/src/app/alerts/error.tsx` (Sprint 5)

---

### ERR-005 HIGH — No PGRST116 differentiation in any engine `getById` method

Files: `packages/business-logic/src/social-lead-engine.ts:221-229`, `packages/business-logic/src/off-market-engine.ts:401-409`, `packages/business-logic/src/team-engine.ts:343-349`, `packages/business-logic/src/portal-engine.ts:83-98`

Issue: None of the new Sprint 5/6 engine `getById` methods distinguish Supabase's PGRST116 "not found" code from genuine database errors. The PGRST116 code is the canonical Supabase signal that `.single()` returned zero rows. Without this check, a missing record and a DB connection failure produce the same thrown error, which causes the route layer to return 500 for what is semantically a 404. The requirement says engines must return `null` for PGRST116.

Fix (apply to all `getById` methods):

```typescript
// packages/business-logic/src/social-lead-engine.ts — replace getById (lines 220-230):
async getById(leadId: string): Promise<SocialDmLead | null> {
  const { data, error } = await this.db
    .from('social_dm_leads')
    .select('*')
    .eq('id', leadId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch lead: ${error.message}`);
  }
  return mapRow(data as SocialDmLeadRow);
}
```

```typescript
// packages/business-logic/src/off-market-engine.ts — replace getById (lines 400-410):
async getById(propertyId: string): Promise<OffMarketProperty | null> {
  const { data, error } = await this.db
    .from('off_market_properties')
    .select('*')
    .eq('id', propertyId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch off-market property: ${error.message}`);
  }
  return mapProperty(data as OffMarketPropertyRow);
}
```

```typescript
// packages/business-logic/src/team-engine.ts — replace assignLead contact fetch (lines 343-349):
const { data: contact, error: contactErr } = await this.db
  .from('contacts')
  .select('id, lead_source, buyer_profile')
  .eq('id', contactId)
  .single();

if (contactErr) {
  if (contactErr.code === 'PGRST116') return null; // contact not found — no assignment
  throw new Error(`Contact fetch failed: ${contactErr.message}`);
}
```

```typescript
// packages/business-logic/src/portal-engine.ts — replace getPortalClient (lines 82-99):
async getPortalClient(authId: string): Promise<PortalClient | null> {
  const { data, error } = await this.supabase
    .from('portal_clients')
    .select('*')
    .eq('auth_id', authId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch portal client: ${error.message}`);
  }
  return mapPortalClientRow(data as PortalClientRow);
}
```

Note: The route layer and callers of `getPortalClient` must be updated to handle `null` return and respond with 404.

---

### ERR-006 HIGH — All integration clients (DomainClient, AnthropicClient, MetaSocialClient, TwilioClient) have no request timeout

Files: `packages/integrations/src/domain/client.ts:221`, `packages/integrations/src/ai/client.ts:392`, `packages/integrations/src/meta/client.ts:35`, `packages/integrations/src/twilio/client.ts:67`

Issue: Every integration client calls `fetch(...)` with no `signal` parameter. A hung third-party API (Domain, Anthropic, Meta Graph, Twilio) will block the Fastify worker indefinitely. Under Render's free/starter tier, this exhausts the single-threaded event loop, causing cascading timeouts for all other in-flight requests. `AnthropicClient` has retry logic for 429/529 but no wall-clock timeout; a 60-second hung connection will exhaust the retry budget without firing a timeout.

Fix: Add an `AbortSignal.timeout()` wrapper in each client's `request()` private method.

```typescript
// packages/integrations/src/domain/client.ts — replace the fetch call inside request() (line 221):
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15_000); // 15 s
try {
  const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  clearTimeout(timeoutId);
  // ... rest of existing error handling unchanged
} catch (err) {
  clearTimeout(timeoutId);
  if ((err as Error).name === 'AbortError') {
    throw new DomainAPIError('Domain API request timed out', 408, 'Request Timeout');
  }
  throw err;
}
```

```typescript
// packages/integrations/src/ai/client.ts — replace the fetch call inside sendMessage() (line 392):
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30 s for AI
try {
  const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: this.config.model, max_tokens: this.config.maxTokens, temperature: this.config.defaultTemperature, system, messages }),
  });
  clearTimeout(timeoutId);
  // ... rest of existing error handling unchanged
} catch (err) {
  clearTimeout(timeoutId);
  if ((err as Error).name === 'AbortError') {
    throw new AnthropicAPIError('Anthropic API request timed out', 408, 'Request Timeout', 'timeout');
  }
  throw err;
}
```

```typescript
// packages/integrations/src/meta/client.ts — replace the fetch call inside request() (line 35):
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10 s
try {
  const response = await fetch(url.toString(), {
    ...options,
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  clearTimeout(timeoutId);
  if (!response.ok) {
    throw new MetaAPIError('Meta API error', response.status, response.statusText);
  }
  return response.json() as Promise<T>;
} catch (err) {
  clearTimeout(timeoutId);
  if ((err as Error).name === 'AbortError') {
    throw new MetaAPIError('Meta API request timed out', 408, 'Request Timeout');
  }
  throw err;
}
```

```typescript
// packages/integrations/src/twilio/client.ts — replace the fetch call inside request() (line 67):
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10 s
try {
  const response = await fetch(`${this.baseUrl}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      Authorization: this.getAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
  });
  clearTimeout(timeoutId);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Twilio API error: ${response.status} ${errorBody}`);
  }
  // ... rest unchanged
} catch (err) {
  clearTimeout(timeoutId);
  if ((err as Error).name === 'AbortError') {
    throw new Error('Twilio API request timed out after 10 seconds');
  }
  throw err;
}
```

---

### ERR-007 HIGH — All `useMutation` hooks in `apps/web/src/hooks/` are missing `onError` handlers (21 hooks across 23 files)

Files: `apps/web/src/hooks/use-alerts.ts` (5 mutations), `apps/web/src/hooks/use-social.ts` (7 mutations), `apps/web/src/hooks/use-client-briefs.ts` (5 mutations), `apps/web/src/hooks/use-compliance.ts` (8 mutations), `apps/web/src/hooks/use-workflows.ts` (6 mutations), and 18 more files.

Issue: With two exceptions (`useMarkNotificationRead` in `use-notifications.ts` and one in `use-daily-actions.ts`), no `useMutation` call in the web app has an `onError` handler. Failures are silently swallowed — the UI shows no feedback when a create/update/delete operation fails. This is particularly severe for mutation-heavy workflows like compliance AML submissions, workflow activation, and brief sign-off.

Fix: Add `onError` to every `useMutation`. Minimum pattern:

```typescript
// Minimum fix — apply to every useMutation that lacks onError.
// Example: useCreateAlertSubscription in apps/web/src/hooks/use-alerts.ts
export function useCreateAlertSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAlertSubscription) =>
      apiFetch<{ data: PropertyAlertSubscription }>('/api/v1/alerts/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-subscriptions'] });
    },
    onError: (err: Error) => {
      console.error('[useCreateAlertSubscription] mutation failed:', err.message);
      // Replace with your toast/notification system:
      // toast.error(`Failed to create alert: ${err.message}`);
    },
  });
}
```

Priority order for applying: `use-compliance.ts` (AML submissions), `use-client-briefs.ts` (brief sign-off), `use-workflows.ts` (workflow activation), `use-alerts.ts`, then remaining hooks.

---

### ERR-008 HIGH — All `useMutation` hooks in `apps/portal/src/hooks/` are missing `onError` handlers

Files: `apps/portal/src/hooks/use-documents.ts:46-90` (`useUploadDocument`, `useDownloadDocument`), `apps/portal/src/hooks/use-portal-messages.ts:54-86` (`useSendMessage`)

Issue: All 5 mutations in the portal hooks have no `onError`. A failed document upload or message send shows no error state to the client. Given that portal users are non-technical property buyers, silent failure is unacceptable.

Fix:

```typescript
// apps/portal/src/hooks/use-documents.ts — add onError to useUploadDocument:
export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { data: portalClient } = usePortalClient();

  return useMutation({
    mutationFn: async ({ file, category }: UploadDocumentParams) => {
      // ... existing mutationFn unchanged
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-documents'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
    onError: (err: Error) => {
      console.error('[useUploadDocument] failed:', err.message);
      // Wire to toast: toast.error('Failed to upload document. Please try again.');
    },
  });
}

// apps/portal/src/hooks/use-portal-messages.ts — add onError to useSendMessage:
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { data: portalClient } = usePortalClient();

  return useMutation({
    mutationFn: async ({ text }: SendMessageParams) => {
      // ... existing mutationFn unchanged
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-messages'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
    onError: (err: Error) => {
      console.error('[useSendMessage] failed:', err.message);
      // Wire to toast: toast.error('Failed to send message. Please try again.');
    },
  });
}
```

---

### ERR-009 HIGH — Mobile screens do not render visible `isError` state

Files: `apps/mobile/app/alerts/index.tsx:175-231`, `apps/mobile/app/notifications/index.tsx:52-127`, `apps/mobile/app/matches/index.tsx:106-180`, `apps/mobile/app/(tabs)/index.tsx:117-135`, `apps/mobile/app/(tabs)/contacts.tsx:47-83`

Issue: All mobile screens destructure `isLoading` from their hooks but none destructure or render `isError`. When a hook fails (network offline, token expired, server 500), the screen silently shows an empty list or stays on the loading skeleton. On a phone in airplane mode, agents see a blank screen with no indication of what happened and no retry button.

Fix: Apply this pattern to each screen:

```typescript
// apps/mobile/app/alerts/index.tsx — add isError handling to AlertsScreen:
export default function AlertsScreen() {
  const { data: events = [], isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useAlertEvents();
  const { data: subscriptions = [], isLoading: subsLoading, isError: subsError } = useAlertSubscriptions();

  // Add at the top of the render, after hooks:
  if (eventsError || subsError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
          Unable to load alerts
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>
          Check your connection and try again.
        </Text>
        <TouchableOpacity
          onPress={() => void refetchEvents()}
          style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ... rest of existing render unchanged
}
```

Apply the same error block to:
- `apps/mobile/app/notifications/index.tsx` (wrap `useNotifications` isError)
- `apps/mobile/app/matches/index.tsx` (wrap `usePropertyMatches` isError)
- `apps/mobile/app/(tabs)/index.tsx` (wrap any of `statsLoading`, `tasksLoading`, `pipelineLoading` isError)
- `apps/mobile/app/(tabs)/contacts.tsx` (wrap `useContacts` isError)

---

### ERR-010 MEDIUM — `PropertyAlertEngine.handleNewMatch` uses `console.error` instead of the injected logger

File: `packages/business-logic/src/property-alert-engine.ts:160`, `packages/business-logic/src/property-alert-engine.ts:176`

Issue: `handleNewMatch` calls `console.error(...)` directly. In the Fastify server context this bypasses the Pino structured logger and produces unstructured output that cannot be correlated with request traces or aggregated by log drains.

Fix:

```typescript
// packages/business-logic/src/property-alert-engine.ts — add optional logger parameter to constructor:
export class PropertyAlertEngine {
  constructor(
    private supabase: SupabaseClient,
    private notifyPush: (token: string, title: string, body: string, data?: Record<string, string>) => Promise<void>,
    private notifyEmail: (to: string, subject: string, body: string) => Promise<void>,
    private notifySms: (to: string, body: string) => Promise<void>,
    private logger?: { error: (obj: Record<string, unknown>, msg: string) => void },
  ) {}

  // Replace console.error calls:
  // Line 160:
  (this.logger ?? console).error({ matchId: propertyMatchId }, '[PropertyAlertEngine] handleNewMatch: match not found');
  // Line 176:
  (this.logger ?? console).error({ err: subsError }, '[PropertyAlertEngine] handleNewMatch: error fetching subscriptions');
```

---

### ERR-011 MEDIUM — `SocialLeadEngine.getById` throws a non-discriminating error for PGRST116

File: `packages/business-logic/src/social-lead-engine.ts:228`

Issue: `getById` throws `Lead not found: ${error.message}` for all Supabase errors including PGRST116. The route layer in `GET /social/leads/:id` (lines 85-87) catches everything as a 404. If the DB is unreachable, a client receives a 404 "Lead not found" when the real cause is a 503 server error. This is a diagnosis masking issue rather than data loss, but it misleads on-call engineers.

Fix: Covered by ERR-005 fix above (return `null` for PGRST116, throw with context otherwise).

---

### ERR-012 MEDIUM — `GET /social/leads/stats` and `GET /off-market/stats` have no validation on date query params

File: `apps/api/src/routes/social-leads.ts:145-147`, `apps/api/src/routes/off-market.ts` (implicit via `Date` constructor)

Issue: Both stats routes accept `from` and `to` as free-form strings and pass them directly to `new Date(query.from)`. An invalid date string (e.g., `from=not-a-date`) produces `Invalid Date` which is silently coerced to `NaN` timestamps in Supabase queries, returning incorrect data with a 200 status.

Fix:

```typescript
// apps/api/src/routes/social-leads.ts — replace lines 145-147:
const query = request.query as { from?: string; to?: string };
const rawFrom = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const rawTo = query.to ? new Date(query.to) : new Date();

if (isNaN(rawFrom.getTime()) || isNaN(rawTo.getTime())) {
  return reply.status(400).send({ error: "'from' and 'to' must be valid ISO 8601 date strings" });
}
const from = rawFrom;
const to = rawTo;
```

Apply the same guard to `GET /off-market/stats` and `GET /team/performance`.

---

### ERR-013 MEDIUM — `GET /team/performance` date params have same unvalidated `new Date()` pattern

File: `apps/api/src/routes/team.ts:51-53`

Issue: Same as ERR-012. `new Date(query.from)` with invalid input produces `NaN` timestamps.

Fix: Apply the same `isNaN` guard as shown in ERR-012.

---

### ERR-014 MEDIUM — `PortalEngine.getPortalClient` wraps its own errors in a catch that masks the original message

File: `packages/business-logic/src/portal-engine.ts:95-98`

Issue: The outer `catch` in `getPortalClient` re-wraps already-typed `Error` instances: `if (err instanceof Error) throw err; throw new Error(...)`. This pattern is correct in isolation, but once PGRST116 is normalized to return `null` (per ERR-005 fix), the callers `acknowledgeBrief`, `recordMatchFeedback`, and `recordInspectionFeedback` need null-guards before proceeding. Without them, a missing portal client will cause a TypeError on `portalClient.contactId` access that gets wrapped as a generic 500.

Fix (after applying ERR-005):

```typescript
// packages/business-logic/src/portal-engine.ts — update acknowledgeBrief (line 108):
const portalClient = await this.getPortalClient(authId);
if (!portalClient) {
  throw new Error('Portal client not found for this user');
}

// Same null-guard needed in recordMatchFeedback (line 199) and recordInspectionFeedback (line 263).
```

---

### ERR-015 LOW — `PropertyAlertEngine` notification callbacks have no graceful degradation on individual channel failure

File: `packages/business-logic/src/property-alert-engine.ts` (notify loop, ~lines 183-250)

Issue: The engine iterates over subscriptions and calls `notifyPush`, `notifyEmail`, `notifySms` in sequence. If `notifyEmail` throws (e.g., Gmail transient failure), the loop throws and no further channels or subscriptions are processed. An email failure should log and continue, not abort the entire alert dispatch for all subscribers.

Fix:

```typescript
// In handleNewMatch, wrap each channel dispatch:
for (const channel of sub.channels) {
  try {
    if (channel === 'push') await this.notifyPush(/* ... */);
    else if (channel === 'email') await this.notifyEmail(/* ... */);
    else if (channel === 'sms') await this.notifySms(/* ... */);
  } catch (channelErr) {
    (this.logger ?? console).error(
      { err: channelErr, channel, subscriptionId: sub.id },
      '[PropertyAlertEngine] channel dispatch failed — continuing',
    );
  }
}
```

---

### ERR-016 LOW — `portal.ts` GmailClient call is correctly wrapped but the `magicLink` property access is unchecked

File: `apps/api/src/routes/portal.ts:395`

Issue: `linkData.properties.action_link` is accessed without checking whether `linkData` or `linkData.properties` is null. The Supabase admin SDK returns `data` and `error`; if the `generateLink` call partially succeeds, `linkData.properties` could be undefined in edge cases, causing an uncaught TypeError.

Fix:

```typescript
// apps/api/src/routes/portal.ts — after line 391, replace the linkData access:
if (linkError || !linkData?.properties?.action_link) {
  const msg = linkError?.message ?? 'Magic link generation returned no action URL';
  return reply.status(500).send({ error: msg });
}
```

---

### Summary: 5 CRITICAL, 4 HIGH, 3 MEDIUM, 2 LOW

| ID      | Severity | Title                                                              |
|---------|----------|--------------------------------------------------------------------|
| ERR-001 | CRITICAL | No `request.log.error` in any new route catch block               |
| ERR-002 | CRITICAL | `GET /:id` handlers swallow all errors as 404                     |
| ERR-003 | CRITICAL | Portal app has zero `error.tsx` boundaries                        |
| ERR-004 | CRITICAL | New Sprint 6 web segments missing segment-level `error.tsx`       |
| ERR-005 | CRITICAL | No PGRST116 differentiation in any new engine `getById` method    |
| ERR-006 | HIGH     | All 4 integration clients lack request timeout / AbortSignal      |
| ERR-007 | HIGH     | 21 web `useMutation` hooks missing `onError` handler              |
| ERR-008 | HIGH     | All 5 portal `useMutation` hooks missing `onError` handler        |
| ERR-009 | HIGH     | All mobile screens omit visible `isError` state and retry UI      |
| ERR-010 | MEDIUM   | `PropertyAlertEngine` uses `console.error` bypassing Pino logger  |
| ERR-011 | MEDIUM   | `SocialLeadEngine.getById` masks PGRST116 as generic error        |
| ERR-012 | MEDIUM   | Date query params in stats routes not validated before `new Date` |
| ERR-013 | MEDIUM   | `GET /team/performance` date params have same unvalidated pattern  |
| ERR-014 | MEDIUM   | `PortalEngine` callers need null-guard after PGRST116 fix         |
| ERR-015 | LOW      | Alert engine notification loop aborts on single channel failure   |
| ERR-016 | LOW      | `portal.ts` magic link property access unchecked before use       |

---

### Gate Decision

BLOCKED

5 CRITICAL findings must be resolved before this build is promoted to production:

1. ERR-001: Route catch blocks must log via `request.log.error` before every 500 response.
2. ERR-002: `GET /:id` routes must distinguish 404 from 5xx using the error code, not a bare catch.
3. ERR-003: The portal app requires at minimum a root `error.tsx` and a `(dashboard)/error.tsx`.
4. ERR-004: Sprint 6 web segments require segment-level `error.tsx` files.
5. ERR-005: All new engine `getById` methods must return `null` on PGRST116 and rethrow on genuine DB errors.

ERR-006 through ERR-009 (HIGH) must be resolved before the next sprint's code review. ERR-010 through ERR-014 (MEDIUM) should be addressed in the same sprint as the fix pass. ERR-015 and ERR-016 (LOW) can be deferred to a dedicated hardening sprint.
