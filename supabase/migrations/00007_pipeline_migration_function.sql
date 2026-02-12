-- RealFlow: Pipeline Migration Function
-- Migration 00007: SQL function for migrating transactions to buyers-agent pipeline
--
-- This function handles the complete migration process:
-- 1. Captures original transaction state
-- 2. Updates transaction to buyers-agent pipeline with new stage
-- 3. Records migration in pipeline_migration_history
-- 4. Logs stage transition
-- 5. Creates activity record for audit trail
-- 6. Returns structured result with all created record IDs

-- ─── Migration Function ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION migrate_transaction_to_buyers_agent(
  p_transaction_id UUID,
  p_target_stage TEXT,
  p_client_brief_id UUID DEFAULT NULL,
  p_migration_batch_id UUID DEFAULT NULL,
  p_migration_reason TEXT DEFAULT NULL,
  p_migration_context JSONB DEFAULT NULL,
  p_migrated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original_pipeline_type TEXT;
  v_original_stage TEXT;
  v_contact_id UUID;
  v_property_id UUID;
  v_assigned_agent_id UUID;
  v_migration_history_id UUID;
  v_stage_transition_id UUID;
  v_activity_id UUID;
  v_migrated_by UUID;
  v_client_brief_created BOOLEAN;
BEGIN
  -- Validate p_target_stage is a valid buyers_agent_stage
  IF p_target_stage NOT IN (
    'enquiry', 'consult-qualify', 'engaged', 'strategy-brief',
    'active-search', 'offer-negotiate', 'under-contract', 'settled-nurture'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid target stage for buyers-agent pipeline',
      'valid_stages', ARRAY[
        'enquiry', 'consult-qualify', 'engaged', 'strategy-brief',
        'active-search', 'offer-negotiate', 'under-contract', 'settled-nurture'
      ]
    );
  END IF;

  -- Get original transaction state
  SELECT
    pipeline_type::TEXT,
    current_stage,
    contact_id,
    property_id,
    assigned_agent_id
  INTO
    v_original_pipeline_type,
    v_original_stage,
    v_contact_id,
    v_property_id,
    v_assigned_agent_id
  FROM transactions
  WHERE id = p_transaction_id
    AND NOT is_deleted;

  -- Check if transaction exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction not found or has been deleted'
    );
  END IF;

  -- Check if already on buyers-agent pipeline
  IF v_original_pipeline_type = 'buyers-agent' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction is already on buyers-agent pipeline'
    );
  END IF;

  -- Use provided migrated_by or get current user
  v_migrated_by := COALESCE(p_migrated_by, get_current_user_id());

  IF v_migrated_by IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unable to determine migrating user'
    );
  END IF;

  -- Determine if client brief was created
  v_client_brief_created := (p_client_brief_id IS NOT NULL);

  -- ─── Step 1: Update transaction ──────────────────────────────────────

  UPDATE transactions
  SET
    pipeline_type = 'buyers-agent',
    current_stage = p_target_stage,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- ─── Step 2: Insert migration history record ─────────────────────────

  INSERT INTO pipeline_migration_history (
    transaction_id,
    original_pipeline_type,
    original_stage,
    new_pipeline_type,
    new_stage,
    client_brief_created,
    client_brief_id,
    migration_batch_id,
    migration_reason,
    migration_context,
    migrated_by,
    migrated_at
  ) VALUES (
    p_transaction_id,
    v_original_pipeline_type,
    v_original_stage,
    'buyers-agent',
    p_target_stage,
    v_client_brief_created,
    p_client_brief_id,
    p_migration_batch_id,
    p_migration_reason,
    p_migration_context,
    v_migrated_by,
    NOW()
  )
  RETURNING id INTO v_migration_history_id;

  -- ─── Step 3: Insert stage transition ─────────────────────────────────

  INSERT INTO stage_transitions (
    transaction_id,
    from_stage,
    to_stage,
    triggered_by,
    reason,
    created_at
  ) VALUES (
    p_transaction_id,
    v_original_pipeline_type || ':' || v_original_stage,
    'buyers-agent:' || p_target_stage,
    v_migrated_by,
    COALESCE(
      p_migration_reason,
      'Migrated to buyers-agent pipeline'
    ),
    NOW()
  )
  RETURNING id INTO v_stage_transition_id;

  -- ─── Step 4: Create activity record ──────────────────────────────────

  INSERT INTO activities (
    contact_id,
    transaction_id,
    property_id,
    type,
    title,
    description,
    metadata,
    created_by,
    created_at
  ) VALUES (
    v_contact_id,
    p_transaction_id,
    v_property_id,
    'stage-change',
    'Pipeline Migration: ' || v_original_pipeline_type || ' → buyers-agent',
    COALESCE(
      p_migration_reason,
      format(
        'Transaction migrated from %s (%s) to buyers-agent pipeline (%s)',
        v_original_pipeline_type,
        v_original_stage,
        p_target_stage
      )
    ),
    jsonb_build_object(
      'migration_history_id', v_migration_history_id,
      'original_pipeline_type', v_original_pipeline_type,
      'original_stage', v_original_stage,
      'new_pipeline_type', 'buyers-agent',
      'new_stage', p_target_stage,
      'client_brief_id', p_client_brief_id,
      'client_brief_created', v_client_brief_created,
      'migration_batch_id', p_migration_batch_id,
      'migration_context', p_migration_context
    ),
    v_migrated_by,
    NOW()
  )
  RETURNING id INTO v_activity_id;

  -- ─── Return success with all IDs ──────────────────────────────────────

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'migration_history_id', v_migration_history_id,
    'stage_transition_id', v_stage_transition_id,
    'activity_id', v_activity_id,
    'original_pipeline_type', v_original_pipeline_type,
    'original_stage', v_original_stage,
    'new_pipeline_type', 'buyers-agent',
    'new_stage', p_target_stage,
    'client_brief_id', p_client_brief_id,
    'client_brief_created', v_client_brief_created,
    'migrated_at', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'transaction_id', p_transaction_id
    );
END;
$$;

-- ─── Comments ──────────────────────────────────────────────────────────

COMMENT ON FUNCTION migrate_transaction_to_buyers_agent IS
  'Migrates a transaction to the buyers-agent pipeline with full audit trail';

-- ─── Grant Execute Permission ─────────────────────────────────────────

-- Grant execute to authenticated users (RLS will handle office-level access)
GRANT EXECUTE ON FUNCTION migrate_transaction_to_buyers_agent TO authenticated;

-- ─── Example Usage ────────────────────────────────────────────────────

-- Example 1: Simple migration to engaged stage
-- SELECT migrate_transaction_to_buyers_agent(
--   p_transaction_id := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
--   p_target_stage := 'engaged',
--   p_migration_reason := 'Client decided to engage buyers agent services',
--   p_migrated_by := 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'
-- );

-- Example 2: Migration with client brief and context
-- SELECT migrate_transaction_to_buyers_agent(
--   p_transaction_id := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
--   p_target_stage := 'strategy-brief',
--   p_client_brief_id := 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
--   p_migration_batch_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
--   p_migration_reason := 'Bulk migration from buying to buyers-agent',
--   p_migration_context := '{"source": "admin_panel", "automated": false}'::jsonb,
--   p_migrated_by := 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'
-- );
