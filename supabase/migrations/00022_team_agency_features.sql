-- Migration 00022: Team & Agency Features
-- Sprint 6: Growth & Scale — multi-agent dashboards, lead assignment rules, shared workflow templates

-- Lead assignment rules (for principal-level users)
CREATE TABLE IF NOT EXISTS lead_assignment_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       UUID NOT NULL REFERENCES offices(id),
  name            TEXT NOT NULL,
  rule_type       TEXT NOT NULL CHECK (rule_type IN ('round_robin', 'geographic', 'specialisation', 'manual')),
  conditions      JSONB NOT NULL DEFAULT '{}',
  priority        INT NOT NULL DEFAULT 0,
  assignee_ids    UUID[] NOT NULL DEFAULT '{}',
  round_robin_idx INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS lead_assignment_rules_office_active_idx
  ON lead_assignment_rules(office_id, is_active, priority DESC)
  WHERE deleted_at IS NULL;

-- Shared workflow template flags on existing workflows table
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS is_team_template BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS shared_by_agent_id UUID REFERENCES users(id);

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS workflows_team_template_idx
  ON workflows(is_team_template)
  WHERE is_team_template = true AND is_active = true;

-- Team performance snapshots (daily pre-aggregated, populated by TeamEngine.snapshotTeamPerformance)
CREATE TABLE IF NOT EXISTS team_performance_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       UUID NOT NULL REFERENCES offices(id),
  agent_id        UUID NOT NULL REFERENCES users(id),
  snapshot_date   DATE NOT NULL,
  active_contacts INT NOT NULL DEFAULT 0,
  active_deals    INT NOT NULL DEFAULT 0,
  deals_closed    INT NOT NULL DEFAULT 0,
  avg_response_h  NUMERIC,
  leads_received  INT NOT NULL DEFAULT 0,
  leads_converted INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(office_id, agent_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS team_performance_snapshots_office_date_idx
  ON team_performance_snapshots(office_id, snapshot_date DESC);

-- RLS
ALTER TABLE lead_assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Only principals in the same office can manage assignment rules
CREATE POLICY lead_assignment_rules_principal_policy ON lead_assignment_rules
  FOR ALL USING (
    office_id IN (
      SELECT office_id FROM users WHERE id = auth.uid()
    )
  );

-- Agents can only see their own performance; principals see all in office
CREATE POLICY team_performance_snapshots_policy ON team_performance_snapshots
  FOR SELECT USING (
    agent_id = auth.uid()
    OR office_id IN (
      SELECT office_id FROM users WHERE id = auth.uid() AND role = 'principal'
    )
  );

CREATE POLICY team_performance_snapshots_insert_policy ON team_performance_snapshots
  FOR INSERT WITH CHECK (
    office_id IN (
      SELECT office_id FROM users WHERE id = auth.uid()
    )
  );
