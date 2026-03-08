-- Migration 00021: Off-Market Properties
-- Sprint 6: Growth & Scale — manual off-market listing creation + brief matching

CREATE TABLE IF NOT EXISTS off_market_properties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES users(id),
  office_id       UUID NOT NULL REFERENCES offices(id),
  address_line1   TEXT NOT NULL,
  suburb          TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),
  postcode        TEXT NOT NULL CHECK (postcode ~ '^\d{4}$'),
  property_type   TEXT NOT NULL CHECK (property_type IN ('house', 'apartment', 'townhouse', 'land', 'other')),
  bedrooms        INT CHECK (bedrooms >= 0),
  bathrooms       INT CHECK (bathrooms >= 0),
  car_spaces      INT CHECK (car_spaces >= 0),
  land_size_sqm   NUMERIC CHECK (land_size_sqm > 0),
  asking_price    NUMERIC CHECK (asking_price > 0),
  source          TEXT NOT NULL CHECK (source IN ('vendor_direct', 'selling_agent', 'referral', 'door_knock', 'other')),
  source_name     TEXT,
  agent_notes     TEXT,
  visibility      TEXT NOT NULL DEFAULT 'agent_only' CHECK (visibility IN ('agent_only', 'sent_to_client')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_offer', 'sold', 'withdrawn')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS off_market_matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  off_market_id         UUID NOT NULL REFERENCES off_market_properties(id),
  client_brief_id       UUID NOT NULL REFERENCES client_briefs(id),
  match_score           NUMERIC NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  status                TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'sent_to_client', 'rejected')),
  sent_to_client_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  UNIQUE(off_market_id, client_brief_id)
);

CREATE INDEX IF NOT EXISTS off_market_properties_agent_status_idx
  ON off_market_properties(agent_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS off_market_properties_suburb_idx
  ON off_market_properties(suburb, state)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS off_market_matches_brief_status_idx
  ON off_market_matches(client_brief_id, status)
  WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE off_market_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_market_matches ENABLE ROW LEVEL SECURITY;

-- Only the owning agent or same office can see off-market properties
CREATE POLICY off_market_properties_agent_policy ON off_market_properties
  FOR ALL USING (
    agent_id = auth.uid()
    OR office_id IN (
      SELECT office_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY off_market_matches_agent_policy ON off_market_matches
  FOR ALL USING (
    off_market_id IN (
      SELECT id FROM off_market_properties
      WHERE agent_id = auth.uid()
        OR office_id IN (SELECT office_id FROM users WHERE id = auth.uid())
    )
  );
