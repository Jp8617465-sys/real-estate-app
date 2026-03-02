-- RealFlow: Pipeline Migration Tracking
-- Migration 00006: Adds pipeline_migration_history table for tracking transaction pipeline changes

CREATE TABLE pipeline_migration_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  original_pipeline_type TEXT NOT NULL,
  original_stage TEXT NOT NULL,
  new_pipeline_type TEXT NOT NULL,
  new_stage TEXT NOT NULL,
  client_brief_created BOOLEAN NOT NULL DEFAULT false,
  client_brief_id UUID REFERENCES client_briefs(id) ON DELETE SET NULL,
  migration_batch_id UUID,
  migration_reason TEXT,
  migration_context JSONB,
  migrated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rolled_back BOOLEAN NOT NULL DEFAULT false,
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT
);

CREATE INDEX idx_pipeline_migration_history_transaction
  ON pipeline_migration_history (transaction_id, migrated_at DESC);

CREATE INDEX idx_pipeline_migration_history_batch
  ON pipeline_migration_history (migration_batch_id)
  WHERE migration_batch_id IS NOT NULL;

CREATE INDEX idx_pipeline_migration_history_rollback
  ON pipeline_migration_history (rolled_back, migrated_at DESC)
  WHERE NOT rolled_back;

CREATE INDEX idx_pipeline_migration_history_pipeline_types
  ON pipeline_migration_history (original_pipeline_type, new_pipeline_type);

CREATE INDEX idx_pipeline_migration_history_client_brief
  ON pipeline_migration_history (client_brief_id)
  WHERE client_brief_id IS NOT NULL;

ALTER TABLE pipeline_migration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY pipeline_migration_history_select ON pipeline_migration_history FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY pipeline_migration_history_insert ON pipeline_migration_history FOR INSERT
  WITH CHECK (
    migrated_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY pipeline_migration_history_update ON pipeline_migration_history FOR UPDATE
  USING (
    migrated_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
    AND get_current_user_role() IN ('admin', 'principal')
  );

COMMENT ON TABLE pipeline_migration_history IS
  'Audit trail for all pipeline migrations, supporting rollback and batch operations';
