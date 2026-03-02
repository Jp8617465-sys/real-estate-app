-- RealFlow: Pipeline Migration Tracking
-- Migration 00006: Adds pipeline_migration_history table for tracking transaction pipeline changes
--
-- This table maintains an audit trail of all pipeline migrations, supporting:
-- - Tracking transitions between buying, selling, and buyers-agent pipelines
-- - Recording client brief creation during migrations
-- - Batch migration support for bulk operations
-- - Rollback capabilities with reason tracking
-- - Full audit trail with migration context

-- ─── Pipeline Migration History Table ───────────────────────────────────

CREATE TABLE pipeline_migration_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Transaction reference
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

  -- Original state
  original_pipeline_type TEXT NOT NULL,
  original_stage TEXT NOT NULL,

  -- New state
  new_pipeline_type TEXT NOT NULL,
  new_stage TEXT NOT NULL,

  -- Client brief tracking (for transitions to buyers-agent pipeline)
  client_brief_created BOOLEAN NOT NULL DEFAULT false,
  client_brief_id UUID REFERENCES client_briefs(id) ON DELETE SET NULL,

  -- Migration metadata
  migration_batch_id UUID,
  migration_reason TEXT,
  migration_context JSONB,

  -- Audit trail
  migrated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Rollback support
  rolled_back BOOLEAN NOT NULL DEFAULT false,
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT
);

-- ─── Indexes ────────────────────────────────────────────────────────────

-- Query by transaction to view all migrations for a transaction
CREATE INDEX idx_pipeline_migration_history_transaction
  ON pipeline_migration_history (transaction_id, migrated_at DESC);

-- Query by batch for bulk migration operations
CREATE INDEX idx_pipeline_migration_history_batch
  ON pipeline_migration_history (migration_batch_id)
  WHERE migration_batch_id IS NOT NULL;

-- Query active (non-rolled-back) migrations
CREATE INDEX idx_pipeline_migration_history_rollback
  ON pipeline_migration_history (rolled_back, migrated_at DESC)
  WHERE NOT rolled_back;

-- Query by pipeline type transitions
CREATE INDEX idx_pipeline_migration_history_pipeline_types
  ON pipeline_migration_history (original_pipeline_type, new_pipeline_type);

-- Query by client brief for reverse lookups
CREATE INDEX idx_pipeline_migration_history_client_brief
  ON pipeline_migration_history (client_brief_id)
  WHERE client_brief_id IS NOT NULL;

-- ─── Row Level Security ─────────────────────────────────────────────────

ALTER TABLE pipeline_migration_history ENABLE ROW LEVEL SECURITY;

-- Users can view migration history for transactions in their office
CREATE POLICY pipeline_migration_history_select ON pipeline_migration_history FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- Only the migrating user or office members can insert migration records
CREATE POLICY pipeline_migration_history_insert ON pipeline_migration_history FOR INSERT
  WITH CHECK (
    migrated_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- Only admins and principals can update migration records (for rollbacks)
CREATE POLICY pipeline_migration_history_update ON pipeline_migration_history FOR UPDATE
  USING (
    migrated_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
    AND get_current_user_role() IN ('admin', 'principal')
  );

-- ─── Comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE pipeline_migration_history IS
  'Audit trail for all pipeline migrations, supporting rollback and batch operations';

COMMENT ON COLUMN pipeline_migration_history.transaction_id IS
  'The transaction that was migrated';

COMMENT ON COLUMN pipeline_migration_history.original_pipeline_type IS
  'Pipeline type before migration (buying, selling, buyers-agent)';

COMMENT ON COLUMN pipeline_migration_history.new_pipeline_type IS
  'Pipeline type after migration (buying, selling, buyers-agent)';

COMMENT ON COLUMN pipeline_migration_history.migration_batch_id IS
  'Groups multiple migrations performed together in a batch operation';

COMMENT ON COLUMN pipeline_migration_history.migration_context IS
  'Additional context about the migration (e.g., automated vs manual, trigger reason)';

COMMENT ON COLUMN pipeline_migration_history.rolled_back IS
  'Indicates if this migration has been rolled back';
