-- Sprint 4 / Team B: Analytics tables and aggregation views
-- Pre-aggregated daily snapshots + market data from Domain

-- ─── Daily Agent Snapshot ─────────────────────────────────────────────────────

CREATE TABLE analytics_daily_snapshots (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date               DATE    NOT NULL,

  -- Pipeline counts
  active_clients_count        INTEGER DEFAULT 0,
  new_leads_count             INTEGER DEFAULT 0,
  leads_contacted_count       INTEGER DEFAULT 0,
  briefs_created_count        INTEGER DEFAULT 0,
  inspections_done_count      INTEGER DEFAULT 0,
  offers_submitted_count      INTEGER DEFAULT 0,
  contracts_signed_count      INTEGER DEFAULT 0,
  settlements_count           INTEGER DEFAULT 0,

  -- Stage velocity JSON: [{stage, pipeline_type, in_count, avg_days}]
  stage_velocity              JSONB   DEFAULT '[]',

  -- Financial
  revenue_earned_aud          NUMERIC(12, 2) DEFAULT 0,
  pipeline_value_aud          NUMERIC(12, 2) DEFAULT 0,
  avg_deal_value_aud          NUMERIC(12, 2) DEFAULT 0,

  -- Communication
  messages_sent_count         INTEGER DEFAULT 0,
  avg_response_time_minutes   INTEGER,

  -- AI usage
  ai_matches_run              INTEGER        DEFAULT 0,
  ai_cost_aud                 NUMERIC(8, 4)  DEFAULT 0,

  created_at                  TIMESTAMPTZ    DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ    DEFAULT NOW(),

  UNIQUE (agent_id, snapshot_date)
);

CREATE INDEX idx_snapshots_agent_date ON analytics_daily_snapshots (agent_id, snapshot_date DESC);

-- ─── Market Data Snapshots (from Domain) ─────────────────────────────────────

CREATE TABLE market_data_snapshots (
  id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  suburb                  TEXT    NOT NULL,
  postcode                TEXT,
  state                   TEXT    CHECK (state IN ('NSW','VIC','QLD','SA','WA','TAS','NT','ACT')),
  snapshot_date           DATE    NOT NULL,
  property_type           TEXT    NOT NULL
    CHECK (property_type IN ('house', 'unit', 'townhouse')),

  -- Pricing
  median_sale_price       NUMERIC(12, 2),
  median_days_on_market   NUMERIC(5,  1),
  clearance_rate          NUMERIC(5,  2),  -- percentage 0–100
  total_auctions          INTEGER,
  sold_count              INTEGER,
  new_listings_count      INTEGER,

  -- Year-on-year
  price_change_1y_percent NUMERIC(5, 2),

  data_source             TEXT DEFAULT 'domain',
  created_at              TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (suburb, snapshot_date, property_type)
);

CREATE INDEX idx_market_suburb  ON market_data_snapshots (suburb,  snapshot_date DESC);
CREATE INDEX idx_market_postcode ON market_data_snapshots (postcode, snapshot_date DESC)
  WHERE postcode IS NOT NULL;
CREATE INDEX idx_market_state   ON market_data_snapshots (state,   snapshot_date DESC)
  WHERE state IS NOT NULL;

-- ─── Pipeline Funnel View (live, no pre-aggregation needed) ───────────────────

-- Requires transactions.stage_entered_at column — add if it doesn't exist
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE VIEW pipeline_funnel_stats AS
SELECT
  c.assigned_agent_id AS agent_id,
  t.pipeline_type,
  t.current_stage                                                AS stage,
  COUNT(*)                                                       AS active_count,
  AVG(
    EXTRACT(EPOCH FROM (NOW() - COALESCE(t.stage_entered_at, t.created_at))) / 86400
  )::NUMERIC(6, 1)                                               AS avg_days_in_stage,
  COUNT(*) FILTER (
    WHERE COALESCE(t.stage_entered_at, t.created_at) > NOW() - INTERVAL '30 days'
  )                                                              AS new_30d
FROM transactions t
JOIN contacts   c  ON c.id  = t.contact_id
JOIN client_briefs cb ON cb.contact_id = c.id AND cb.is_deleted = FALSE
WHERE t.is_deleted = FALSE
GROUP BY c.assigned_agent_id, t.pipeline_type, t.current_stage;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE analytics_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_snapshots     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_own_snapshots"
  ON analytics_daily_snapshots
  USING (agent_id = auth.uid());

CREATE POLICY "service_role_write_snapshots"
  ON analytics_daily_snapshots
  FOR ALL
  WITH CHECK (TRUE);

CREATE POLICY "all_agents_read_market_data"
  ON market_data_snapshots
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "service_role_write_market_data"
  ON market_data_snapshots
  FOR ALL
  WITH CHECK (TRUE);
