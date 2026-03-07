-- Alert subscriptions (per agent per brief)
CREATE TABLE property_alert_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief_id            UUID NOT NULL REFERENCES client_briefs(id) ON DELETE CASCADE,
  score_threshold     INTEGER NOT NULL DEFAULT 70 CHECK (score_threshold BETWEEN 50 AND 100),
  channels            TEXT[] NOT NULL DEFAULT '{push}' CHECK (
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

-- Alert events (audit log)
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
