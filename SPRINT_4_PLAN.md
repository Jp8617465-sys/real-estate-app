# Sprint 4: Data & Integration — Full Feature Plan

**Sprint:** 4 of 6
**Weeks:** 10–12
**Theme:** Connect to external data sources + provide business intelligence
**Status:** Planning (Sprints 2 & 3 in parallel development)
**Planned:** 2026-03-01

---

## Parallel Team Structure

Sprint 4 has **zero inter-feature dependencies** — all three workstreams run in parallel from day 1.

| Team       | Feature                | Backend | Frontend | Mobile | Est. Effort |
| ---------- | ---------------------- | ------- | -------- | ------ | ----------- |
| **Team A** | Domain.com.au API Sync | 3 days  | 2 days   | 1 day  | 6 dev-days  |
| **Team B** | Analytics Dashboard    | 3 days  | 3 days   | 1 day  | 7 dev-days  |
| **Team C** | AML/KYC Compliance     | 2 days  | 2 days   | 0 days | 4 dev-days  |

**Total:** ~17 dev-days across 3 parallel tracks = fits comfortably in a 3-week sprint.

---

## Interface Contracts (Day 1 Agreement)

Before teams start, agree on these API shapes so UIs can be built against mocks.

### Team A — Domain Sync API Surface

```
GET  /api/v1/domain/status              → { connected, lastSync, listingsSynced }
POST /api/v1/domain/sync                → triggers manual sync, returns jobId
GET  /api/v1/domain/listings            → paginated Domain listing browser
GET  /api/v1/domain/listings/:id/match  → run match engine on a Domain listing
POST /api/v1/domain/webhooks            → Domain webhook receiver (public, no auth)
GET  /api/v1/domain/price-changes       → recent price change alerts
GET  /api/v1/domain/auction-results     → auction result feed
```

### Team B — Analytics API Surface

```
GET  /api/v1/analytics/pipeline-velocity    → stage conversion rates + avg days
GET  /api/v1/analytics/agent-performance    → deals closed, response time, fees
GET  /api/v1/analytics/market-insights      → suburb medians, DOM, clearance rates
GET  /api/v1/analytics/revenue              → MRR, pipeline value, fee forecast
GET  /api/v1/analytics/snapshot             → all metrics in one call (dashboard load)
```

### Team C — Compliance API Surface

```
GET  /api/v1/compliance/checks              → list AML checks for agent's contacts
GET  /api/v1/compliance/checks/:contactId   → check detail + documents
POST /api/v1/compliance/checks/:contactId/start  → begin verification workflow
PATCH /api/v1/compliance/checks/:id         → update verification fields
POST /api/v1/compliance/checks/:id/documents → upload identity document
POST /api/v1/compliance/checks/:id/complete → mark as verified/rejected
GET  /api/v1/compliance/report              → AUSTRAC-ready compliance report
```

---

## Team A: Domain.com.au API Sync

**Goal:** Auto-import listings matching active briefs; track price changes and auction results.

**What's already built:** `DomainClient` in `packages/integrations/src/domain/client.ts` — full OAuth2, `searchListings()`, `getListing()`, `getSalesResults()`, `getSuburbPerformance()`. DB has `domain_listing_id` column on `properties` and `portal_listings` sync table.

**What Sprint 4 builds:** The orchestration layer — sync scheduling, webhook receiver, auto-match trigger, price change alerts.

---

### A.1 Database Migration — `00009_domain_sync.sql`

```sql
-- Domain sync job tracking
CREATE TABLE domain_sync_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed')),
  sync_type     TEXT NOT NULL CHECK (sync_type IN ('manual','scheduled','webhook')),
  listings_found     INTEGER DEFAULT 0,
  listings_imported  INTEGER DEFAULT 0,
  matches_triggered  INTEGER DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Price change tracking
CREATE TABLE property_price_changes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  domain_listing_id TEXT NOT NULL,
  previous_price  NUMERIC(12,2),
  new_price       NUMERIC(12,2),
  change_percent  NUMERIC(5,2),
  change_type     TEXT CHECK (change_type IN ('reduction','increase','price_guide_set')),
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  notified_agent_ids UUID[] DEFAULT '{}'
);
CREATE INDEX idx_price_changes_listing ON property_price_changes(domain_listing_id);
CREATE INDEX idx_price_changes_detected ON property_price_changes(detected_at DESC);

-- Auction results
CREATE TABLE auction_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  domain_listing_id TEXT,
  suburb          TEXT NOT NULL,
  postcode        TEXT,
  auction_date    DATE NOT NULL,
  result          TEXT CHECK (result IN ('sold','passed_in','withdrawn','sold_prior')),
  sold_price      NUMERIC(12,2),
  reserve_price   NUMERIC(12,2),
  registered_bidders INT,
  agent_name      TEXT,
  agency_name     TEXT,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_auction_suburb ON auction_results(suburb, auction_date DESC);

-- Selling agent profiles enriched from Domain
ALTER TABLE selling_agent_profiles
  ADD COLUMN IF NOT EXISTS domain_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS domain_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS listings_count_active INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listings_count_sold INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;

-- RLS
ALTER TABLE domain_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_sync_jobs" ON domain_sync_jobs
  USING (agent_id = auth.uid());

ALTER TABLE property_price_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_see_price_changes" ON property_price_changes
  USING (
    EXISTS (
      SELECT 1 FROM property_matches pm
      JOIN client_briefs cb ON cb.id = pm.brief_id
      WHERE pm.property_id = property_price_changes.property_id
        AND cb.agent_id = auth.uid()
    )
  );

ALTER TABLE auction_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_agents_read_auctions" ON auction_results
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

---

### A.2 Shared Types — `packages/shared/src/types/domain-sync.ts`

```typescript
import { z } from 'zod';

export const DomainSyncJobSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  syncType: z.enum(['manual', 'scheduled', 'webhook']),
  listingsFound: z.number().int().min(0),
  listingsImported: z.number().int().min(0),
  matchesTriggered: z.number().int().min(0),
  errorMessage: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const PriceChangeSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  domainListingId: z.string(),
  previousPrice: z.number().nullable(),
  newPrice: z.number(),
  changePercent: z.number(),
  changeType: z.enum(['reduction', 'increase', 'price_guide_set']),
  detectedAt: z.string().datetime(),
});

export const AuctionResultSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  domainListingId: z.string().nullable(),
  suburb: z.string(),
  postcode: z.string().nullable(),
  auctionDate: z.string().date(),
  result: z.enum(['sold', 'passed_in', 'withdrawn', 'sold_prior']),
  soldPrice: z.number().nullable(),
  reservePrice: z.number().nullable(),
  registeredBidders: z.number().int().nullable(),
  agentName: z.string().nullable(),
  agencyName: z.string().nullable(),
});

export const DomainSyncStatusSchema = z.object({
  connected: z.boolean(),
  lastSync: z.string().datetime().nullable(),
  listingsSynced: z.number().int(),
  priceChanges24h: z.number().int(),
  auctionResults7d: z.number().int(),
});

export type DomainSyncJob = z.infer<typeof DomainSyncJobSchema>;
export type PriceChange = z.infer<typeof PriceChangeSchema>;
export type AuctionResult = z.infer<typeof AuctionResultSchema>;
export type DomainSyncStatus = z.infer<typeof DomainSyncStatusSchema>;
```

---

### A.3 Business Logic — `packages/business-logic/src/domain-sync-engine.ts`

**Class:** `DomainSyncEngine`

```typescript
// Interface spec — implementation fills these methods
interface DomainSyncEngine {
  // Fetch new listings matching ALL active briefs for an agent, import as properties
  syncListingsForAgent(agentId: string): Promise<DomainSyncJob>;

  // Called when Domain sends a webhook — parse and process
  processWebhook(payload: DomainWebhookPayload): Promise<void>;

  // Detect price changes for tracked properties
  detectPriceChanges(agentId: string): Promise<PriceChange[]>;

  // Ingest this week's auction results for agent's tracked suburbs
  ingestAuctionResults(suburbs: string[]): Promise<AuctionResult[]>;

  // Build search params from a client brief (suburb list, bedrooms, price range)
  buildSearchParams(brief: ClientBrief): DomainSearchParams;
}
```

**Key behaviours:**

- `syncListingsForAgent`: Load all active client briefs → extract suburb lists and price ranges → call `DomainClient.searchListings()` for each unique suburb group → upsert into `properties` (keyed on `domain_listing_id`) → run `AIPropertyMatchingService.scoreMatch()` for each brief × listing → record matches with `status = 'new'`
- `processWebhook`: Domain sends events for new listings, price changes, status changes → route to correct handler
- `detectPriceChanges`: Query `properties` where `domain_listing_id IS NOT NULL` → re-fetch from Domain API → compare `price` → insert `property_price_changes` if changed → return changes for notification
- `ingestAuctionResults`: Call `DomainClient.getSalesResults()` per suburb → upsert into `auction_results` → update market analytics tables

---

### A.4 API Routes — `apps/api/src/routes/domain-sync.ts`

| Method | Path                                      | Description                                      | Auth     |
| ------ | ----------------------------------------- | ------------------------------------------------ | -------- |
| GET    | `/api/v1/domain/status`                   | Connection status + last sync stats              | JWT      |
| POST   | `/api/v1/domain/sync`                     | Trigger manual sync for agent                    | JWT      |
| GET    | `/api/v1/domain/listings`                 | Browse Domain listings (search + filter)         | JWT      |
| GET    | `/api/v1/domain/listings/:domainId/match` | Run match engine on a Domain listing             | JWT      |
| POST   | `/api/v1/domain/webhooks`                 | Domain webhook receiver                          | HMAC sig |
| GET    | `/api/v1/domain/price-changes`            | Recent price changes for agent's properties      | JWT      |
| GET    | `/api/v1/domain/auction-results`          | Auction results feed (suburb filter, date range) | JWT      |

**Webhook security:** Verify Domain's HMAC signature header `X-Domain-Signature` before processing. Return `200` immediately; process async.

---

### A.5 Supabase Edge Function — `supabase/functions/domain-scheduled-sync/`

Runs nightly at 6am AEST via pg_cron or Supabase scheduled function:

- Loops over all agents with Domain integration connected
- Calls `domain-sync/sync` route per agent
- Logs outcomes to `domain_sync_jobs`

---

### A.6 Web UI

**New Pages:**

**`/settings/integrations/domain`** — Domain connection settings

```
┌─────────────────────────────────────────────────┐
│ Domain.com.au Integration                       │
│                                                 │
│ Status: ● Connected (OAuth)        [Disconnect] │
│ Last sync: 2 hours ago             [Sync Now]   │
│ Listings imported: 1,247                        │
│                                                 │
│ Auto-sync settings:                             │
│ ● Nightly (6am AEST) — recommended              │
│ ○ Every 4 hours                                 │
│ ○ Manual only                                   │
│                                                 │
│ [Save Settings]                                 │
└─────────────────────────────────────────────────┘
```

**`/properties/price-changes`** — Price change alert feed

```
┌─────────────────────────────────────────────────┐
│ Price Changes (Last 7 days)    [Filter by brief] │
│                                                 │
│ ↓ 23 Maple St, Paddington                       │
│   $1.85M → $1.72M  (-7.0%)  2 briefs match     │
│   [View Property] [Notify Clients]              │
│                                                 │
│ ↓ 8/15 Crown St, Surry Hills                    │
│   $920K → $875K    (-4.9%)  1 brief matches     │
│   [View Property] [Notify Clients]              │
└─────────────────────────────────────────────────┘
```

**`/market/auctions`** — Auction results for tracked suburbs

---

### A.7 Mobile

Push notification (via Expo Notifications):

- New match imported: "New Paddington listing matches Jane Smith's brief — 3BR $1.8M"
- Price reduction: "23 Maple St dropped 7% to $1.72M — matches 2 active briefs"

---

### A.8 Tests — Team A (Target: 40+ tests)

| File                         | Tests                                                  |
| ---------------------------- | ------------------------------------------------------ |
| `domain-sync-engine.test.ts` | 20 tests: sync logic, webhook parsing, price detection |
| `domain-sync.route.test.ts`  | 12 tests: all 7 endpoints, auth, error cases           |
| `domain-sync.types.test.ts`  | 8 tests: Zod schema validation                         |

---

### A.9 Exit Criteria — Team A

- [ ] `POST /domain/sync` imports listings for a test agent's briefs
- [ ] Webhook receiver processes a Domain new-listing event correctly
- [ ] Price changes detected and stored when Domain listing price changes
- [ ] Auction results ingested for at least 5 test suburbs
- [ ] Settings page shows connection status + last sync time
- [ ] Price change feed shows alerts with brief match counts
- [ ] Push notification fires on new match import (mobile)
- [ ] 40+ tests passing

---

---

## Team B: Analytics Dashboard

**Goal:** Give agents and principals actionable business intelligence — pipeline velocity, agent performance, market insights, revenue forecast.

**What's already built:** Basic `portal_views`, `enquiry_count`, `inspection_count` fields. Dashboard page exists at `apps/web/src/app/dashboard/` but is minimal. Recharts is available in web deps.

**What Sprint 4 builds:** Aggregation tables, analytics service, full dashboard UI.

---

### B.1 Database Migration — `00010_analytics.sql`

```sql
-- Daily snapshot table (pre-aggregated for performance)
CREATE TABLE analytics_daily_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,

  -- Pipeline metrics
  active_clients_count        INTEGER DEFAULT 0,
  new_leads_count             INTEGER DEFAULT 0,
  leads_contacted_count       INTEGER DEFAULT 0,
  briefs_created_count        INTEGER DEFAULT 0,
  inspections_done_count      INTEGER DEFAULT 0,
  offers_submitted_count      INTEGER DEFAULT 0,
  contracts_signed_count      INTEGER DEFAULT 0,
  settlements_count           INTEGER DEFAULT 0,

  -- Stage conversion (JSON array: [{stage, in, out, avg_days}])
  stage_velocity              JSONB DEFAULT '[]',

  -- Financial
  revenue_earned_aud          NUMERIC(12,2) DEFAULT 0,
  pipeline_value_aud          NUMERIC(12,2) DEFAULT 0,
  avg_deal_value_aud          NUMERIC(12,2) DEFAULT 0,

  -- Communication
  messages_sent_count         INTEGER DEFAULT 0,
  avg_response_time_minutes   INTEGER,

  -- AI usage
  ai_matches_run              INTEGER DEFAULT 0,
  ai_cost_aud                 NUMERIC(8,4) DEFAULT 0,

  UNIQUE(agent_id, snapshot_date)
);
CREATE INDEX idx_snapshots_agent_date ON analytics_daily_snapshots(agent_id, snapshot_date DESC);

-- Market data snapshots from Domain
CREATE TABLE market_data_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suburb          TEXT NOT NULL,
  postcode        TEXT,
  state           TEXT CHECK (state IN ('NSW','VIC','QLD','SA','WA','TAS','NT','ACT')),
  snapshot_date   DATE NOT NULL,
  property_type   TEXT CHECK (property_type IN ('house','unit','townhouse')),

  -- Pricing
  median_sale_price   NUMERIC(12,2),
  median_days_on_market NUMERIC(5,1),
  clearance_rate      NUMERIC(5,2),     -- percentage
  total_auctions      INTEGER,
  sold_count          INTEGER,
  new_listings_count  INTEGER,

  -- YoY
  price_change_1y_percent NUMERIC(5,2),
  data_source         TEXT DEFAULT 'domain',
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(suburb, snapshot_date, property_type)
);
CREATE INDEX idx_market_suburb ON market_data_snapshots(suburb, snapshot_date DESC);
CREATE INDEX idx_market_postcode ON market_data_snapshots(postcode, snapshot_date DESC);

-- Pipeline stage funnel tracking (computed from transactions)
-- This is a VIEW not a table — computed on demand
CREATE OR REPLACE VIEW pipeline_funnel_stats AS
SELECT
  cb.agent_id,
  t.pipeline_type,
  t.stage,
  COUNT(*) AS active_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - t.stage_entered_at))/86400)::NUMERIC(6,1) AS avg_days_in_stage,
  COUNT(*) FILTER (WHERE t.stage_entered_at > NOW() - INTERVAL '30 days') AS new_30d
FROM transactions t
JOIN contacts c ON c.id = t.contact_id
JOIN client_briefs cb ON cb.contact_id = c.id
WHERE t.status = 'active'
GROUP BY cb.agent_id, t.pipeline_type, t.stage;

-- RLS
ALTER TABLE analytics_daily_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_snapshots" ON analytics_daily_snapshots
  USING (agent_id = auth.uid());

ALTER TABLE market_data_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_agents_read_market" ON market_data_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

---

### B.2 Shared Types — `packages/shared/src/types/analytics.ts`

```typescript
import { z } from 'zod';

export const PipelineVelocitySchema = z.object({
  stage: z.string(),
  pipelineType: z.enum(['buyer', 'seller', 'buyers_agent']),
  activeCount: z.number().int(),
  avgDaysInStage: z.number(),
  conversionRate: z.number().min(0).max(100), // % who move to next stage
  new30d: z.number().int(),
});

export const AgentPerformanceSchema = z.object({
  agentId: z.string().uuid(),
  agentName: z.string(),
  period: z.enum(['7d', '30d', '90d', 'ytd']),
  dealsSettled: z.number().int(),
  dealsInProgress: z.number().int(),
  totalRevenue: z.number(),
  avgDealValue: z.number(),
  avgResponseTimeMinutes: z.number().nullable(),
  messagesSent: z.number().int(),
  inspectionsDone: z.number().int(),
  offerConversionRate: z.number().min(0).max(100),
});

export const MarketInsightSchema = z.object({
  suburb: z.string(),
  postcode: z.string().nullable(),
  state: z.string(),
  propertyType: z.enum(['house', 'unit', 'townhouse']),
  medianSalePrice: z.number().nullable(),
  medianDaysOnMarket: z.number().nullable(),
  clearanceRate: z.number().nullable(),
  priceChange1yPercent: z.number().nullable(),
  snapshotDate: z.string().date(),
});

export const RevenueForecastSchema = z.object({
  period: z.string(),
  earnedRevenue: z.number(),
  pipelineValue: z.number(),
  forecastRevenue: z.number(), // earned + % of pipeline
  retainerFees: z.number(),
  successFees: z.number(),
  referralFees: z.number(),
});

export const DashboardSnapshotSchema = z.object({
  pipelineVelocity: z.array(PipelineVelocitySchema),
  agentPerformance: AgentPerformanceSchema,
  marketInsights: z.array(MarketInsightSchema),
  revenue: RevenueForecastSchema,
  generatedAt: z.string().datetime(),
});

export type PipelineVelocity = z.infer<typeof PipelineVelocitySchema>;
export type AgentPerformance = z.infer<typeof AgentPerformanceSchema>;
export type MarketInsight = z.infer<typeof MarketInsightSchema>;
export type RevenueForecast = z.infer<typeof RevenueForecastSchema>;
export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>;
```

---

### B.3 Business Logic — `packages/business-logic/src/analytics-engine.ts`

```typescript
interface AnalyticsEngine {
  // Generate daily snapshot for an agent (called by cron at midnight)
  generateDailySnapshot(agentId: string, date: Date): Promise<AnalyticsDailySnapshot>;

  // Compute pipeline funnel from live data
  getPipelineVelocity(
    agentId: string,
    period: '7d' | '30d' | '90d' | 'ytd',
  ): Promise<PipelineVelocity[]>;

  // Agent performance metrics
  getAgentPerformance(agentId: string, period: string): Promise<AgentPerformance>;

  // Pull market data from Domain for agent's tracked suburbs
  refreshMarketData(suburbs: string[]): Promise<MarketInsight[]>;

  // Revenue: earned + pipeline value + forecast
  getRevenueForecast(agentId: string): Promise<RevenueForecast>;

  // Single-call dashboard snapshot (cached 15min)
  getDashboardSnapshot(agentId: string): Promise<DashboardSnapshot>;
}
```

**Key implementation notes:**

- `getPipelineVelocity`: Query `transactions` → group by `stage` → calc `avg(NOW() - stage_entered_at)` per stage → calculate conversion rate from snapshot history
- `getAgentPerformance`: Aggregate from `domain_sync_jobs`, `messages`, `inspections`, `offers`, `invoices` tables
- `refreshMarketData`: Call `DomainClient.getSuburbPerformance()` → upsert `market_data_snapshots`
- `getDashboardSnapshot`: Fetch from `analytics_daily_snapshots` + live `pipeline_funnel_stats` view — cache result in Redis/memory for 15min

---

### B.4 API Routes — `apps/api/src/routes/analytics.ts`

| Method | Path                                  | Query Params                | Description                  |
| ------ | ------------------------------------- | --------------------------- | ---------------------------- |
| GET    | `/api/v1/analytics/pipeline-velocity` | `period`, `pipelineType`    | Stage funnel stats           |
| GET    | `/api/v1/analytics/agent-performance` | `period`, `agentId`         | Performance metrics          |
| GET    | `/api/v1/analytics/market-insights`   | `suburbs[]`, `propertyType` | Market data                  |
| GET    | `/api/v1/analytics/revenue`           | `period`                    | Revenue + forecast           |
| GET    | `/api/v1/analytics/snapshot`          | `period`                    | Full dashboard (single call) |

All routes: JWT required, agent scoped via RLS.

---

### B.5 Web UI — Analytics Dashboard

**Upgrade:** `apps/web/src/app/dashboard/page.tsx` — full analytics dashboard

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard                      Period: [30d ▼]  [Export]│
├────────────┬────────────┬────────────┬──────────────────┤
│ Active     │ Settled    │ Pipeline   │ Response Time    │
│ Clients 12 │ This Mo  3 │ $2.1M      │ 42 min avg       │
├────────────┴────────────┴────────────┴──────────────────┤
│ Pipeline Funnel                                         │
│                                                         │
│ Lead ████████████████ 12                               │
│ Brief████████████ 9  (75% → next, avg 3.2 days)        │
│ Search ████████ 6    (67% → next, avg 18 days)          │
│ Inspect ████ 4       (67% → next, avg 5 days)           │
│ Offer ███ 3          (67% → next, avg 2 days)           │
│ Contract ██ 2        (100% → next, avg 21 days)         │
│ Settled █ 1                                             │
│                                                         │
├─────────────────────────┬───────────────────────────────┤
│ Revenue                 │ Market Insights               │
│ Earned: $45,000         │ Paddington (Houses)           │
│ Pipeline: $180,000      │ Median: $2.1M  ▲ +8.2% YoY   │
│ Forecast: $126,000      │ DOM: 22 days                  │
│                         │ Clearance: 72%                │
│ [Bar chart by month]    │ [Table: top 5 suburbs]        │
└─────────────────────────┴───────────────────────────────┘
```

**Components to build:**

- `components/analytics/PipelineFunnelChart.tsx` — horizontal bar chart (Recharts)
- `components/analytics/RevenueBarChart.tsx` — monthly revenue bars
- `components/analytics/MarketInsightsTable.tsx` — suburb data table
- `components/analytics/KpiCard.tsx` — reusable stat card
- `components/analytics/PeriodSelector.tsx` — 7d/30d/90d/YTD toggle

---

### B.6 Mobile

**Screen:** `/(tabs)/dashboard` — summary KPI view

- 4 KPI cards (active clients, settled this month, pipeline value, response time)
- Tap to open full web dashboard (WebView or deep link)

---

### B.7 Tests — Team B (Target: 45+ tests)

| File                       | Tests                                          |
| -------------------------- | ---------------------------------------------- |
| `analytics-engine.test.ts` | 20 tests: each method, edge cases, empty data  |
| `analytics.route.test.ts`  | 15 tests: all 5 endpoints, period params, auth |
| `analytics.types.test.ts`  | 10 tests: Zod schema validation                |

---

### B.8 Exit Criteria — Team B

- [ ] Pipeline funnel shows correct stage counts and avg days from real data
- [ ] Agent performance calculates deals settled, revenue, response time
- [ ] Market data populates from Domain for at least 3 test suburbs
- [ ] Revenue forecast shows earned + pipeline + forecast
- [ ] `/analytics/snapshot` returns full dashboard in <500ms
- [ ] Dashboard page renders all 4 charts without errors
- [ ] KPI cards show live data (not hardcoded)
- [ ] 45+ tests passing

---

---

## Team C: AML/KYC Compliance

**Goal:** Meet Australian AML/CTF obligations for buyers agents. Manual 100-point ID check workflow + document upload + compliance report.

**What's already built:** `documents` table for file storage. Contact records have address/DOB fields.

**What Sprint 4 builds:** The full compliance schema, verification workflow, and UI.

---

### C.1 Context: Australian AML Requirements

Buyers agents (as "designated services" under AUSTRAC) must:

1. Collect customer ID at onboarding (100-point check)
2. Record verification method and outcome
3. Keep records for 7 years
4. Report suspicious transactions to AUSTRAC
5. Have a written AML/CTF program

Sprint 4 builds the **data infrastructure and manual workflow**. Automated verification (GreenID, Frankie One) is deferred to v1.5 when revenue justifies cost.

---

### C.2 Database Migration — `00011_aml_kyc.sql`

```sql
-- Document types for 100-point check
CREATE TYPE aml_document_type AS ENUM (
  -- Primary ID (70 points each)
  'passport',
  'birth_certificate',
  'citizenship_certificate',
  -- Secondary ID — Category A (40 points each)
  'drivers_licence',
  'government_id_card',
  'proof_of_age_card',
  -- Secondary ID — Category B (25 points each)
  'medicare_card',
  'credit_card',
  'bank_card',
  -- Supporting (25 points each)
  'utility_bill',
  'bank_statement',
  'council_rates',
  'lease_agreement',
  'centrelink_letter'
);

-- Point values per document type
CREATE TABLE aml_document_point_values (
  document_type   aml_document_type PRIMARY KEY,
  points          INTEGER NOT NULL CHECK (points IN (25, 40, 70)),
  category        TEXT CHECK (category IN ('primary','secondary_a','secondary_b','supporting'))
);

INSERT INTO aml_document_point_values VALUES
  ('passport', 70, 'primary'),
  ('birth_certificate', 70, 'primary'),
  ('citizenship_certificate', 70, 'primary'),
  ('drivers_licence', 40, 'secondary_a'),
  ('government_id_card', 40, 'secondary_a'),
  ('proof_of_age_card', 40, 'secondary_a'),
  ('medicare_card', 25, 'secondary_b'),
  ('credit_card', 25, 'secondary_b'),
  ('bank_card', 25, 'secondary_b'),
  ('utility_bill', 25, 'supporting'),
  ('bank_statement', 25, 'supporting'),
  ('council_rates', 25, 'supporting'),
  ('lease_agreement', 25, 'supporting'),
  ('centrelink_letter', 25, 'supporting');

-- AML check record (one per contact/engagement)
CREATE TABLE aml_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','passed','failed','expired','waived')),

  -- Verification method
  verification_method TEXT CHECK (verification_method IN (
    'face_to_face',
    'certified_copies',
    'electronic',   -- future: GreenID/Frankie
    'third_party'
  )),

  -- 100-point check progress
  total_points        INTEGER DEFAULT 0,
  points_required     INTEGER DEFAULT 100,

  -- Identity captured
  full_legal_name     TEXT,
  date_of_birth       DATE,
  residential_address TEXT,
  address_verified    BOOLEAN DEFAULT FALSE,

  -- Check dates
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  expiry_date         DATE,   -- typically 2 years from completion
  last_reviewed_at    TIMESTAMPTZ,

  -- Outcome
  verified_by_user_id UUID REFERENCES users(id),
  rejection_reason    TEXT,
  notes               TEXT,

  -- Audit
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_aml_contact ON aml_checks(contact_id);
CREATE INDEX idx_aml_agent ON aml_checks(agent_id, status);
CREATE INDEX idx_aml_expiry ON aml_checks(expiry_date) WHERE status = 'passed';

-- Identity documents submitted for a check
CREATE TABLE aml_identity_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id        UUID NOT NULL REFERENCES aml_checks(id) ON DELETE CASCADE,
  document_id     UUID REFERENCES documents(id),   -- links to documents table for storage
  document_type   aml_document_type NOT NULL,
  points          INTEGER NOT NULL,

  -- Document details captured by agent
  document_number TEXT,
  issuing_authority TEXT,
  issue_date      DATE,
  expiry_date     DATE,
  is_expired      BOOLEAN GENERATED ALWAYS AS (expiry_date < CURRENT_DATE) STORED,

  -- Verification
  verified        BOOLEAN DEFAULT FALSE,
  verified_by     UUID REFERENCES users(id),
  verified_at     TIMESTAMPTZ,
  notes           TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_aml_docs_check ON aml_identity_documents(check_id);

-- Suspicious matter reports (SMR) — logged internally before AUSTRAC submission
CREATE TABLE aml_suspicious_matter_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES users(id),
  contact_id      UUID REFERENCES contacts(id),
  transaction_id  UUID REFERENCES transactions(id),
  description     TEXT NOT NULL,
  suspicion_basis TEXT NOT NULL,
  amount_aud      NUMERIC(12,2),
  report_date     DATE DEFAULT CURRENT_DATE,
  austrac_ref     TEXT,   -- filled after submission to AUSTRAC
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','acknowledged')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE aml_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_aml_checks" ON aml_checks
  USING (agent_id = auth.uid());

ALTER TABLE aml_identity_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_access_aml_docs" ON aml_identity_documents
  USING (
    EXISTS (
      SELECT 1 FROM aml_checks ac
      WHERE ac.id = aml_identity_documents.check_id
        AND ac.agent_id = auth.uid()
    )
  );

ALTER TABLE aml_suspicious_matter_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_smr" ON aml_suspicious_matter_reports
  USING (agent_id = auth.uid());
```

---

### C.2 Shared Types — `packages/shared/src/types/compliance.ts`

```typescript
import { z } from 'zod';

export const AmlDocumentTypeSchema = z.enum([
  'passport',
  'birth_certificate',
  'citizenship_certificate',
  'drivers_licence',
  'government_id_card',
  'proof_of_age_card',
  'medicare_card',
  'credit_card',
  'bank_card',
  'utility_bill',
  'bank_statement',
  'council_rates',
  'lease_agreement',
  'centrelink_letter',
]);

export const AmlCheckStatusSchema = z.enum([
  'pending',
  'in_progress',
  'passed',
  'failed',
  'expired',
  'waived',
]);

export const AmlCheckSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  agentId: z.string().uuid(),
  status: AmlCheckStatusSchema,
  verificationMethod: z
    .enum(['face_to_face', 'certified_copies', 'electronic', 'third_party'])
    .nullable(),
  totalPoints: z.number().int().min(0).max(300),
  pointsRequired: z.number().int().default(100),
  fullLegalName: z.string().nullable(),
  dateOfBirth: z.string().date().nullable(),
  residentialAddress: z.string().nullable(),
  addressVerified: z.boolean(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  expiryDate: z.string().date().nullable(),
  verifiedByUserId: z.string().uuid().nullable(),
  rejectionReason: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const AmlIdentityDocumentSchema = z.object({
  id: z.string().uuid(),
  checkId: z.string().uuid(),
  documentId: z.string().uuid().nullable(),
  documentType: AmlDocumentTypeSchema,
  points: z.number().int(),
  documentNumber: z.string().nullable(),
  issuingAuthority: z.string().nullable(),
  issueDate: z.string().date().nullable(),
  expiryDate: z.string().date().nullable(),
  isExpired: z.boolean(),
  verified: z.boolean(),
  verifiedBy: z.string().uuid().nullable(),
  verifiedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const CreateAmlCheckSchema = z.object({
  contactId: z.string().uuid(),
  verificationMethod: z.enum(['face_to_face', 'certified_copies', 'electronic', 'third_party']),
  fullLegalName: z.string().min(2),
  dateOfBirth: z.string().date(),
  residentialAddress: z.string().min(5),
});

export const AddAmlDocumentSchema = z.object({
  documentType: AmlDocumentTypeSchema,
  documentNumber: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issueDate: z.string().date().optional(),
  expiryDate: z.string().date().optional(),
  notes: z.string().optional(),
});

export type AmlCheck = z.infer<typeof AmlCheckSchema>;
export type AmlIdentityDocument = z.infer<typeof AmlIdentityDocumentSchema>;
export type CreateAmlCheck = z.infer<typeof CreateAmlCheckSchema>;
export type AddAmlDocument = z.infer<typeof AddAmlDocumentSchema>;
```

---

### C.3 Business Logic — `packages/business-logic/src/aml-engine.ts`

```typescript
interface AmlEngine {
  // Calculate current points tally for a check
  calculatePoints(documents: AmlIdentityDocument[]): number;

  // Validate that ID combination is legally valid (must have primary + secondary)
  validateDocumentSet(documents: AmlIdentityDocument[]): AmlValidationResult;

  // Generate AUSTRAC-formatted compliance report
  generateComplianceReport(
    agentId: string,
    period: { from: Date; to: Date },
  ): Promise<ComplianceReport>;

  // Check for expired verifications requiring renewal
  getExpiringChecks(agentId: string, daysAhead: number): Promise<AmlCheck[]>;

  // Mark check as complete if points >= 100 and required fields captured
  tryAutoComplete(checkId: string): Promise<AmlCheck>;
}

// 100-point validation rules:
// - Must have at least 1 document from primary OR secondary_a category
// - Total must be >= 100
// - If all documents are secondary_b/supporting → invalid (need at least one primary/secondary_a)
```

---

### C.4 API Routes — `apps/api/src/routes/compliance.ts`

| Method | Path                                             | Body/Params                                | Description               |
| ------ | ------------------------------------------------ | ------------------------------------------ | ------------------------- |
| GET    | `/api/v1/compliance/checks`                      | `status?`, `contactId?`                    | List AML checks           |
| POST   | `/api/v1/compliance/checks`                      | `CreateAmlCheck`                           | Start new check           |
| GET    | `/api/v1/compliance/checks/:id`                  | —                                          | Check detail + documents  |
| PATCH  | `/api/v1/compliance/checks/:id`                  | Partial `AmlCheck` fields                  | Update check fields       |
| POST   | `/api/v1/compliance/checks/:id/documents`        | `AddAmlDocument` + file                    | Add identity document     |
| DELETE | `/api/v1/compliance/checks/:id/documents/:docId` | —                                          | Remove document           |
| POST   | `/api/v1/compliance/checks/:id/complete`         | `{ outcome: 'passed'\|'failed', reason? }` | Finalise check            |
| GET    | `/api/v1/compliance/report`                      | `from`, `to`                               | AUSTRAC compliance report |
| GET    | `/api/v1/compliance/expiring`                    | `daysAhead?`                               | Checks expiring soon      |

---

### C.5 Web UI

**New Page:** `apps/web/src/app/buyers-agent/compliance/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ AML/KYC Compliance                    [+ Start New Check]   │
│                                                             │
│ Expiring Soon (2)                                           │
│ ⚠ Jane Smith — expires in 28 days       [Renew]            │
│ ⚠ Bob Jones — expires in 45 days        [Renew]            │
│                                                             │
│ All Checks                                    [Export CSV]  │
│ Contact         Status    Points  Method     Completed     │
│ Jane Smith      ✅ Passed  120/100  F2F       2025-01-15   │
│ Bob Jones       ✅ Passed  105/100  Certified 2025-02-01   │
│ Alice Lee       🔄 In Prog  55/100  F2F       —            │
│ Mark Brown      ⏳ Pending   0/100  —         —            │
└─────────────────────────────────────────────────────────────┘
```

**Detail Page:** `apps/web/src/app/buyers-agent/compliance/[id]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ AML Check — Jane Smith           Status: ✅ Passed          │
│                                                             │
│ Identity Information                                        │
│ Full Legal Name: Jane Elizabeth Smith                       │
│ Date of Birth: 15 March 1982                                │
│ Address: 42 Collins St, Melbourne VIC 3000  ✅ Verified     │
│                                                             │
│ Documents (120 / 100 points)   [+ Add Document]            │
│                                                             │
│ 🟢 Passport                           70 pts    ✅          │
│    No: PA1234567 | Exp: 2029-04-15                         │
│    [View Document]                                          │
│                                                             │
│ 🟡 Driver's Licence                   40 pts    ✅          │
│    No: DL987654 | NSW | Exp: 2027-08-23                    │
│    [View Document]                                          │
│                                                             │
│ ███████████████████████████████████  120 / 100 pts ✅       │
│                                                             │
│ Verified by: James Pino   15 Jan 2025   Method: Face-to-face│
│ Expires: 15 Jan 2027                                        │
│                                                             │
│ [Generate Compliance Report]                                │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

- `components/compliance/AmlCheckCard.tsx`
- `components/compliance/DocumentList.tsx`
- `components/compliance/PointsMeter.tsx` — progress bar to 100 pts
- `components/compliance/AddDocumentModal.tsx`

---

### C.6 Tests — Team C (Target: 30+ tests)

| File                       | Tests                                                               |
| -------------------------- | ------------------------------------------------------------------- |
| `aml-engine.test.ts`       | 15 tests: point calculation, document validation, report generation |
| `compliance.route.test.ts` | 12 tests: all endpoints, auth, complete workflow                    |
| `compliance.types.test.ts` | 8 tests: Zod validation incl. edge cases                            |

---

### C.7 Exit Criteria — Team C

- [ ] AML check created and linked to a contact
- [ ] Adding passport (70pt) + driver's licence (40pt) = 120pts, auto-complete triggers
- [ ] Adding only bank cards (25pt × 3 = 75pt) → validation rejects (need primary/secondary_a)
- [ ] Compliance report generates with all passed checks for a date range
- [ ] Expiring checks endpoint returns checks within `daysAhead` window
- [ ] Web UI shows checks list + status indicators
- [ ] Detail page shows points meter + document list
- [ ] 30+ tests passing

---

---

## Sprint 4 Timeline

```
Week 10: Foundations
  Day 1: All teams agree on DB schemas + type interfaces (2h joint session)
  Day 1-3: Migrations written + reviewed (peer review each other's SQL)
  Day 1-3: Shared types written in packages/shared/src/types/
  Day 3: Types exported from packages/shared/src/types/index.ts
  Day 3: Run supabase:types-gen to regenerate DB types

Week 11: Backend Core
  All teams: Implement business logic modules + API routes
  Day 6: Mid-sprint sync (30min) — unblock any interface contract questions
  End of week: All API routes unit-tested and passing

Week 12: Frontend + Polish
  All teams: Build web UI pages + components
  Day 12: Integration testing — wire frontend to real API
  Day 13: Mobile push notifications (Team A)
  Day 13: Mobile dashboard KPIs (Team B)
  Day 14: Full end-to-end smoke test per team
  Day 14: misc:lint across all new files
  Day 15: Sprint review — demo all 3 features
```

---

## Database Migration Order

Migrations must be applied in sequence (no parallel migration files):

```
00009_domain_sync.sql       (Team A)
00010_analytics.sql         (Team B)
00011_aml_kyc.sql           (Team C)
```

To avoid conflicts, **Team Lead signs off on migration order before Day 1**.

---

## Shared Type Exports

Add to `packages/shared/src/types/index.ts`:

```typescript
export * from './domain-sync';
export * from './analytics';
export * from './compliance';
```

---

## Sprint 4 Exit Criteria (All Teams)

- [ ] `npm run test` passes with ≥115 new tests (40 A + 45 B + 30 C)
- [ ] `npm run lint` clean across all new files
- [ ] All 3 DB migrations applied cleanly to local Supabase
- [ ] `supabase:types-gen` run after all migrations
- [ ] Domain sync imports listings for at least one test brief
- [ ] Analytics dashboard renders with real data
- [ ] AML check workflow completes end-to-end (create → add docs → complete)
- [ ] No pre-existing test regressions
- [ ] Beta milestone ready: `GET /api/v1/analytics/snapshot` + `/domain/status` + `/compliance/checks` all respond in <200ms

---

## Pre-Sprint 4 Prerequisites

The following must be true before Sprint 4 Day 1 starts:

1. **Sprint 2 AI drafting deployed** — not a hard blocker for any S4 feature, but analytics needs message send counts (from conversations table)
2. **Pre-existing 10 test failures fixed** (from Sprint 2 prerequisite) — baseline must be green
3. **Domain API credentials configured** — `DOMAIN_CLIENT_ID` + `DOMAIN_CLIENT_SECRET` in `.env`
4. **Supabase local running** — `npm run db:reset` works cleanly

---

## Risk Register

| Risk                                     | Likelihood | Impact | Mitigation                                                      |
| ---------------------------------------- | ---------- | ------ | --------------------------------------------------------------- |
| Domain API rate limits during bulk sync  | Medium     | Medium | Queue requests with 100ms delay; cache results 24h              |
| Analytics queries slow on large datasets | Medium     | Medium | Add DB indexes in migration; use daily snapshot table           |
| AML document upload size                 | Low        | Low    | 10MB file size limit on upload endpoint; PDF/JPEG only          |
| Migration conflict between teams         | Low        | High   | Team Lead reviews all 3 migrations on Day 1 before branching    |
| Domain API schema changes                | Low        | Medium | Version-pin DomainClient; add integration test against real API |

---

_Sprint 4 Plan v1.0 — Ready for implementation once Sprint 2 & 3 complete their backend layers._
_Next: Sprint 5 (Client Portal) plan available on request._
