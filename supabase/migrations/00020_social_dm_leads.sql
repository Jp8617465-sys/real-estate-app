-- Migration 00020: Social DM Leads
-- Sprint 6: Growth & Scale — social DM → CRM ingestion pipeline

CREATE TABLE IF NOT EXISTS social_dm_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         TEXT NOT NULL CHECK (channel IN ('facebook_dm', 'instagram_dm', 'linkedin_dm')),
  external_id     TEXT NOT NULL,
  sender_name     TEXT,
  sender_handle   TEXT,
  message_text    TEXT,
  raw_payload     JSONB,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'dismissed')),
  contact_id      UUID REFERENCES contacts(id),
  agent_id        UUID NOT NULL REFERENCES users(id),
  office_id       UUID NOT NULL REFERENCES offices(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS social_dm_leads_channel_external_id_idx
  ON social_dm_leads(channel, external_id);

CREATE INDEX IF NOT EXISTS social_dm_leads_agent_status_idx
  ON social_dm_leads(agent_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS social_lead_id UUID REFERENCES social_dm_leads(id);

-- RLS
ALTER TABLE social_dm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_dm_leads_agent_policy ON social_dm_leads
  FOR ALL USING (
    agent_id = auth.uid()
    OR office_id IN (
      SELECT office_id FROM users WHERE id = auth.uid()
    )
  );
