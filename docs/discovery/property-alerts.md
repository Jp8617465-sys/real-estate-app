# Discovery: Property Alerts

**Feature:** Property Alerts — notification and alerting layer on top of the existing match and sync infrastructure
**Sprint:** Sprint 5 — Client Experience
**Status:** Discovery complete, ready for sprint planning
**Author:** RealFlow Requirements Analysis
**Date:** 2026-03-02

---

## 1. Feature Overview

### The Problem

Australian buyers agents operate in one of the most time-compressed property markets in the world. In competitive suburbs, a new listing on Domain can receive 30–50 enquiries within 24 hours of going live. Auctions with short campaigns (3–4 weeks) compress decision windows further. A buyers agent who discovers a relevant listing 12 hours late — because they happened not to check the app — has likely lost their client's shot at it.

The current RealFlow state: the `DomainSyncEngine` fetches listings, scores them via the `PropertyMatchEngine` (5-factor, 0–100), and persists matches in `property_matches`. The `property_price_changes` table tracks price reductions. Notification infrastructure (`notifications`, `notification_preferences`, `push_device_tokens`) is scaffolded and the routes exist in `apps/api/src/routes/notifications.ts` and `apps/api/src/routes/push-tokens.ts`. The `TwilioClient` (SMS) and `GmailClient` (email) integrations exist in `packages/integrations/src/`.

What is missing is the bridge: the system currently stops at creating a `property_matches` row with `status = 'new'` and `overall_score = 0`. Nothing fans out to notify the agent, nothing surfaces to the client portal, and nothing records that an alert was sent or actioned.

### Why Speed of Alert Is Critical

- **Stock scarcity:** In inner-ring Sydney, Melbourne, and Brisbane suburbs, sub-$2M stock often has 5–10 genuine buyers competing per listing. Being alerted 6 hours after a competitor buyers agent is a structural disadvantage.
- **Auction campaigns:** Most auctions run 3-week campaigns. A listing missed on Day 1 means one fewer inspection slot and potentially no time for due diligence before auction day.
- **Price drops:** A price reduction on a previously-rejected property may make it viable. The window between a price drop and competing buyers acting on it can be hours.
- **Client retention:** Buyers agents justify their fee (typically 1–2.5% or a fixed retainer) partly on the promise that their clients see relevant properties before the open market does. If a client discovers a match before their agent, trust is damaged.

### What This Feature Delivers

A real-time alerting layer that:

1. Intercepts new `property_matches` records and `property_price_changes` records at the point of creation.
2. Evaluates each match against a configurable score threshold (default: 70/100).
3. Dispatches alerts to the agent immediately via push notification (primary), email, or SMS based on their stored preferences.
4. Optionally surfaces high-scoring matches to the client in their portal (`apps/portal`), gated by an agent approval toggle.
5. Records every alert event — what was sent, when, to whom, and what action was taken — in an auditable `property_alert_events` table.
6. Provides digest mode for agents who prefer a batched summary (e.g., 7:00am AEST) rather than instant alerts for every match above threshold.

---

## 2. User Personas

### Primary: The Buyers Agent (Sarah)

**Context:** Sarah manages 8–12 active buyer clients simultaneously. She is on the road most of the day — attending inspections, meeting vendors' agents, doing suburb drive-arounds. Her phone is her primary work tool; she opens her laptop perhaps twice a day.

**Pain points:**

- Missing a new listing because the sync ran overnight and she only saw it the next morning.
- Being pinged constantly by low-quality matches (score: 45/100) that waste her time.
- Having to manually cross-reference which clients each new property is relevant to.
- No easy way to forward a match to a client without leaving the app.

**Needs from Property Alerts:**

- Instant push notification when a new listing scores above her threshold for any client brief.
- The notification must tell her: which client, the match score, the address, the price, and the top reason for the match.
- One-tap action to view the full listing, or to send it to the client.
- Quiet hours enforced (21:00–07:00) — she cannot be woken up for a property alert.
- Per-brief threshold control (e.g., brief for a particularly picky client can be set to 80/100).

### Secondary: The Buyer/Client (Marcus)

**Context:** Marcus is a professional, not a property expert. He has engaged Sarah (his buyers agent) specifically to filter the market for him. He does not want to be overwhelmed — he expects Sarah's filter to work. He checks the client portal (`apps/portal`) a few times a week, typically on weekday evenings.

**Pain points:**

- Not knowing if his agent has seen something relevant — feeling out of the loop.
- Being shown properties that clearly do not match his brief (undermining trust in the process).
- Missing properties that were great matches but were never surfaced to him in the portal.

**Needs from Property Alerts:**

- See a curated feed of properties his agent has approved for him in the portal.
- Receive a portal notification or email when his agent shares a new match.
- Ability to mark a property as Interested, Not Interested, or Ask Agent.
- Not to receive raw, unfiltered alerts — everything must come through the agent's approval step.

### Tertiary: The Agency Principal (David)

**Context:** David runs a boutique buyers agency with 6 agents. He is not involved in day-to-day property searches but wants assurance that the business is performing well and that clients are receiving a high-quality experience.

**Pain points:**

- No visibility into how many relevant properties are being surfaced per client.
- Agents ignoring high-score matches because they didn't notice the alert.
- Clients churning because they felt they weren't getting value from the service.

**Needs from Property Alerts:**

- Dashboard visibility: how many alerts were sent this week, average match score of alerted properties, alert-to-action conversion rate (i.e., what percentage of alerts led to an inspection booking or a client-view).
- Configurable office-wide default threshold and channel preferences for new agents.
- Ability to see alert history for any agent or client brief within his office.

---

## 3. User Stories

### Story 1: New Listing Match Alert (Agent)

**As** a buyers agent,
**Given** the `DomainSyncEngine` has completed a sync and created a new `property_matches` row with `overall_score >= 70` for one of my active client briefs,
**When** the match is persisted to the database,
**Then** I receive a push notification on my mobile device within 60 seconds containing: the client's name, the property address, the match score, the listing price (formatted as AUD), the top matching factor (e.g., "Location: Paddington, Budget: within range"), and two action buttons — "View Listing" and "Send to Client".

**Acceptance Criteria:**

- Alert fires within 60 seconds of the `property_matches` row being created with `status = 'new'`.
- Push notification is delivered via Expo Push Notification API to all active `push_device_tokens` for the agent's `user_id`.
- A `property_alert_events` row is created with `event_type = 'agent_push_sent'`, linking to the `property_matches` row and the `notifications` row.
- If the agent's `notification_preferences.notifyPropertyMatch = false`, no alert is sent.
- If the match score is below the agent's threshold for this brief (`property_alert_subscriptions.min_score_threshold`), no alert is sent.
- If the current time falls within the agent's quiet hours (`quiet_hours_start`–`quiet_hours_end`), the alert is queued and delivered at `quiet_hours_end`.
- The notification `category` is set to `'property_match'` (existing enum value in `NotificationCategorySchema`).

---

### Story 2: Price Drop Alert (Agent)

**As** a buyers agent,
**Given** the `DomainSyncEngine.detectPriceChanges()` has written a new row to `property_price_changes` with `change_type = 'reduction'` for a property that is linked to at least one active `property_matches` record for one of my client briefs,
**When** the price change is detected,
**Then** I receive an alert stating the property address, the old price, the new price, the reduction amount in AUD, the reduction as a percentage, and the client brief(s) the property was previously matched against.

**Acceptance Criteria:**

- Alert fires only for `change_type IN ('reduction', 'price_guide_set')` — not for `'increase'`.
- A `property_alert_events` row is created with `event_type = 'price_drop_alert_sent'`.
- The alert includes re-evaluated match score with the new price (the existing `PropertyMatchEngine.scoreProperty()` is re-run).
- If the re-evaluated score now meets threshold and the property was previously below threshold, the alert is sent even if it was not previously alerted on.
- The `notified_agent_ids` column on `property_price_changes` is updated to include the agent's `user_id` to prevent duplicate alerts.

---

### Story 3: Auction Date Alert (Agent) 🔜 Deferred — Sprint 6

**As** a buyers agent,
**Given** a property in my active `property_matches` has an `auction_date` set (sourced from `properties.auction_date`),
**When** the auction date is 7 days away, then 2 days away, then 1 day away (09:00 AEST),
**Then** I receive an alert reminding me of the upcoming auction, the property details, the match score, the client it is matched to, and a prompt to confirm whether a pre-auction offer or auction registration is being prepared.

**Acceptance Criteria:**

- Three separate alerts are dispatched at T-7 days, T-2 days, and T-1 day (09:00 AEST).
- Alerts are only sent for properties with `property_matches.status NOT IN ('rejected')`.
- Alert delivery mechanism follows agent's preferred channel (push first, fallback to email).
- A `property_alert_events` row is created for each dispatch with `event_type = 'auction_reminder_sent'` and `days_before_auction` recorded in `metadata`.
- If the agent has already booked an inspection (`inspections` table has a row for this property and contact), the alert copy changes to "Auction reminder: you have an inspection booked."

---

### Story 4: Match Score Threshold Configuration (Agent)

**As** a buyers agent,
**Given** I am viewing a client brief in the web or mobile app,
**When** I access the "Alert Settings" section for that brief,
**Then** I can set a minimum match score threshold (0–100, default 70) for that specific brief, choose between instant alerts and digest mode, and set a maximum of N alerts per day for that brief.

**Acceptance Criteria:**

- Threshold is stored on a `property_alert_subscriptions` row keyed on `(agent_id, brief_id)` with a `UNIQUE` constraint.
- Valid range: 0–100 (integer). Values outside this range are rejected with a 400 error.
- Digest mode setting is stored on the same row: `alert_mode ENUM('instant', 'digest')`.
- Per-brief daily cap is stored as `max_alerts_per_day INTEGER` (NULL = unlimited).
- Changes take effect immediately — the next sync evaluation uses the new threshold.
- The agent-level `notification_preferences.notifyPropertyMatch` acts as a global override: if false, per-brief thresholds are irrelevant.
- A PATCH endpoint exists at `/api/v1/alert-subscriptions/:id` to update settings.

---

### Story 5: Alert Channel Preference (Agent)

**As** a buyers agent,
**Given** I am in my notification settings,
**When** I configure my preferred alert channels for property match alerts,
**Then** I can select any combination of push notification, email, or SMS, with a clear primary/fallback hierarchy.

**Acceptance Criteria:**

- Channel preferences are stored in an extended `notification_preferences` row or in a new `property_alert_subscriptions` column: `channels JSONB` (e.g., `{"push": true, "email": true, "sms": false}`).
- If push is enabled but the agent has no registered `push_device_tokens`, the system falls back to email automatically and logs a `property_alert_events` row with `event_type = 'push_fallback_to_email'`.
- SMS alerts are only sent if the agent has a verified mobile number in their `users` profile. If unverified, SMS is silently skipped (no error surfaced to the user).
- Email alerts use `GmailClient` from `packages/integrations/src/` and send to the agent's `users.email`.
- SMS alerts use `TwilioClient` from `packages/integrations/src/` and send to the agent's `users.phone`.
- An alert is never double-sent on the same channel for the same match (dedup by `notifications.dedup_key = 'property_match:{property_match_id}:{channel}'`).

---

### Story 6: Client-Visible Alerts in the Portal (Agent + Client)

**As** a buyers agent,
**Given** I have received a property match alert and I want to share it with my client,
**When** I tap "Send to Client" on the alert or from the property match detail screen,
**Then** the property match is surfaced in the client's portal feed and the client receives a portal notification (email or in-app) that their agent has found a potential property for them.

**Acceptance Criteria:**

- The property match `status` is updated to `'sent_to_client'` in the `property_matches` table.
- A `property_alert_events` row is created with `event_type = 'sent_to_client'` and the agent's `user_id` recorded as `actor_id`.
- The client sees the property in their portal at `/portal/properties` filtered to `status = 'sent_to_client'`.
- A portal notification is created in the `notifications` table with `user_id = portal_client.auth_id` (the client's auth ID, not the agent's).
- The client notification includes: property address, match score summary (human-readable, e.g., "Strong match on location and budget"), listing price, and a link to view the property details in the portal.
- RLS ensures the client can only see properties that have been explicitly sent to them (`status = 'sent_to_client'`) — not raw `'new'` matches.
- The agent can unsend a match (revert `status` to `'under_review'`), which removes it from the client's portal feed.

---

### Story 7: Snooze and Dismiss (Agent)

**As** a buyers agent,
**Given** I have received a property match alert,
**When** I do not want to act on it immediately but do not want to lose it,
**Then** I can snooze the alert for 1 hour, 4 hours, or until tomorrow morning (07:00 AEST), and the alert will re-appear in my notification centre at the snoozed time.

**Acceptance Criteria:**

- Snooze updates `notifications.status = 'snoozed'` and sets `notifications.snoozed_until` to the computed future timestamp. This already exists in the `/api/v1/notifications/:id/snooze` route.
- Supported snooze durations: 60 minutes, 240 minutes, or "until 07:00 tomorrow" (computed server-side).
- A `property_alert_events` row is created with `event_type = 'snoozed'` and `snooze_until` recorded in `metadata`.
- Dismiss updates `notifications.status = 'dismissed'` and `is_deleted = true`. The underlying `property_matches` row is not affected — only the notification is dismissed.
- A dismissed notification does not prevent a new notification if the property's price subsequently drops and meets threshold again (new event, new `dedup_key`).
- Snooze and dismiss are available from both the mobile notification centre and the web notification panel.

---

### Story 8: Alert History (Agent + Principal)

**As** a buyers agent or agency principal,
**Given** I want to review how a client search is progressing,
**When** I open a client brief's activity feed or the dedicated Alerts History screen,
**Then** I see a chronological log of every alert sent for that brief: what was sent, when, the match score at the time, the delivery channel, whether it was read, and what action was taken (viewed, sent to client, snoozed, dismissed, inspection booked).

**Acceptance Criteria:**

- Alert history is served by `GET /api/v1/alert-events?briefId={id}` with pagination (limit/offset).
- Each record includes: `event_type`, `created_at`, `property_match_id`, `overall_score_at_time`, `channel`, `actor_id`, and `metadata`.
- Principal can query alert history across all briefs in their office via `GET /api/v1/alert-events?officeId={id}` (RLS enforces office membership).
- Read events are recorded when a notification's `status` transitions from `'sent'` to `'read'` — a `property_alert_events` row is created with `event_type = 'read'`.
- Alert history is exportable as CSV from the web dashboard (out of scope for Sprint 5 — see Section 5).

---

## 4. Acceptance Criteria (Summary)

The following must all pass before the feature is considered complete for Sprint 5.

**Alerting Engine**

- A new `PropertyAlertEngine` class exists in `packages/business-logic/src/property-alert-engine.ts`.
- The engine accepts a `MatchResult` and an agent's `property_alert_subscriptions` row and decides: (a) should an alert fire, (b) on which channels, (c) instant or queued for digest.
- The engine calls the appropriate integration clients (`TwilioClient`, `GmailClient`) and the Expo Push API.
- Unit tests reach >= 90% line coverage on the engine.

**Database**

- Migration `00014_property_alerts.sql` is written and reviewed.
- `property_alert_subscriptions` table exists with columns per Section 8.
- `property_alert_events` table exists with columns per Section 8.
- RLS policies are defined and tested for both tables.
- All new tables use soft deletes (`is_deleted`, `deleted_at`).

**API**

- All endpoints listed in Section 9 exist, are Zod-validated, and return documented response shapes.
- All endpoints require authentication (`supabase.auth.getUser()` check).
- Endpoints are registered in `apps/api/src/index.ts` under the `/api/v1/alert-subscriptions` and `/api/v1/alert-events` prefixes.

**Mobile (Expo)**

- Push tokens are registered on app launch and deregistered on logout (already partially built via `push-tokens.ts`).
- Property match push notification displays correctly on iOS and Android.
- Deep link from notification opens the correct property match detail screen.
- Snooze and dismiss are accessible via notification long-press on iOS and notification action buttons on Android.

**Portal (Client)**

- Client portal shows a feed of properties with `status = 'sent_to_client'`.
- Clients can mark a property as Interested or Not Interested.
- Portal feed is not accessible to unauthenticated users (RLS enforced).

**Alert Fatigue**

- The minimum score threshold gate (default 70/100) is enforced by the engine before any alert is dispatched.
- Quiet hours are respected for push and SMS channels.
- Digest mode batches eligible alerts and sends at the configured `digest_send_time`.
- Per-brief daily cap, when set, is enforced by querying `property_alert_events` count for the current AEST calendar day.

**Observability**

- Every alert dispatch attempt (success or failure) is recorded in `property_alert_events`.
- Failed dispatches log the error in `metadata.error` without crashing the sync run.

---

## 5. Out of Scope (Sprint 5)

The following items are explicitly excluded from Sprint 5 to keep the scope deliverable within a single sprint.

- **Alert history CSV export** — data is available, export UI is a Sprint 6 task.
- **REA Group (realestate.com.au) integration** — only Domain.com.au data is used as the source. REA integration is a future sprint.
- **AI-generated property summary in alert copy** — the `ai_score_property` workflow action and NLP on listing descriptions are not wired into alerts yet. Alert copy uses structured data only (price, bedrooms, suburb, score).
- **Client mobile push notifications** — clients receive portal notifications and email only. Push for clients requires a separate Expo app build for the portal. This is Sprint 6.
- **Rental yield / investor score alerting** — the `investorMatch` factor in `PropertyMatchEngine` returns a placeholder `50`. Investor-specific alerts are deferred until rental data is integrated.
- **WhatsApp alerts** — `WhatsAppClient` exists in `packages/integrations/src/` but is not wired into the alert channel selection. WhatsApp as a channel is Sprint 6.
- **Webhook delivery to third-party systems** — no outbound webhooks from the alert engine in this sprint.
- **Principal alert configuration UI** — principals can see alert history via the API but the dedicated principal dashboard UI for alert volume/quality analytics is Sprint 6.
- **Automated inspection booking from an alert** — the "Book Inspection" CTA in the notification is a link to the inspections screen; automatic booking is not in Sprint 5.

---

## 6. Mobile Requirements

Agents are in the field most of the working day. Mobile is not a secondary surface — it is the primary one. The following mobile requirements are non-negotiable for Sprint 5.

### Push Notification Delivery

- The Expo Push Notification API must be used for iOS and Android (Expo SDK 54 is the target per the current branch `chore/expo-54-migration`).
- Push tokens must be registered using `POST /api/v1/push-tokens` on every app launch (upsert — the route already exists).
- Push tokens must be deregistered using `DELETE /api/v1/push-tokens/:token` on logout.
- Tokens that have not been seen (`last_seen_at`) within 30 days should be marked `is_active = false` by a nightly job (not Sprint 5 scope, but the schema supports it).

### Notification Payload

The push notification payload must include:

```json
{
  "title": "New Match: 14 Roslyn St, Paddington",
  "body": "Score 82/100 for Marcus Johnson · $1.65M · 3 bed 2 bath",
  "data": {
    "screen": "PropertyMatchDetail",
    "propertyMatchId": "<uuid>",
    "briefId": "<uuid>"
  }
}
```

The `data` object enables deep linking. The `apps/mobile` Expo Router setup must handle the `PropertyMatchDetail` route and accept `propertyMatchId` as a param.

### Deep Linking

- Tapping the notification opens `apps/mobile` directly to the property match detail screen.
- If the app is closed, cold-launch deep link must be handled via `expo-notifications` `lastNotificationResponse`.
- If the app is foregrounded, the in-app notification banner must also be shown (use `expo-notifications` foreground handler).

### Offline Behaviour

- If the device is offline when a notification is tapped, the app must gracefully degrade — show a cached version of the property if available, or display an offline state rather than crashing.

### Action Buttons

- iOS: Notification action buttons ("View" and "Send to Client") must be registered as `UNNotificationAction` categories.
- Android: Notification action buttons use `setActions()` on the notification channel.
- "Send to Client" action from the notification triggers an API call in the background without requiring the app to be opened.

### Battery and Data Considerations

- Push is always preferred over polling. The app must not implement a polling loop for new matches.
- If push delivery fails (Expo push receipt shows an error), the system logs the failure in `property_alert_events` and the agent sees the alert the next time they open the app via the in-app notification centre.

---

## 7. Alert Fatigue Considerations

Alert fatigue is the single greatest risk to adoption. An agent who is woken up at 11pm by a 52/100 match for the wrong client will disable all property alerts within a week. The system must be opinionated on the side of fewer, higher-quality alerts.

### 7.1 Minimum Match Score Threshold

- **Default:** 70/100 — derived from the 5-factor weighted scoring in `PropertyMatchEngine`. A score of 70 requires at minimum a good location match (weight 25) plus a solid price match (weight 30).
- **Configurable:** Per-brief, by the agent, in integer steps from 0 to 100. The UI should guide agents toward the 65–80 range with a tooltip explaining what different score bands mean.
- **Hard floor:** The system will never alert on a score below 50, regardless of agent configuration, to protect against misconfigured briefs generating noise.
- **Flag filtering:** Properties with the `over_absolute_max` flag are never alerted on, even if the overall score exceeds threshold (this can occur if the price sub-score is being pulled up by location).

### 7.2 Digest Mode vs Instant Alerts

Agents choose one of two modes per brief:

| Mode    | Behaviour                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instant | Alert fires within 60 seconds of a match being created or a qualifying price change being detected. Quiet hours still apply.                                                           |
| Digest  | Qualifying matches are accumulated. A single digest notification is sent at the configured `digest_send_time` (default 07:00 AEST). If no matches exceed threshold, no digest is sent. |

The digest notification lists up to 5 properties (sorted by score descending). If more than 5 qualify, the notification says "5 of {n} matches shown — tap to see all."

**Recommendation:** Default new agents to Digest mode for the first 30 days. The onboarding flow should explain the trade-off.

### 7.3 Per-Brief Alert Frequency Limits

- `max_alerts_per_day INTEGER NULL` on `property_alert_subscriptions`.
- NULL = unlimited.
- Suggested default: NULL (unlimited) for agents who have opted into instant mode; effectively managed by the score threshold.
- If a brief has `max_alerts_per_day = 3` and 3 alerts have already been sent on the current AEST calendar day, subsequent qualifying matches are queued and included in the next morning's digest regardless of mode.

### 7.4 Deduplication

- A `dedup_key` of `property_match:{property_match_id}:agent` is written to `notifications.dedup_key` before any alert is dispatched.
- Before sending, the engine queries `SELECT COUNT(*) FROM notifications WHERE dedup_key = $1 AND status != 'dismissed'`. If count > 0, the alert is skipped.
- This prevents duplicate alerts when, for example, the Domain sync runs twice within a short period and the same listing is upserted again.

### 7.5 Quiet Hours

- Defaults: 21:00–07:00 AEST (stored in `notification_preferences.quiet_hours_start/end`).
- Push and SMS are suppressed during quiet hours.
- Email is also suppressed during quiet hours (unlike typical email behaviour, because agents use the same email for work and personal).
- Alerts queued during quiet hours are batched and delivered as a mini-digest at `quiet_hours_end`.

### 7.6 Match Quality Signal

Over time, the system should record which alerts led to actions (inspection booked, sent to client, offer made). This creates a feedback loop that can be used to tune default thresholds per agent. This is a Sprint 6 / AI iteration item and is not implemented in Sprint 5.

---

## 8. Supabase RLS Boundary Analysis

### 8.1 Data Visibility Model

| Data                                           | Agent             | Client (portal)          | Principal            |
| ---------------------------------------------- | ----------------- | ------------------------ | -------------------- |
| `property_alert_subscriptions`                 | Own rows only     | No access                | All rows in office   |
| `property_alert_events`                        | Own events only   | No access                | All events in office |
| `property_matches` (status = 'new')            | Own matches       | No access                | Office-wide          |
| `property_matches` (status = 'sent_to_client') | Own matches       | Their own client matches | Office-wide          |
| `notifications` (agent)                        | Own notifications | No access                | No access            |
| `notifications` (client portal)                | No access         | Own notifications        | No access            |

### 8.2 New Tables Required

#### `property_alert_subscriptions`

Stores per-agent, per-brief alert configuration. One row per `(agent_id, brief_id)` pair.

```sql
CREATE TABLE property_alert_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief_id              UUID NOT NULL REFERENCES client_briefs(id) ON DELETE CASCADE,
  min_score_threshold   INTEGER NOT NULL DEFAULT 70 CHECK (min_score_threshold BETWEEN 50 AND 100),
  alert_mode            TEXT NOT NULL DEFAULT 'instant'
    CHECK (alert_mode IN ('instant', 'digest')),
  channels              JSONB NOT NULL DEFAULT '{"push": true, "email": false, "sms": false}'::jsonb,
  max_alerts_per_day    INTEGER CHECK (max_alerts_per_day > 0),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  is_deleted            BOOLEAN NOT NULL DEFAULT false,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, brief_id)
);

CREATE INDEX idx_alert_subs_agent     ON property_alert_subscriptions (agent_id);
CREATE INDEX idx_alert_subs_brief     ON property_alert_subscriptions (brief_id);
CREATE INDEX idx_alert_subs_active    ON property_alert_subscriptions (agent_id, is_active)
  WHERE is_deleted = false;
```

#### `property_alert_events`

Immutable audit log of every alert-related event. Never updated, never hard-deleted.

```sql
CREATE TABLE property_alert_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_match_id        UUID REFERENCES property_matches(id) ON DELETE SET NULL,
  price_change_id          UUID REFERENCES property_price_changes(id) ON DELETE SET NULL,
  agent_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief_id                 UUID REFERENCES client_briefs(id) ON DELETE SET NULL,
  notification_id          UUID REFERENCES notifications(id) ON DELETE SET NULL,
  event_type               TEXT NOT NULL CHECK (event_type IN (
                             'agent_push_sent',
                             'agent_email_sent',
                             'agent_sms_sent',
                             'push_fallback_to_email',
                             'price_drop_alert_sent',
                             'auction_reminder_sent',
                             'sent_to_client',
                             'client_viewed',
                             'client_interested',
                             'client_not_interested',
                             'read',
                             'snoozed',
                             'dismissed',
                             'delivery_failed',
                             'skipped_below_threshold',
                             'skipped_quiet_hours',
                             'skipped_daily_cap',
                             'skipped_dedup'
                           )),
  overall_score_at_time    INTEGER,
  channel                  TEXT CHECK (channel IN ('push', 'email', 'sms', 'portal')),
  actor_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata                 JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_events_agent        ON property_alert_events (agent_id, created_at DESC);
CREATE INDEX idx_alert_events_brief        ON property_alert_events (brief_id, created_at DESC)
  WHERE brief_id IS NOT NULL;
CREATE INDEX idx_alert_events_match        ON property_alert_events (property_match_id)
  WHERE property_match_id IS NOT NULL;
CREATE INDEX idx_alert_events_type         ON property_alert_events (event_type, created_at DESC);
```

### 8.3 RLS Policies for New Tables

```sql
-- property_alert_subscriptions

ALTER TABLE property_alert_subscriptions ENABLE ROW LEVEL SECURITY;

-- Agents manage their own subscriptions
CREATE POLICY "agents_own_alert_subscriptions"
  ON property_alert_subscriptions
  FOR ALL
  USING (agent_id = get_current_user_id());

-- Principals can read all subscriptions in their office
CREATE POLICY "principals_read_office_alert_subscriptions"
  ON property_alert_subscriptions
  FOR SELECT
  USING (
    get_current_user_role() IN ('principal', 'admin')
    AND agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- Service role can write (for engine-created default rows)
CREATE POLICY "service_role_write_alert_subscriptions"
  ON property_alert_subscriptions
  FOR INSERT
  WITH CHECK (TRUE);


-- property_alert_events

ALTER TABLE property_alert_events ENABLE ROW LEVEL SECURITY;

-- Agents see their own alert events
CREATE POLICY "agents_own_alert_events"
  ON property_alert_events
  FOR SELECT
  USING (agent_id = get_current_user_id());

-- Principals can read all alert events in their office
CREATE POLICY "principals_read_office_alert_events"
  ON property_alert_events
  FOR SELECT
  USING (
    get_current_user_role() IN ('principal', 'admin')
    AND agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- Service role inserts (engine writes events — agents never write directly)
CREATE POLICY "service_role_insert_alert_events"
  ON property_alert_events
  FOR INSERT
  WITH CHECK (TRUE);
```

### 8.4 Existing Table Changes Required

- `property_matches` — no schema changes required; existing `status` enum already includes `'sent_to_client'`.
- `notification_preferences` — the existing `notify_property_match` boolean acts as the global agent toggle. No schema change needed for Sprint 5.
- `notifications` — existing schema supports property alert notifications via `category = 'property_match'`. The `dedup_key` column already exists for deduplication.
- `property_price_changes` — existing `notified_agent_ids UUID[]` column is used to track which agents have been alerted for a price change. No schema change needed.

---

## 9. API Surface (High Level)

All endpoints are under `/api/v1`. All require `Authorization: Bearer <supabase_jwt>`.

### Alert Subscriptions

| Method   | Path                       | Description                                                                                                                                                              |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/alert-subscriptions`     | List the authenticated agent's alert subscriptions. Query params: `briefId?`.                                                                                            |
| `GET`    | `/alert-subscriptions/:id` | Get a single subscription row.                                                                                                                                           |
| `POST`   | `/alert-subscriptions`     | Create a subscription for a brief. Body: `{ briefId, minScoreThreshold?, alertMode?, channels?, maxAlertsPerDay? }`. Auto-created with defaults when a brief is created. |
| `PATCH`  | `/alert-subscriptions/:id` | Update threshold, mode, channels, or daily cap.                                                                                                                          |
| `DELETE` | `/alert-subscriptions/:id` | Soft-delete (sets `is_deleted = true`, `is_active = false`).                                                                                                             |

### Alert Events (Audit Log — Read Only)

| Method | Path                | Description                                                                                                                            |
| ------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/alert-events`     | Paginated alert event history. Query params: `briefId?`, `agentId?` (principal only), `eventType?`, `from?`, `to?`, `limit`, `offset`. |
| `GET`  | `/alert-events/:id` | Get a single alert event row.                                                                                                          |

### Trigger Manual Alert (Developer/Debug)

| Method | Path                           | Description                                                                                                                                                                 |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/alert-subscriptions/trigger` | Manually trigger alert evaluation for a specific `propertyMatchId`. Useful for testing and for agents who want to re-send a match to a client. Body: `{ propertyMatchId }`. |

### Existing Endpoints (Unchanged, Relevant Context)

| Method   | Path                         | Notes                                                                          |
| -------- | ---------------------------- | ------------------------------------------------------------------------------ |
| `GET`    | `/notifications`             | Existing — lists agent notifications, filterable by `category=property_match`. |
| `POST`   | `/notifications/:id/read`    | Existing — marks notification read, triggers `property_alert_events` write.    |
| `POST`   | `/notifications/:id/snooze`  | Existing — snooze with minutes param.                                          |
| `POST`   | `/notifications/:id/dismiss` | Existing — dismiss alert.                                                      |
| `GET`    | `/notifications/preferences` | Existing — includes global `notifyPropertyMatch` toggle.                       |
| `PATCH`  | `/notifications/preferences` | Existing — updates global toggle and quiet hours.                              |
| `POST`   | `/push-tokens`               | Existing — register device token on app launch.                                |
| `DELETE` | `/push-tokens/:token`        | Existing — deregister on logout.                                               |
| `POST`   | `/domain/sync`               | Existing — manual sync trigger (should chain into alert evaluation post-sync). |

### Integration Points to Wire Up

The following internal call chain must be implemented in Sprint 5:

1. `DomainSyncEngine.syncListingsForAgent()` completes — matches are written to `property_matches`.
2. After upsert, the `domainSyncRoutes` `POST /sync` handler calls `PropertyAlertEngine.evaluateMatches(agentId, newMatchIds, supabase)`.
3. `PropertyAlertEngine` loads the relevant `property_alert_subscriptions`, evaluates thresholds, and dispatches alerts.
4. `DomainSyncEngine.detectPriceChanges()` returns `PriceChange[]` — the route or a dedicated service calls `PropertyAlertEngine.evaluatePriceChangeAlerts(agentId, changes, supabase)`.

---

## 10. Sign-off Checklist

- [ ] User stories reviewed and accepted by product stakeholder
- [ ] Acceptance criteria complete and unambiguous for each story
- [ ] Alert fatigue strategy agreed — default threshold (70/100), quiet hours (21:00–07:00), digest mode default reviewed
- [ ] Channel preferences confirmed — push (primary), email (secondary), SMS (opt-in only)
- [ ] New table schemas (`property_alert_subscriptions`, `property_alert_events`) reviewed by a second engineer
- [ ] RLS policies reviewed and tested against all three personas (agent, client, principal)
- [ ] Mobile deep-link route (`PropertyMatchDetail`) confirmed in Expo Router navigation structure
- [ ] Expo SDK 54 push notification API compatibility confirmed (branch: `chore/expo-54-migration`)
- [ ] Integration with existing `TwilioClient` and `GmailClient` confirmed — credentials available in environment
- [ ] `DomainSyncEngine` post-sync hook point identified and agreed (currently `setImmediate` block in `POST /domain/sync`)
- [ ] Out-of-scope items acknowledged by all team members — no scope creep in Sprint 5
- [ ] Ready for `/sprint-plan`
