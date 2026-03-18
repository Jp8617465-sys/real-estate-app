# Sprint 5: Client Experience — Full Feature Plan

**Sprint:** 5 of 6
**Weeks:** 13–15
**Theme:** Bring clients into the workflow through the portal and property alerts
**Status:** Planning (Sprint 4 complete)
**Planned:** 2026-03-02

---

## Sprint Goal

Two outcomes define "done":

1. At least one real client can log in to their portal and self-serve their brief, property shortlist, timeline, and documents without agent intervention.
2. A property alert fires within 5 minutes of a Domain API sync result matching a client brief above the configured score threshold.

---

## Parallel Team Structure

Sprint 5 has **minimal inter-team dependencies** — both workstreams run in parallel from day 1, with one interface contract agreed upfront.

| Team       | Feature                           | Discovery                                                              | Backend | Frontend | Mobile | Est. Effort |
| ---------- | --------------------------------- | ---------------------------------------------------------------------- | ------- | -------- | ------ | ----------- |
| **Team A** | Client Portal — complete & harden | [docs/discovery/client-portal.md](docs/discovery/client-portal.md)     | 3 days  | 3 days   | 1 day  | 7 dev-days  |
| **Team B** | Property Alerts                   | [docs/discovery/property-alerts.md](docs/discovery/property-alerts.md) | 4 days  | 1 day    | 1 day  | 6 dev-days  |

**Total:** ~13 dev-days across 2 parallel tracks.

**The one inter-team boundary:** `property_matches.status` — Team B sets `'sent_to_client'`; Team A's portal reads it. This value and transition must be agreed on Day 1 (see Interface Contracts below).

---

## Interface Contracts (Day 1 Agreement)

Agree on these shapes before either team writes implementation code.

### The Shared Boundary: `property_matches.status` Lifecycle

```
'new'           → match created by DomainSyncEngine/PropertyMatchEngine
'reviewed'      → agent has seen it (Team A: portal or web dashboard)
'sent_to_client'→ agent has approved it for portal visibility (Team B: POST /alerts/matches/:id/send-to-client)
'rejected'      → agent dismissed it (Team A: portal or web dashboard)
'inspected'     → property has been inspected (existing)
'purchased'     → contract exchanged (existing)
```

**Rule:** Only Team B's alert engine sets `sent_to_client`. Team A's portal _reads_ this status but does not set it. The agent action lives in the agent-facing web dashboard or the alert action (`/alerts/matches/:id/send-to-client`).

---

### Team A — Portal API Surface

```
GET  /api/v1/portal/me                     → PortalClientSchema (current client profile)
GET  /api/v1/portal/brief                  → brief read-only view (existing, extend)
POST /api/v1/portal/brief/acknowledge      → client acknowledgement (sign-off)
GET  /api/v1/portal/properties             → shortlist (status = 'sent_to_client' only)
POST /api/v1/portal/properties/:id/feedback → client feedback (interested/not/ask_agent)
GET  /api/v1/portal/inspections            → inspection list with calendar data
POST /api/v1/portal/inspections/:id/feedback → client rating + notes post-inspection
GET  /api/v1/portal/documents              → portal_visible=true documents only
GET  /api/v1/portal/timeline               → key dates (existing, extend)
GET  /api/v1/portal/messages               → message thread (existing)
POST /api/v1/portal/messages               → client sends message to agent
```

**Auth for all portal routes:** Supabase Auth with `portal_client` role check (magic link only — no password, no Google/Apple).

---

### Team B — Alerts API Surface

```
GET  /api/v1/alerts/subscriptions              → list agent's alert subscriptions per brief
POST /api/v1/alerts/subscriptions              → create subscription for a brief
PATCH /api/v1/alerts/subscriptions/:id         → update threshold/channels/quiet-hours
DELETE /api/v1/alerts/subscriptions/:id        → remove subscription

POST /api/v1/alerts/matches/:matchId/send-to-client → approve match for portal + trigger client notification
DELETE /api/v1/alerts/matches/:matchId/send-to-client → retract from portal

GET  /api/v1/alerts/events                     → alert event history (what was sent, when, actioned?)
GET  /api/v1/alerts/events/:eventId            → single event detail
POST /api/v1/alerts/test                       → send test alert (dev/QA only, dev mode guard)
```

---

### Shared Zod Schemas (packages/shared/src/types/)

**`portal.ts`** — Team A owns, Team B reads:

```typescript
export const PortalClientFeedbackSchema = z.object({
  propertyMatchId: z.string().uuid(),
  feedback: z.enum(['interested', 'not_interested', 'ask_agent']),
  notes: z.string().max(500).optional(),
});

export const PortalBriefAcknowledgementSchema = z.object({
  clientBriefId: z.string().uuid(),
  acknowledgedAt: z.string().datetime(),
  ipAddress: z.string().optional(), // for audit trail
});
```

**`property-alerts.ts`** — Team B owns, Team A reads:

```typescript
export const AlertChannelSchema = z.enum(['push', 'email', 'sms']);

export const PropertyAlertSubscriptionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  briefId: z.string().uuid(),
  scoreThreshold: z.number().int().min(50).max(100).default(70),
  channels: z.array(AlertChannelSchema).min(1),
  digestMode: z.boolean().default(false),
  digestTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('07:00'), // HH:MM AEST
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('21:00'),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('07:00'),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PropertyAlertEventSchema = z.object({
  id: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  propertyMatchId: z.string().uuid(),
  alertType: z.enum(['new_match', 'price_drop', 'auction_date', 'status_change']),
  channels: z.array(AlertChannelSchema),
  matchScore: z.number().int().min(0).max(100),
  sentAt: z.string().datetime().nullable(),
  actionedAt: z.string().datetime().nullable(),
  action: z.enum(['viewed', 'sent_to_client', 'dismissed', 'snoozed']).nullable(),
  snoozeUntil: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const CreateAlertSubscriptionSchema = PropertyAlertSubscriptionSchema.pick({
  briefId: true,
  scoreThreshold: true,
  channels: true,
  digestMode: true,
  digestTime: true,
  quietHoursStart: true,
  quietHoursEnd: true,
});
```

---

## Database Migrations

| Migration          | Number  | Tables Created / Modified                                                                                                                                                                                | RLS Required |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Portal completions | `00014` | `ALTER inspections` (add client_rating, client_feedback), `ALTER documents` (add portal_visible), `ALTER client_briefs` (add acknowledged_at, acknowledged_ip), new RLS policies for portal client reads | Yes          |
| Property alerts    | `00015` | `property_alert_subscriptions`, `property_alert_events`                                                                                                                                                  | Yes          |

⚠️ **Warning:** Existing migrations have duplicate numbering (two `00006_` files, two `00009_` files). Do NOT repeat this. `00014` and `00015` must be unique. Verify with `ls supabase/migrations/ | grep 0001` before creating files.

---

## Team A: Client Portal — Complete & Harden

**Goal:** Close the 5 gaps identified in discovery. Every item in this list must be done before the portal is shown to a real client.

**What already works (do not rebuild):**

- Magic link auth + middleware (`apps/portal/src/middleware.ts`)
- Dashboard with pipeline progress (`apps/portal/src/app/page.tsx`)
- Brief read-only view (`apps/portal/src/app/brief/page.tsx`)
- Property shortlist with match scores (`apps/portal/src/app/properties/page.tsx`)
- Timeline / key dates (`apps/portal/src/app/timeline/page.tsx`)
- Documents list + download (`apps/portal/src/app/documents/page.tsx`)
- Due diligence progress (`apps/portal/src/app/due-diligence/page.tsx`)
- Messages thread (`apps/portal/src/app/messages/page.tsx`)
- `portal_clients` table + base RLS (migration `00005`)

---

### A.1 Database Migration — `00014_portal_completions.sql`

```sql
-- 1. Brief acknowledgement (sign-off)
ALTER TABLE client_briefs
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_ip INET;

-- 2. Document visibility control
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Client inspection feedback
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS client_rating   INTEGER CHECK (client_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS client_feedback TEXT,
  ADD COLUMN IF NOT EXISTS client_feedback_at TIMESTAMPTZ;

-- 4. Client match feedback (interested / not_interested / ask_agent)
ALTER TABLE property_matches
  ADD COLUMN IF NOT EXISTS client_feedback      TEXT CHECK (client_feedback IN ('interested','not_interested','ask_agent')),
  ADD COLUMN IF NOT EXISTS client_feedback_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_feedback_note TEXT;

-- 5. RLS: portal client reads on client_briefs
-- Portal clients can read their own brief (via portal_clients.contact_id → contacts → client_briefs)
CREATE POLICY "portal_client_read_brief" ON client_briefs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = client_briefs.contact_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- Portal client can acknowledge their brief
CREATE POLICY "portal_client_acknowledge_brief" ON client_briefs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = client_briefs.contact_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  ) WITH CHECK (
    -- Portal clients can only set acknowledged_at — not modify other fields
    acknowledged_at IS NOT NULL
  );

-- 6. RLS: portal client reads on property_matches (sent_to_client only)
CREATE POLICY "portal_client_read_sent_matches" ON property_matches
  FOR SELECT USING (
    status = 'sent_to_client'
    AND EXISTS (
      SELECT 1
      FROM client_briefs cb
      JOIN portal_clients pc ON pc.contact_id = cb.contact_id
      WHERE cb.id = property_matches.brief_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- Portal client can write feedback on sent matches
CREATE POLICY "portal_client_feedback_match" ON property_matches
  FOR UPDATE USING (
    status = 'sent_to_client'
    AND EXISTS (
      SELECT 1
      FROM client_briefs cb
      JOIN portal_clients pc ON pc.contact_id = cb.contact_id
      WHERE cb.id = property_matches.brief_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- 7. RLS: portal client reads on inspections (their own contact)
CREATE POLICY "portal_client_read_inspections" ON inspections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = inspections.contact_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- Portal client can write inspection feedback
CREATE POLICY "portal_client_feedback_inspection" ON inspections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = inspections.contact_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- 8. RLS: portal client reads on key_dates
CREATE POLICY "portal_client_read_key_dates" ON key_dates
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM transactions t
      JOIN contacts c ON c.id = t.contact_id
      JOIN portal_clients pc ON pc.contact_id = c.id
      WHERE t.id = key_dates.transaction_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- 9. RLS: portal client reads on documents (portal_visible only)
-- Documents RLS in 00005 grants portal access — extend to enforce portal_visible flag
-- Drop and recreate to add portal_visible check:
DROP POLICY IF EXISTS "portal_clients_read_documents" ON documents;
CREATE POLICY "portal_client_read_documents" ON documents
  FOR SELECT USING (
    portal_visible = TRUE
    AND EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = documents.contact_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- 10. Verify: portal_clients RLS uses auth.uid() = auth_id (NOT agent_id)
-- NOTE: Migration 00005 policy "portal_clients_agent_all" uses auth.uid() = agent_id
-- Verify in Supabase Studio that portal_clients.agent_id stores users.auth_id (Supabase auth UID)
-- NOT users.id (internal UUID). If mismatched, the agent cannot manage their clients. Fix:
-- ALTER TABLE portal_clients ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id);
-- (Only if portal_clients currently uses a non-auth UUID for agent identity)
```

---

### A.2 Shared Types — `packages/shared/src/types/portal.ts`

(Extend existing portal types — do not recreate the file from scratch)

Add to existing exports:

```typescript
export const PortalBriefAcknowledgementSchema = z.object({
  clientBriefId: z.string().uuid(),
  acknowledgedAt: z.string().datetime(),
  ipAddress: z.string().optional(),
});

export const PortalPropertyFeedbackSchema = z.object({
  propertyMatchId: z.string().uuid(),
  feedback: z.enum(['interested', 'not_interested', 'ask_agent']),
  notes: z.string().max(500).optional(),
});

export const PortalInspectionFeedbackSchema = z.object({
  inspectionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
});
```

---

### A.3 Business Logic — `packages/business-logic/src/portal-engine.ts`

New engine (thin — mostly orchestration, not complex logic):

```typescript
export class PortalEngine {
  constructor(private supabase: SupabaseClient) {}

  // Returns the portal client record for the authenticated portal user
  async getPortalClient(authId: string): Promise<PortalClient>;

  // Acknowledges the brief — sets acknowledged_at + IP, returns updated brief
  async acknowledgeBrief(briefId: string, authId: string, ip?: string): Promise<ClientBrief>;

  // Returns property_matches with status='sent_to_client' for the client's brief
  async getSentMatches(contactId: string): Promise<PropertyMatch[]>;

  // Records client feedback on a match
  async recordMatchFeedback(matchId: string, feedback: PortalPropertyFeedback): Promise<void>;

  // Records client rating/notes after an inspection
  async recordInspectionFeedback(
    inspectionId: string,
    feedback: PortalInspectionFeedback,
  ): Promise<void>;
}
```

Unit tests: `packages/business-logic/src/portal-engine.test.ts`
— Target: 12–15 tests (one per method, error paths, auth boundary checks)

---

### A.4 API Routes — `apps/api/src/routes/portal.ts`

Extend the existing `portal.ts` route file. Add the new endpoints from the interface contract above. All routes require portal client auth middleware (verify `portal_client` role).

Registration in `apps/api/src/index.ts`: already registered — extend, do not re-register.

API tests: `apps/api/src/routes/portal.test.ts`
— Target: 15–18 tests (happy path per endpoint, 401 without auth, 403 wrong client, validation errors)

---

### A.5 Portal Pages — `apps/portal/src/`

| Page                  | File                                       | Change                                                                     |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Brief sign-off button | `apps/portal/src/app/brief/page.tsx`       | Add "I acknowledge this brief" button → `POST /portal/brief/acknowledge`   |
| Property feedback     | `apps/portal/src/app/properties/page.tsx`  | Add Interested / Not Interested / Ask Agent actions                        |
| Inspection feedback   | `apps/portal/src/app/inspections/page.tsx` | New page — calendar view + feedback form per inspection                    |
| Document visibility   | `apps/portal/src/app/documents/page.tsx`   | Filter to `portal_visible=true` only (already via RLS, confirm UI matches) |

---

### A.6 Agent Web Controls — `apps/web/src/`

| Feature                    | File                                                | Change                                                  |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Document visibility toggle | `apps/web/src/app/contacts/[id]/documents/page.tsx` | Add "Visible in portal" toggle per document             |
| Portal invite              | `apps/web/src/app/contacts/[id]/page.tsx`           | "Send portal invite" button → triggers magic link email |

---

### A.7 Mobile — `apps/mobile/`

| Feature                | File                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| Portal invite shortcut | `apps/mobile/app/contacts/[id].tsx` — add "Invite to portal" action |

---

## Team B: Property Alerts

**Goal:** Agent receives a push/email/SMS alert within 5 minutes of a Domain sync match scoring ≥ their configured threshold. Agent can approve a match for portal visibility with one tap.

**What already exists (do not rebuild):**

- `DomainSyncEngine` — creates `property_matches` + `property_price_changes`
- `notification_preferences` table + `notify_property_match` toggle
- `notifications` routes with snooze/dismiss
- `push_device_tokens` table + `push-tokens.ts` route
- `TwilioClient` (SMS), `GmailClient` (email) in `packages/integrations/src/`
- `dedup_key` on `NotificationSchema` — use this for idempotency

---

### B.1 Database Migration — `00015_property_alerts.sql`

```sql
-- Alert subscriptions (per agent per brief)
CREATE TABLE property_alert_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief_id            UUID NOT NULL REFERENCES client_briefs(id) ON DELETE CASCADE,
  score_threshold     INTEGER NOT NULL DEFAULT 70 CHECK (score_threshold BETWEEN 50 AND 100),
  channels            TEXT[] NOT NULL DEFAULT '{"push"}' CHECK (
                        channels <@ ARRAY['push','email','sms']::TEXT[]
                      ),
  digest_mode         BOOLEAN NOT NULL DEFAULT FALSE,
  digest_time         TIME NOT NULL DEFAULT '07:00:00',
  quiet_hours_start   TIME NOT NULL DEFAULT '21:00:00',
  quiet_hours_end     TIME NOT NULL DEFAULT '07:00:00',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, brief_id)
);

CREATE INDEX idx_alert_subs_agent ON property_alert_subscriptions(agent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alert_subs_brief ON property_alert_subscriptions(brief_id) WHERE deleted_at IS NULL;

ALTER TABLE property_alert_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_subscriptions" ON property_alert_subscriptions
  FOR ALL USING (agent_id = auth.uid());

-- Alert events (audit log — immutable once created)
CREATE TABLE property_alert_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID NOT NULL REFERENCES property_alert_subscriptions(id) ON DELETE CASCADE,
  property_match_id   UUID REFERENCES property_matches(id) ON DELETE SET NULL,
  alert_type          TEXT NOT NULL CHECK (alert_type IN ('new_match','price_drop','auction_date','status_change')),
  channels_attempted  TEXT[] NOT NULL DEFAULT '{}',
  channels_delivered  TEXT[] NOT NULL DEFAULT '{}',
  match_score         INTEGER NOT NULL,
  sent_at             TIMESTAMPTZ,
  actioned_at         TIMESTAMPTZ,
  action              TEXT CHECK (action IN ('viewed','sent_to_client','dismissed','snoozed')),
  snooze_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_events_sub ON property_alert_events(subscription_id, created_at DESC);
CREATE INDEX idx_alert_events_match ON property_alert_events(property_match_id);

ALTER TABLE property_alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_read_own_events" ON property_alert_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM property_alert_subscriptions pas
      WHERE pas.id = property_alert_events.subscription_id
        AND pas.agent_id = auth.uid()
    )
  );
-- Events are immutable — no UPDATE/DELETE policy for agents
```

---

### B.2 Shared Types — `packages/shared/src/types/property-alerts.ts`

New file. Full content from interface contracts above. Export all schemas.

---

### B.3 Business Logic — `packages/business-logic/src/property-alert-engine.ts`

New engine following the `AmlEngine` / `DomainSyncEngine` pattern:

```typescript
export class PropertyAlertEngine {
  constructor(
    private supabase: SupabaseClient,
    private pushClient: PushClient, // injected — no arrow fn constructors
    private twilioClient: TwilioClient, // injected
    private gmailClient: GmailClient, // injected
  ) {}

  // Called by DomainSyncEngine after each match is created
  async handleNewMatch(propertyMatchId: string): Promise<void>;

  // Called by DomainSyncEngine after each price change is recorded
  async handlePriceChange(priceChangeId: string): Promise<void>;

  // Checks quiet hours in AEST. Returns true if alerts should be suppressed.
  isQuietHours(sub: PropertyAlertSubscription, nowUtc: Date): boolean;

  // Dispatches to all configured channels. Returns delivered channels.
  private async dispatch(
    sub: PropertyAlertSubscription,
    match: PropertyMatch,
    alertType: PropertyAlertEvent['alertType'],
  ): Promise<string[]>;

  // Sets property_matches.status = 'sent_to_client', creates portal notification
  async sendMatchToClient(matchId: string, agentId: string): Promise<void>;

  // Runs the digest job — collects unsent matches for digest subscribers since last digest
  async runDigest(agentId: string): Promise<void>;
}
```

Unit tests: `packages/business-logic/src/property-alert-engine.test.ts`
— Target: 20–25 tests
— **Critical Vitest rules:**

- Use `vi.hoisted()` for `mockPushClient`, `mockTwilioClient`, `mockGmailClient`
- All `briefId`, `agentId`, `matchId` fixtures must be proper UUIDs (e.g., `'a1b2c3d4-e5f6-7890-abcd-ef1234567890'`)
- No arrow fn mocks as class constructors — use dependency injection
- Terminal `.select()` calls use `mockResolvedValue`, not `mockReturnThis()`

---

### B.4 API Routes — `apps/api/src/routes/alerts.ts`

New file. Implement the full Team B API surface from the interface contracts section. Register in `apps/api/src/index.ts`.

API tests: `apps/api/src/routes/alerts.test.ts`
— Target: 15–20 tests

---

### B.5 Agent Web — `apps/web/src/`

| Feature                     | File                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Alert preferences per brief | `apps/web/src/app/briefs/[id]/alerts/page.tsx` — configure threshold, channels, digest mode              |
| Alert history               | `apps/web/src/app/alerts/page.tsx` — timeline of sent alerts + actions taken                             |
| Match approval action       | `apps/web/src/app/alerts/page.tsx` — "Send to client" button → `POST /alerts/matches/:id/send-to-client` |

---

### B.6 Mobile — `apps/mobile/`

| Feature                   | File                                                                         |
| ------------------------- | ---------------------------------------------------------------------------- |
| Push notification handler | `apps/mobile/app/_layout.tsx` — add foreground handler for alert deep-links  |
| Alert list screen         | `apps/mobile/app/alerts.tsx` — new screen showing recent alerts with actions |

---

## Test Baseline

```
Sprint start baseline: 907 passing / 911 total
  — shared:         168/168
  — business-logic: 488/488
  — integrations:    66/66
  — api:            185/189

Known pre-existing failures (do not count as regression): 4
  — 4 tests: apps/api/src/routes/webhooks.test.ts
    (POST /api/v1/webhooks/domain/enquiry — returns 500, expects 201)
    (Pre-existing on chore/expo-54-migration branch; not introduced by Sprint 5)
    (Investigate: likely Supabase mock setup issue, same pattern as sprint 4 pre-existing failures)

Sprint 5 target: ≥ 977 passing (baseline 907 + ~70 new)
  — Team A: ~30 new tests (portal-engine: 12-15, portal routes: 15-18)
  — Team B: ~40 new tests (alert-engine: 20-25, alert routes: 15-20)
```

Run baseline before any Sprint 5 code is written:

```bash
npm run test 2>&1 | tail -5
```

---

## Risk Register

| Risk                                                           | Likelihood | Impact   | Mitigation                                                                         |
| -------------------------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------- | ---- | -------------------------- |
| `portal_clients.agent_id` mismatch (auth.uid vs internal UUID) | Medium     | High     | Verify in Supabase Studio on Day 1 before any portal testing                       |
| Push notification delivery on iOS requires APNs cert           | Medium     | Medium   | Test on Android first; add APNs cert to Expo config if blocking                    |
| AML documents surfaced in portal (Privacy Act breach)          | Low        | Critical | Document RLS category filter guard is highest-priority check in `/harden`          |
| digest cron job (07:00 AEST) not running on Render free tier   | Medium     | Low      | Implement as Render Cron Job or Supabase pg_cron; document in `/deploy-production` |
| Duplicate migration numbers (sprint 3 pattern)                 | Low        | High     | CI check: `ls supabase/migrations                                                  | sort | uniq -d` must return empty |

---

## Success Metrics

Sprint 5 is complete when:

- [ ] At least 1 real client logs in via magic link and can see their brief, shortlist, and timeline
- [ ] Brief acknowledgement works end-to-end (client taps → `acknowledged_at` set in DB)
- [ ] Agent can toggle document portal visibility and client sees change within 30 seconds (Supabase Realtime)
- [ ] A Domain sync match scoring ≥ 70 triggers an agent push notification within 5 minutes
- [ ] Agent can approve a match for portal visibility with one tap from the alerts screen
- [ ] Test count ≥ 676 (no regression below 606)
- [ ] No CRITICAL findings from `/harden sprint-5`
- [ ] AML document RLS verified — clients cannot see `aml_checks`, `aml_identity_documents`
- [ ] All smoke tests passing on staging: `/smoke-test https://realflow-api-staging.onrender.com`

---

## Recommended Build Order

To avoid blockers, follow this sequence within each team:

**Team A:**

1. Verify `portal_clients.agent_id` / `auth_id` (Day 1 — unblocks everything else)
2. Migration `00014` → `npm run db:migrate` → `npm run db:types`
3. `packages/shared/src/types/portal.ts` additions
4. `packages/business-logic/src/portal-engine.ts` + tests
5. `apps/api/src/routes/portal.ts` extensions + tests
6. Portal pages (brief sign-off, inspection page, property feedback)
7. Agent web controls (document toggle, portal invite)

**Team B:**

1. Interface contract sign-off with Team A (Day 1 — `property_matches.status` lifecycle)
2. Migration `00015` → `npm run db:migrate` → `npm run db:types`
3. `packages/shared/src/types/property-alerts.ts`
4. `packages/business-logic/src/property-alert-engine.ts` + tests
5. `apps/api/src/routes/alerts.ts` + tests
6. Agent web alert preferences + alert history pages
7. Mobile push handler + alerts screen
8. Integration: wire `handleNewMatch` into DomainSyncEngine

---

## _Next: `/sprint-start 5` is complete. Run `/build-db client-portal` and `/build-db property-alerts` to begin implementation._

## Deferred to Sprint 6

The following item was planned for Sprint 5 but deferred due to scope. The auction_date alert type and all shared types are already defined; only the cron trigger logic is missing.

### Auction Date Reminder Cron Alerts (C1 — PR Review Deferral)

**What:** Cron-based alerts dispatched at T-7 days, T-2 days, and T-1 day before an auction date (09:00 AEST).

**Why deferred:** Requires a cron scheduler infrastructure (not yet wired in the API), and the existing Sprint 5 scope already delivered the alert subscription system, event dispatch pipeline, and agent UI. The auction_date alert type is already defined in `PropertyAlertEvent['alertType']` and in the migration DDL.

**Sprint 6 tasks (pre-existing backlog):**

- Wire a Fastify cron plugin (e.g. `fastify-cron` or a pg_cron trigger) to run daily at 09:00 AEST
- Implement `PropertyAlertEngine.handleAuctionDate(propertyId)` — already stubbed
- Add tests for `handleAuctionDate`

**No schema changes required.** All tables and types are already in place.
