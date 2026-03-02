-- Sprint 4 / Team A: Domain.com.au sync infrastructure
-- Tracks sync jobs, price changes, and auction results

-- ─── Domain Sync Jobs ─────────────────────────────────────────────────────────

CREATE TABLE domain_sync_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  sync_type           TEXT NOT NULL DEFAULT 'manual'
    CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
  listings_found      INTEGER DEFAULT 0,
  listings_imported   INTEGER DEFAULT 0,
  matches_triggered   INTEGER DEFAULT 0,
  error_message       TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domain_sync_jobs_agent ON domain_sync_jobs (agent_id, created_at DESC);
CREATE INDEX idx_domain_sync_jobs_status ON domain_sync_jobs (status);

-- ─── Price Change Tracking ────────────────────────────────────────────────────

CREATE TABLE property_price_changes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID REFERENCES properties(id) ON DELETE SET NULL,
  domain_listing_id   TEXT NOT NULL,
  previous_price      NUMERIC(12, 2),
  new_price           NUMERIC(12, 2) NOT NULL,
  change_percent      NUMERIC(5, 2),
  change_type         TEXT NOT NULL
    CHECK (change_type IN ('reduction', 'increase', 'price_guide_set')),
  notified_agent_ids  UUID[] DEFAULT '{}',
  detected_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_changes_listing  ON property_price_changes (domain_listing_id);
CREATE INDEX idx_price_changes_detected ON property_price_changes (detected_at DESC);
CREATE INDEX idx_price_changes_property ON property_price_changes (property_id)
  WHERE property_id IS NOT NULL;

-- ─── Auction Results ──────────────────────────────────────────────────────────

CREATE TABLE auction_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID REFERENCES properties(id) ON DELETE SET NULL,
  domain_listing_id     TEXT,
  suburb                TEXT NOT NULL,
  postcode              TEXT,
  state                 TEXT,
  auction_date          DATE NOT NULL,
  result                TEXT NOT NULL
    CHECK (result IN ('sold', 'passed_in', 'withdrawn', 'sold_prior')),
  sold_price            NUMERIC(12, 2),
  reserve_price         NUMERIC(12, 2),
  registered_bidders    INTEGER,
  agent_name            TEXT,
  agency_name           TEXT,
  raw_data              JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_suburb ON auction_results (suburb, auction_date DESC);
CREATE INDEX idx_auction_date   ON auction_results (auction_date DESC);
CREATE INDEX idx_auction_state  ON auction_results (state, auction_date DESC)
  WHERE state IS NOT NULL;

-- ─── Enrich selling_agent_profiles with Domain data ──────────────────────────

ALTER TABLE selling_agent_profiles
  ADD COLUMN IF NOT EXISTS domain_agent_id         TEXT,
  ADD COLUMN IF NOT EXISTS domain_profile_url      TEXT,
  ADD COLUMN IF NOT EXISTS listings_count_active   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listings_count_sold     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_enriched_at        TIMESTAMPTZ;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE domain_sync_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_price_changes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_results         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_own_sync_jobs"
  ON domain_sync_jobs
  USING (agent_id = auth.uid());

CREATE POLICY "agents_see_relevant_price_changes"
  ON property_price_changes
  FOR SELECT
  USING (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   property_matches pm
      JOIN   client_briefs cb ON cb.id = pm.brief_id
      WHERE  pm.property_id = property_price_changes.property_id
        AND  cb.agent_id = auth.uid()
    )
  );

CREATE POLICY "service_role_write_price_changes"
  ON property_price_changes
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "all_agents_read_auction_results"
  ON auction_results
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "service_role_write_auction_results"
  ON auction_results
  FOR INSERT
  WITH CHECK (TRUE);
