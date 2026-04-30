# Sprint 8: Deal Intelligence — Full Feature Plan

**Sprint:** 8
**Weeks:** 23–26
**Theme:** Every deal tells its story — win/loss context, health scoring, close probability, communication history, and trend analysis to improve close rates over time.
**Status:** Planning (Sprint 7 Frontend Modernisation in progress)
**Planned:** 2026-03-09
**Prerequisite:** Sprint 7 complete (PageMotion, Skeleton, Toast, Dark Mode available to Sprint 8 components)

---

## 1. Sprint Overview

### Goal

Sprint 7 made RealFlow look mature. Sprint 8 makes it think. When Lachlan opens a deal card he should immediately know: Is this deal healthy? How likely is it to close? What happened last in this deal? Why did the last deal fall over?

This sprint adds four interlocking capabilities:

1. **Deal Health Score** — a 0–100 score computed from stage progress, engagement recency, communication volume, client response rate, stage velocity, and deal momentum. Visible as a colour-coded indicator on every pipeline card.
2. **Close Probability + AI Narrative** — a rule-based probability (0–95%) with a Claude-generated one-line explanation. Shown on the card and expanded in the drawer.
3. **Deal Detail Drawer** — click any card to open a side panel with full timeline (activities + messages + stage changes merged), health breakdown, and outcome form.
4. **Outcome Recording + Trends** — structured win/loss/withdrawal data with reason categories, competitor tracking, and a trends dashboard showing win rate by stage, loss reason breakdown, deal velocity, and weighted pipeline forecast.

### What this sprint does NOT touch

No new agent-facing workflows beyond the three new triggers (`deal.won`, `deal.lost`, `deal.health_dropped`). No new Supabase tables beyond column additions to `transactions` and `offices`. No portal changes. No Domain/REA integrations.

### Sprint Scope

- **Pipelines:** Buyers Agent (priority) + Buyer. Seller pipeline reads health scores but has no outcome form this sprint.
- **Apps:** `apps/web` (primary), `apps/mobile` (outcome badge + deal detail sheet), `apps/api`, `packages/business-logic`, `packages/shared`
- **Migration:** One additive migration (`00024`) — new nullable columns only. Zero data loss.

### Success Condition

A buyers agent can open their pipeline, see at a glance which deals are healthy vs at-risk via the colour border, click into any deal and see every communication + stage change in one chronological feed, record why they won or lost, and open the trends page to identify their biggest loss pattern this quarter.

---

## 2. Key Decisions

| Topic                      | Decision                                                            | Rationale                                                            |
| -------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Pipeline scope             | Buyers Agent + Buyer                                                | Seller pipeline less complex, can adopt in Sprint 9                  |
| Deal detail UX             | Side panel / drawer                                                 | Agent stays in context on the board                                  |
| Win/Loss form visibility   | Only editable when deal reaches terminal state (won/lost/withdrawn) | Prevents premature outcome recording                                 |
| "Close Deal" action        | Dropdown button in drawer (Won / Lost / Withdrawn)                  | Lost/Withdrawn deals never reach `settled` stage naturally           |
| Win/Loss format            | Category dropdown + optional competitor name + free-text notes      | Structured for trend charts, flexible for nuance                     |
| Health score card display  | Colour-coded left border + score badge + close probability %        | At-a-glance signal without cluttering the card                       |
| Close probability method   | Rule-based score + Claude 1-line narrative                          | Low cost (~$0.0005/call), auditable algorithm, human-readable output |
| Comms timeline             | Auto-link by `transaction_id` + date-range context comms            | Includes early pre-deal comms, tagged lightly                        |
| Deal navigator             | Respects current board filter; Past Deals toggle                    | Daily review workflow without leaving the board                      |
| Trends visibility          | Agent = own data; Principal = whole-office toggle (RLS-backed)      | Role system already exists on `users.role`                           |
| Visibility configurability | `offices.visibility_settings` JSONB column                          | Customer-configurable, defaults to permissive                        |

---

## 3. Data Model

### 3.1 Migration `00024_deal_intelligence.sql`

```sql
-- ============================================================
-- Sprint 8: Deal Intelligence
-- Additive only — all new columns are nullable
-- Highest existing migration: 00023_round_robin_function.sql
-- ============================================================

-- Outcome tracking (editable only at terminal stage)
ALTER TABLE transactions
  ADD COLUMN outcome              TEXT
    CHECK (outcome IN ('won', 'lost', 'withdrawn')),
  ADD COLUMN outcome_reason       TEXT
    CHECK (outcome_reason IN (
      'price_too_high', 'finance_fell_through', 'competition',
      'client_withdrew', 'property_issues', 'timeline_mismatch',
      'budget_revised', 'other'
    )),
  ADD COLUMN outcome_notes        TEXT,
  ADD COLUMN competitor_agent     TEXT,
  ADD COLUMN closed_at            TIMESTAMPTZ,

  -- Health & forecast (computed, refreshed on activity events)
  ADD COLUMN health_score                INTEGER
    CHECK (health_score BETWEEN 0 AND 100),
  ADD COLUMN close_probability           NUMERIC(4,3)
    CHECK (close_probability BETWEEN 0 AND 1),
  ADD COLUMN close_probability_narrative TEXT,
  ADD COLUMN health_score_updated_at     TIMESTAMPTZ;

-- Indexes for trend queries
CREATE INDEX idx_transactions_outcome_agent
  ON transactions (assigned_agent_id, outcome, closed_at)
  WHERE NOT is_deleted;

CREATE INDEX idx_transactions_outcome_pipeline
  ON transactions (pipeline_type, current_stage, outcome)
  WHERE NOT is_deleted;

CREATE INDEX idx_transactions_health_score
  ON transactions (assigned_agent_id, health_score)
  WHERE NOT is_deleted AND outcome IS NULL;

-- Office-level visibility settings (customer-configurable, Phase 9)
ALTER TABLE offices
  ADD COLUMN visibility_settings JSONB NOT NULL DEFAULT '{
    "principal_can_view_agent_outcomes": true,
    "principal_can_view_health_scores": true,
    "principal_can_view_deal_trends": true,
    "principal_can_view_all_comms": false
  }'::jsonb;

-- RLS: agents see own, principals see whole office
-- (extends existing RLS, does not replace it)
CREATE POLICY transactions_principal_read ON transactions
  FOR SELECT USING (
    NOT is_deleted AND (
      assigned_agent_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('principal', 'admin')
          AND u.office_id = (
            SELECT office_id FROM users
            WHERE id = transactions.assigned_agent_id
          )
      )
    )
  );
```

### 3.2 `packages/shared/src/types/deal-outcome.ts` (new file)

```typescript
import { z } from 'zod';

export type DealOutcome = 'won' | 'lost' | 'withdrawn';

export type DealOutcomeReason =
  | 'price_too_high'
  | 'finance_fell_through'
  | 'competition'
  | 'client_withdrew'
  | 'property_issues'
  | 'timeline_mismatch'
  | 'budget_revised'
  | 'other';

export const OUTCOME_REASON_LABELS: Record<DealOutcomeReason, string> = {
  price_too_high: 'Price too high',
  finance_fell_through: 'Finance fell through',
  competition: 'Lost to competition',
  client_withdrew: 'Client withdrew',
  property_issues: 'Property issues',
  timeline_mismatch: 'Timeline mismatch',
  budget_revised: 'Budget revised',
  other: 'Other',
};

export const RecordOutcomeSchema = z
  .object({
    transactionId: z.string().uuid(),
    outcome: z.enum(['won', 'lost', 'withdrawn']),
    reason: z
      .enum([
        'price_too_high',
        'finance_fell_through',
        'competition',
        'client_withdrew',
        'property_issues',
        'timeline_mismatch',
        'budget_revised',
        'other',
      ])
      .optional(),
    notes: z.string().max(2000).optional(),
    competitorAgent: z.string().max(200).optional(),
  })
  .refine((data) => data.outcome !== 'lost' || data.reason !== undefined, {
    message: 'reason is required when outcome is lost',
    path: ['reason'],
  });

export type RecordOutcomeInput = z.infer<typeof RecordOutcomeSchema>;

// Terminal stages per pipeline type — outcome form shows when reached
export const TERMINAL_WON_STAGES: Record<string, string[]> = {
  buying: ['settled'],
  selling: ['settled'],
  'buyers-agent': ['settled-nurture'],
};

export function isTerminalEligible(
  pipelineType: string,
  currentStage: string,
  existingOutcome: string | null,
): boolean {
  if (existingOutcome !== null) return true; // already closed — read-only view
  const wonStages = TERMINAL_WON_STAGES[pipelineType] ?? [];
  return wonStages.includes(currentStage);
  // Note: lost/withdrawn triggered via "Close Deal" action at any stage
}
```

### 3.3 `packages/shared/src/types/deal-health.ts` (new file)

```typescript
import { z } from 'zod';

export interface DealHealthContext {
  transactionId: string;
  pipelineType: string;
  currentStage: string;
  stageOrder: number; // 1-based position in pipeline
  totalStages: number;
  daysInCurrentStage: number;
  avgDaysInStageForPipeline: number; // from PipelineVelocity analytics
  lastCommunicationDate: string | null;
  totalCommunications: number;
  communicationsLast7Days: number;
  inboundCount: number; // client→agent
  outboundCount: number; // agent→client
  inspectionsCount: number;
  offerRoundsCount: number;
  offerStatus: string | null;
  briefCompleteness: number | null; // 0–1, BA pipeline only
  contractPrice: number | null;
  offerAmount: number | null;
  daysSinceCreated: number;
}

export interface HealthFactorScore {
  score: number;
  max: number;
  label: string; // human-readable explanation of the score
}

export interface HealthScoreBreakdown {
  stageProgression: HealthFactorScore; // max 25
  communicationRecency: HealthFactorScore; // max 25
  communicationVolume: HealthFactorScore; // max 15
  clientResponseRate: HealthFactorScore; // max 15
  stageVelocity: HealthFactorScore; // max 10
  dealMomentum: HealthFactorScore; // max 10
}

export type DealHealthSignal = 'healthy' | 'at-risk' | 'stale';

export interface DealHealthScore {
  total: number; // 0–100
  breakdown: HealthScoreBreakdown;
  signal: DealHealthSignal; // ≥70 healthy, 40–69 at-risk, <40 stale
  closeProbability: number; // 0–1 (rule-based)
  closeProbabilityNarrative: string; // AI 1-liner, max 80 chars
  forecastValue: number; // closeProbability × deal value (AUD)
  updatedAt: string; // ISO datetime
}

// Unified timeline event — merges activities + messages + stage_transitions
export type TimelineEventType = 'activity' | 'message' | 'stage_change';

export interface DealTimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string; // ISO, sorted ASC
  // activity fields
  activityType?: string;
  title?: string;
  description?: string;
  // message fields
  channel?: string;
  direction?: 'inbound' | 'outbound';
  excerpt?: string; // first 120 chars of message
  // stage change fields
  fromStage?: string;
  toStage?: string;
  stageChangeReason?: string;
  // shared
  agentName?: string;
  contactName?: string;
  isContextComm?: boolean; // true = linked by date range, not transaction_id
}
```

### 3.4 Extend `packages/shared/src/types/analytics.ts`

Add these types to the existing file:

```typescript
// --- Sprint 8 additions ---

export interface StageWinRate {
  stage: string;
  pipelineType: string;
  totalEntered: number;
  totalWon: number;
  totalLost: number;
  totalWithdrawn: number;
  winRate: number; // 0–1
  avgDaysInStageWon: number;
  avgDaysInStageLost: number;
}

export interface LossReasonBreakdown {
  reason: string; // DealOutcomeReason value
  label: string; // human-readable
  count: number;
  pct: number; // 0–1, share of all losses
  avgDealValueLost: number; // AUD
}

export interface DealVelocityPeriod {
  period: string; // 'YYYY-MM'
  avgDaysToCloseWon: number;
  avgDaysToCloseLost: number;
  dealsWon: number;
  dealsLost: number;
}

export interface DealValueTrendPeriod {
  period: string;
  avgDealValueWon: number; // AUD
  totalSettledRevenue: number;
  weightedPipeline: number; // Σ(close_probability × deal_value) across active deals
}

export interface DealTrends {
  stageWinRates: StageWinRate[];
  lossReasons: LossReasonBreakdown[];
  velocity: DealVelocityPeriod[];
  valueTrends: DealValueTrendPeriod[];
  // KPI summary
  overallWinRate: number;
  avgDaysToClose: number;
  totalWeightedPipeline: number; // AUD
  agentId: string | null; // null = whole office (principal view)
  generatedAt: string;
}
```

### 3.5 Extend `packages/shared/src/types/activity.ts`

Add `'deal-closed'` to the `ActivityType` enum.

---

## 4. Business Logic

### 4.1 `DealHealthEngine` — `packages/business-logic/src/deal-health-engine.ts`

**Complexity: Medium**

```typescript
class DealHealthEngine {
  /**
   * Compute health score 0–100 from deal context.
   * Pure function — no I/O. Safe to call in tests without mocks.
   */
  computeHealthScore(ctx: DealHealthContext): DealHealthScore;

  /**
   * Rule-based close probability (0–0.95).
   * Formula:
   *   stageBase     = (stageOrder / totalStages) × 0.50
   *   healthContrib = (score.total / 100) × 0.35
   *   offerBonus    = accepted → 0.10, submitted → 0.05, countered → 0.07, else 0
   *   result        = min(stageBase + healthContrib + offerBonus, 0.95)
   */
  computeCloseProbability(score: DealHealthScore, ctx: DealHealthContext): number;

  /**
   * Claude 1-line narrative (~400 tokens, ~$0.0005 per call).
   * Called async, result stored in transactions.close_probability_narrative.
   * Maximum once per hour per deal (guard on health_score_updated_at).
   */
  async getAINarrative(
    ctx: DealHealthContext,
    probability: number,
    ai: AnthropicClient,
  ): Promise<string>;

  /**
   * Refresh health + probability for one deal.
   * Called after: stage transition, new activity, new message, nightly cron.
   * Writes health_score, close_probability, close_probability_narrative,
   * health_score_updated_at back to transactions.
   */
  async refreshDealHealth(
    supabase: SupabaseClient,
    transactionId: string,
    ai: AnthropicClient,
  ): Promise<void>;
}
```

**Health Score Weighting:**

| Factor                | Max points | Scoring logic                                                |
| --------------------- | ---------- | ------------------------------------------------------------ |
| Stage progression     | 25         | `(stageOrder / totalStages) × 25`                            |
| Communication recency | 25         | Comms in last 7d → 25; last 14d → 15; last 30d → 8; >30d → 0 |
| Communication volume  | 15         | ≥10 total → 15; ≥5 → 10; ≥2 → 5; 0 → 0                       |
| Client response rate  | 15         | `(inboundCount / max(totalComms, 1)) × 15`                   |
| Stage velocity        | 10         | `daysInStage < avgDays` → 10; `< 2×avg` → 5; else → 0        |
| Deal momentum         | 10         | Each inspection or offer round adds 2pts, max 10             |

**Signal thresholds:** ≥70 = `healthy`, 40–69 = `at-risk`, <40 = `stale`

**`refreshDealHealth` is triggered by:**

1. `POST /pipeline/:id/transition` (stage change)
2. `POST /transactions/:id/outcome` (close event — sets health to null, probability to 0 or 1)
3. Any new `activities` row insert for this transaction (via route handler, not DB trigger)
4. Any new `conversation_messages` row with this `transaction_id`
5. Nightly Render cron job — refreshes all active deals (outcome IS NULL)

### 4.2 `DealOutcomeEngine` — `packages/business-logic/src/deal-outcome-engine.ts`

**Complexity: Medium**

```typescript
class DealOutcomeEngine {
  /**
   * Record win/loss/withdrawal.
   * Guards: calls isTerminalEligible() — throws 422 if not eligible.
   * Side effects:
   *   - Updates outcome, outcome_reason, outcome_notes, competitor_agent, closed_at
   *   - Sets health_score = null (deal closed, no longer scored)
   *   - Sets close_probability = 1 (won) or 0 (lost/withdrawn)
   *   - Inserts activities row: type 'deal-closed'
   *   - Emits workflow trigger: deal.won or deal.lost
   *   - Does NOT hard-delete anything
   */
  async recordOutcome(
    supabase: SupabaseClient,
    input: RecordOutcomeInput,
    agentId: string,
  ): Promise<void>;

  /**
   * Unified timeline for a deal.
   * Merges activities + conversation_messages + stage_transitions via UNION ALL.
   * Sorted ASC by timestamp.
   * Messages without transaction_id that fall within deal's date window
   * are included as context comms (isContextComm: true).
   */
  async getDealTimeline(
    supabase: SupabaseClient,
    transactionId: string,
    pagination?: { limit: number; before?: string },
  ): Promise<{ events: DealTimelineEvent[]; hasMore: boolean; totalCount: number }>;

  /**
   * Trend aggregations for the dashboard.
   * agentId: restrict to one agent (agent role, or principal choosing specific agent)
   * officeId: restrict to whole office (principal officeWide toggle)
   * Cached 1h via existing cache.ts pattern.
   */
  async computeDealTrends(
    supabase: SupabaseClient,
    filters: {
      agentId?: string;
      officeId?: string;
      pipelineType?: string;
      from: string;
      to: string;
    },
  ): Promise<DealTrends>;
}
```

**`getDealTimeline` SQL (UNION ALL pattern):**

```sql
SELECT id, 'activity'     AS type, created_at AS ts, type AS activity_type,
       title, description, NULL AS channel, NULL AS direction,
       NULL AS excerpt, NULL AS from_stage, NULL AS to_stage
FROM   activities
WHERE  transaction_id = $1

UNION ALL

SELECT id, 'message'      AS type, created_at AS ts, NULL AS activity_type,
       NULL AS title, NULL AS description,
       (content->>'channel') AS channel,
       direction,
       LEFT(content->>'text', 120) AS excerpt,
       NULL AS from_stage, NULL AS to_stage
FROM   conversation_messages
WHERE  transaction_id = $1
   OR  (
     contact_id = (SELECT contact_id FROM transactions WHERE id = $1)
     AND created_at BETWEEN
       (SELECT created_at FROM transactions WHERE id = $1)
       AND COALESCE((SELECT closed_at FROM transactions WHERE id = $1), NOW())
     AND transaction_id IS NULL   -- context comms
   )

UNION ALL

SELECT id, 'stage_change' AS type, created_at AS ts, NULL AS activity_type,
       NULL AS title, NULL AS description,
       NULL AS channel, NULL AS direction, NULL AS excerpt,
       from_stage, to_stage
FROM   stage_transitions
WHERE  transaction_id = $1

ORDER BY ts ASC
LIMIT  $2 OFFSET $3
```

---

## 5. API Endpoints

All routes added to `apps/api/src/routes/` following existing Fastify patterns.

### 5.1 `POST /api/v1/transactions/:id/outcome`

```typescript
// Body: RecordOutcomeSchema (Zod)
// Response 200: { transactionId, outcome, closedAt }
// Response 422: deal not terminal-eligible | reason missing on lost
// Response 409: outcome already recorded (allow update within 24h)
// Response 403: not assigned_agent_id
```

After writing outcome, calls `DealHealthEngine.refreshDealHealth()` (sets health to null, probability to ground truth).

### 5.2 `GET /api/v1/transactions/:id/timeline`

```typescript
// Query: ?limit=50&before=<ISO timestamp>
// Response 200: { transactionId, events: DealTimelineEvent[], hasMore, totalCount }
```

### 5.3 `GET /api/v1/transactions/:id/health`

```typescript
// Returns current health score + close probability (no AI refresh)
// Used by drawer's ↻ button to get latest computed values
// Response 200: DealHealthScore
```

### 5.4 `GET /api/v1/analytics/deal-trends`

```typescript
// Query: ?pipelineType=buyers-agent&from=2025-01-01&to=2026-03-09
//        &agentId=uuid       ← principal only
//        &officeWide=true    ← principal only

// Authorization logic:
const requester = await getUser(request);
const visSettings = await getOfficeVisibility(requester.officeId);

if (requester.role === 'agent' || requester.role === 'assistant') {
  filters.agentId = requester.id; // force own data
} else if (query.officeWide && visSettings.principal_can_view_deal_trends) {
  filters.officeId = requester.officeId; // whole office
} else {
  filters.agentId = query.agentId ?? requester.id;
}

// Response: DealTrends (cached 1h)
```

---

## 6. Web UI

### 6.1 Pipeline Card Health Indicator

**Files to modify:** `apps/web/src/components/pipeline/pipeline-board.tsx`, `apps/web/src/components/buyers-agent/ba-pipeline-board.tsx`

Add click handler (separate from drag — click = open drawer, drag = transition stage):

```typescript
// Distinguish click from drag with a drag-distance threshold
// If drag distance < 4px on mouseup → treat as click → open drawer
```

Card visual additions:

```
┌──────────────────────────────────────┐
│ ▌ Lachlan Chen               78 ●   │  ← green left border + score badge
│   12 Banksia Rd, Mosman             │
│   $1.85M  ·  14d in stage           │
│   61% likely                        │  ← close probability (muted text)
└──────────────────────────────────────┘

Colour rules (left border + badge):
  health_score >= 70  →  border-l-4 border-success  (green)
  health_score 40–69  →  border-l-4 border-warning   (amber)
  health_score < 40   →  border-l-4 border-error     (red)
  health_score = null →  border-l-4 border-neutral-200 (grey, loading)
```

### 6.2 Deal Drawer — `apps/web/src/components/deals/deal-drawer.tsx`

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  ← 3 of 14 →  │  12 Banksia Rd, Mosman  │  [Close Deal ▾] [✕]  │
├──────────────────────────────────────────────────────────┤
│  ● Lachlan Chen  •  offer-negotiate  •  $1.85M           │
├──────────────────────────────────────────────────────────┤
│  Deal Health   [██████████░░░░] 78/100  •  AT RISK       │
│  Close Prob    61%  ↻ refresh                            │
│  "Strong engagement but price 3% above suburb median"    │
│  Forecast      $1.85M × 61% = $1.13M weighted            │
├──────────────────────────────────────────────────────────┤
│  [Overview]  [Timeline]  [Communications]                │
├──────────────────────────────────────────────────────────┤
│  OVERVIEW TAB — Health breakdown                         │
│  Stage progression    22/25  ████████░  offer-negotiate  │
│  Comm recency         18/25  ███████░░  Last: 2d ago     │
│  Comm volume          12/15  ████████░  11 total         │
│  Client response      11/15  ███████░░  52% response     │
│  Stage velocity        8/10  ████████░  12d (avg 15d)    │
│  Deal momentum         7/10  ███████░░  2 insp, 1 offer  │
└──────────────────────────────────────────────────────────┘
```

**"Close Deal" dropdown** (top right, all active deals):

- Options: `Mark as Won`, `Mark as Lost`, `Mark as Withdrawn`
- `Mark as Won` only enabled at terminal-eligible stage (`settled`, `settled-nurture`)
- `Mark as Lost` / `Mark as Withdrawn` available at any active stage
- On select → opens **Outcome Sheet**

**Outcome Sheet** (sub-panel within drawer):

```
┌────────────────────────────────────────┐
│  Record Outcome                        │
│  ──────────────────────────────────    │
│  Result      ○ Won  ● Lost  ○ Withdrawn │
│  Reason      [Lost to competition  ▾]  │  required if Lost
│  Competitor  [Ray White — optional  ]  │
│  Notes       [They came in $50k above  │
│               our walk-away price...] │
│                                        │
│  [Save Outcome]                        │
└────────────────────────────────────────┘
```

After saving: form becomes read-only. 24-hour grace period for corrections (audit trail in `stage_transitions.reason`). After 24h, locked — any change requires a principal to re-open.

When deal is already at `settled`/`settled-nurture` (won naturally), outcome sheet auto-opens on drawer load if `outcome IS NULL`.

**Timeline Tab:**

```
○ 2 Mar — Stage moved: enquiry → consult-qualify
● 3 Mar — Email sent: "Following up on your brief"
● 4 Mar — SMS received: "Yes we're very keen"  [context]
○ 5 Mar — Inspection logged: 12 Banksia Rd
● 7 Mar — Email received: "When is the next open?"
○ 8 Mar — Offer submitted: $1.8M (round 1)
○ 9 Mar — Deal closed — Lost  (competition)
```

Context comms (tagged `isContextComm: true`) render with slightly lighter weight and a `[context]` label.

**Communications Tab:** Filtered view of timeline showing messages only. Channel filter chips: All / Email / SMS / Call / WhatsApp / DM.

### 6.3 New files for deal drawer

```
apps/web/src/components/deals/
  deal-drawer.tsx           ← drawer shell + tab state
  deal-timeline.tsx         ← reusable timeline feed (shared with contact cards, Sprint 9)
  deal-outcome-form.tsx     ← win/loss form
  deal-health-breakdown.tsx ← score bars (overview tab)
  deal-navigator.tsx        ← ← 3 of 14 → with Past Deals toggle
```

### 6.4 Hooks

```
apps/web/src/hooks/
  use-deal-timeline.ts     ← GET /transactions/:id/timeline, paginated
  use-deal-health.ts       ← GET /transactions/:id/health + manual refresh
  use-deal-trends.ts       ← GET /analytics/deal-trends
  use-record-outcome.ts    ← POST /transactions/:id/outcome mutation
```

### 6.5 Deal Trends Page — `apps/web/src/app/analytics/deals/page.tsx`

**Page header controls:**

- Date range: Last 30d / Last 90d / Last 12 months / Custom range
- Pipeline type: Buyers Agent / Buyer
- Agent selector: `[Whole Office ▾]` — visible to `principal` / `admin` only
- Agent view: no selector, locked to own data

**KPI cards (row above charts):**

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Win Rate    │ │ Avg to Close│ │ Settled Rev │ │ Wtd Pipeline│
│ 64%         │ │ 47 days     │ │ $2.3M       │ │ $4.7M       │
│ +8% vs Q3  │ │ -6d vs Q3  │ │ this period │ │ forecast    │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Four chart panels (Recharts — already in codebase):**

| Panel                 | Chart type              | Data source                    |
| --------------------- | ----------------------- | ------------------------------ |
| Win Rate by Stage     | Horizontal funnel bar   | `stageWinRates`                |
| Loss Reason Breakdown | Donut + ranked table    | `lossReasons`                  |
| Deal Velocity         | Dual line (won vs lost) | `velocity`                     |
| Pipeline Forecast     | Area chart + KPI        | `valueTrends.weightedPipeline` |

---

## 7. Mobile UI

### 7.1 `DealCard.tsx` — outcome badge + health indicator

```
┌──────────────────────────────────────┐
│ ▌ Lachlan Chen                      │  ← green/amber/red left border
│   $1.85M  ·  14 days in stage       │
│   61% likely  ·  ● 78               │  ← close prob + health badge
│                          [Lost ✗]   │  ← outcome pill (closed deals only)
└──────────────────────────────────────┘
```

Zero layout shift on existing cards — all new elements are additive.

### 7.2 Deal Detail — `apps/mobile/src/app/(tabs)/deals/[id].tsx`

Bottom sheet with three tabs: Overview → Timeline → Comms.

- Overview: health score bars (Progress component), close probability, forecast value
- Timeline: `FlatList<DealTimelineEvent>` for performance on long histories
- Comms: filtered messages only, channel chips

Outcome recording: `ActionSheet` → "Won / Lost / Withdrawn" → `Modal` for reason + notes.

### 7.3 New mobile hook

```
apps/mobile/src/hooks/use-deal-timeline.ts  ← same API call + DealTimelineEvent[] shape
```

---

## 8. Role-Based Visibility

### Role matrix (based on existing `users.role` enum: agent | assistant | principal | admin)

| Role        | Deal trends  | Other agents' outcomes | Whole-office toggle | Config settings |
| ----------- | ------------ | ---------------------- | ------------------- | --------------- |
| `agent`     | Own only     | ✗                      | ✗                   | ✗               |
| `assistant` | Own only     | ✗                      | ✗                   | ✗               |
| `principal` | Own + toggle | ✓ (if office setting)  | ✓                   | ✓               |
| `admin`     | Everything   | ✓                      | ✓                   | ✓               |

### `offices.visibility_settings` defaults

```json
{
  "principal_can_view_agent_outcomes": true,
  "principal_can_view_health_scores": true,
  "principal_can_view_deal_trends": true,
  "principal_can_view_all_comms": false
}
```

Phase 9 adds a settings UI at `/settings/office/visibility` for the principal to configure these toggles. Phase 1–8 enforces the defaults at the API layer with no UI.

---

## 9. Workflow Integration

Add to `WorkflowTriggerType` enum in `packages/shared/src/types/workflow.ts`:

| Trigger               | Fires when                                         | Primary use case                                               |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| `deal.won`            | `outcome = 'won'` recorded                         | Auto-send settlement congratulations, create invoice task      |
| `deal.lost`           | `outcome = 'lost'` recorded                        | Send "thank you" email template, schedule 3-month nurture task |
| `deal.health_dropped` | `health_score` crosses below 40 for the first time | Alert agent: "This deal needs attention"                       |

**Trigger payload (all three):**

```typescript
{
  transactionId:   string
  contactId:       string
  outcome?:        DealOutcome        // deal.won and deal.lost only
  reason?:         DealOutcomeReason  // deal.lost only
  competitorAgent?: string
  contractPrice?:  number
  pipelineType:    string
  previousHealthScore?: number        // deal.health_dropped only
}
```

`deal.health_dropped` fires from `DealHealthEngine.refreshDealHealth()` when:

- Previous `health_score >= 40` AND new score `< 40`

---

## 10. Testing Strategy

**Target: +45 new tests → Sprint 7 end total 1447 → Sprint 8 target: 1492**

| File                                                                | Tests                                                                                                                                                                                                                                                                                                                                          | Count |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `packages/business-logic/src/__tests__/deal-health-engine.test.ts`  | computeHealthScore returns 0–100, all 6 factor weightings correct, signal thresholds (≥70 healthy, 40–69 at-risk, <40 stale), close probability formula, offer accepted bonus, offer submitted bonus, caps at 0.95, forecastValue = probability × contractPrice, briefCompleteness used in BA pipeline, health drops to null on outcome record | 10    |
| `packages/business-logic/src/__tests__/deal-outcome-engine.test.ts` | recordOutcome writes all 5 outcome columns, rejects when not terminal-eligible (422), emits deal-closed activity, sets close_probability to 1 on won, sets to 0 on lost, getDealTimeline merges and sorts 3 sources ASC, context comms tagged isContextComm, computeDealTrends win rate maths, loss reason pcts sum to 1                       | 10    |
| `packages/shared/src/types/__tests__/deal-outcome.test.ts`          | Zod validates RecordOutcomeInput, reason required when outcome=lost, accepts optional fields, isTerminalEligible correct per pipeline type                                                                                                                                                                                                     | 5     |
| `apps/api/src/routes/__tests__/deal-intelligence.test.ts`           | POST /outcome 200, POST /outcome 422 no reason on lost, POST /outcome 422 non-terminal, GET /timeline sorted ASC, GET /timeline pagination, GET /analytics/deal-trends agent-scoped, principal officeWide, principal blocked by visibility_settings                                                                                            | 8     |
| `apps/web/src/components/deals/__tests__/deal-drawer.test.tsx`      | renders health score + close probability, tabs switch, Close Deal dropdown shows 3 options, Won disabled at non-terminal stage, outcome form submits mutation, read-only after submit, navigator prev/next works, Past Deals toggle adds closed deals                                                                                          | 7     |
| `apps/web/src/components/deals/__tests__/deal-timeline.test.tsx`    | renders activity events, renders message events with excerpt, renders stage change events, sorts ASC, context comms render lighter style, channel filter chips work                                                                                                                                                                            | 5     |

---

## 11. Phased Delivery

Each phase ships independently and delivers standalone value.

| Phase | Deliverable                                                                                 | Value                               | Complexity |
| ----- | ------------------------------------------------------------------------------------------- | ----------------------------------- | ---------- |
| **1** | Migration 00024 + shared types + `DealHealthEngine` + `DealOutcomeEngine` + 4 API endpoints | Backend complete, Postman-testable  | Medium     |
| **2** | Deal Drawer (web): health breakdown, close probability, outcome form, timeline              | Core feature live on web            | Medium     |
| **3** | Pipeline card health indicator (colour border + score badge + close %)                      | Visible on every card at a glance   | Low        |
| **4** | Deal Navigator (prev/next cycling + Past Deals toggle)                                      | Daily stand-up review workflow      | Low        |
| **5** | Deal Trends page (web) + role-gated principal view                                          | Analytics + coaching insights       | Medium     |
| **6** | Mobile: outcome badge + deal detail sheet                                                   | Lachlan's phone experience complete | Low–Medium |
| **7** | Workflow triggers: `deal.won`, `deal.lost`, `deal.health_dropped`                           | Automation on close + early warning | Low        |
| **8** | AI narrative refresh + `GET /transactions/:id/health` endpoint                              | Forecast narrative live             | Medium     |
| **9** | `offices.visibility_settings` config UI at `/settings/office/visibility`                    | Customer-configurable role access   | Low        |

---

## 12. Database Migration Plan

- Migration `00024` is **purely additive**. All new columns are nullable. Zero data loss.
- Existing transactions get `outcome = NULL` → UI treats as "active / outcome not recorded"
- Settled deals from Sprints 1–6 show "Outcome not recorded" badge — agent can fill retroactively
- `health_score = NULL` for all existing deals → nightly cron populates on first run
- `offices.visibility_settings` defaults to permissive — same behaviour agents already expect
- New RLS policy is additive — existing agent-scoped queries still work unchanged

---

## 13. Out of Scope — Planned for Sprint 9+

The following items were discussed and explicitly deferred. They are listed here to prevent scope creep and to give the Sprint 9 planner a head start.

---

### Sprint 9 Candidates

| Feature                                          | Why deferred                                                                          | Notes                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Contact-level activity timeline**              | Reuses `deal-timeline.tsx` from Sprint 8 — wait for that component to stabilise first | Same `DealTimelineEvent[]` shape, filtered by `contact_id` across all transactions         |
| **AI outcome suggestion**                        | Non-blocking enhancement — Sprint 8 ships without it                                  | Claude analyses timeline and pre-fills the outcome form reason field with confidence score |
| **Competitor tracking analytics**                | Needs more outcome data volume first                                                  | Win rate vs named competitor agents, market share analysis                                 |
| **Seller pipeline deal intelligence**            | Buyer + BA pipelines first to validate model                                          | Same engine, different stage weights                                                       |
| **Push notifications for `deal.health_dropped`** | Mobile notification sprint                                                            | Uses existing Expo notifications infrastructure                                            |
| **Auction date cron alerts**                     | Deferred from Sprint 5, still outstanding                                             | Schema and types done (Sprint 5), cron wiring outstanding                                  |
| **Contact health score**                         | Extension of deal health concept to contacts                                          | Scores contacts by overall engagement, last contact date, follow-up overdue                |

---

### Sprint 10 Candidates

| Feature                              | Why deferred                                                           | Notes                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Predictive lead scoring with ML**  | Needs volume of labelled outcome data first (Sprint 8 captures it)     | Train on outcome + health score data once 3+ months of labelled deals exist    |
| **Cohort analysis**                  | Dashboard extension for principals                                     | Year-on-year, agent-vs-agent comparison, office benchmarking                   |
| **Deal post-mortem AI report**       | Enhancement to outcome recording                                       | Claude generates a 1-page deal summary (timeline → outcome → lessons) on close |
| **`offices.visibility_settings` UI** | Phase 9 of Sprint 8 stretch target — if not shipped, becomes Sprint 10 | Settings page at `/settings/office/visibility`                                 |
| **White-label visibility themes**    | Commercial decision                                                    | Custom branding + role permission templates per franchise group                |
| **Data export (CSV/PDF)**            | Operations request                                                     | Export trends data, deal history, outcome reports for principal review         |

---

### Not in v1 Scope

| Feature                              | Decision                |
| ------------------------------------ | ----------------------- |
| CRM marketplace / integrations API   | v2                      |
| i18n / localisation                  | Not in v1 scope         |
| Native splash screen redesign        | Expo managed workflow   |
| A/B testing framework                | v1.5                    |
| Recharts replacement (D3 or Victory) | Separate charting spike |
| Storybook component documentation    | Separate tooling sprint |

---

## Appendix: Day 1 Checklist

- [ ] Migration `00024_deal_intelligence.sql` written and tested against local Supabase
- [ ] `packages/shared/src/types/deal-outcome.ts` created and exported from `packages/shared/src/index.ts`
- [ ] `packages/shared/src/types/deal-health.ts` created and exported
- [ ] `packages/shared/src/types/analytics.ts` extended with Sprint 8 types
- [ ] `ActivityType` enum extended with `'deal-closed'` in `activity.ts`
- [ ] `WorkflowTriggerType` enum extended with `'deal.won'`, `'deal.lost'`, `'deal.health_dropped'`
- [ ] `DealHealthEngine` class created (pure functions first — no I/O — so unit tests run immediately)
- [ ] `DealOutcomeEngine` class created
- [ ] Vitest configs already added in Sprint 7 for `apps/web`, `apps/portal`, `apps/mobile` — confirm still present before starting web component work
- [ ] Confirm `framer-motion` and `@radix-ui/react-toast` installed in `apps/web` (Sprint 7 dependency)
- [ ] Sprint 7 `PageMotion`, `Skeleton`, `Toast` components available for Sprint 8 pages to consume

---

_Sprint 8 plan authored 2026-03-09. Prerequisite: Sprint 7 Frontend Modernisation complete._
_Feature planning sign-off required from Product Owner and Engineering Lead before BUILD phase begins._
