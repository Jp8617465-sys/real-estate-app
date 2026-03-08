-- Migration 00023: Atomic round-robin assignment function
-- Eliminates read-modify-write race condition in lead assignment rules.
-- Uses SELECT FOR UPDATE to lock the row, then returns the current assignee
-- and advances the index in a single transaction.

CREATE OR REPLACE FUNCTION claim_round_robin_assignee(rule_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignee_ids UUID[];
  v_current_idx  INT;
  v_next_idx     INT;
  v_assignee_id  UUID;
  v_len          INT;
BEGIN
  -- Lock the row for the duration of this transaction
  SELECT assignee_ids, round_robin_idx
    INTO v_assignee_ids, v_current_idx
    FROM lead_assignment_rules
   WHERE id = rule_id
     AND is_active = true
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_len := array_length(v_assignee_ids, 1);

  IF v_len IS NULL OR v_len = 0 THEN
    RETURN NULL;
  END IF;

  -- PostgreSQL arrays are 1-based
  v_assignee_id := v_assignee_ids[(v_current_idx % v_len) + 1];
  v_next_idx    := (v_current_idx + 1) % v_len;

  UPDATE lead_assignment_rules
     SET round_robin_idx = v_next_idx,
         updated_at      = now()
   WHERE id = rule_id;

  RETURN jsonb_build_object(
    'assignee_id', v_assignee_id::TEXT,
    'next_idx',    v_next_idx
  );
END;
$$;
