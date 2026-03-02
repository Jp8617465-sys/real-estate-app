-- Sprint 3 Post-Review: RLS Policies + Composite Indexes
-- Adds Row Level Security to the 6 Sprint 3 tables and composite indexes
-- for the most common query patterns.

-- ─── Enable RLS on Sprint 3 tables ──────────────────────────────────────────

ALTER TABLE push_device_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_action_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_sequences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments     ENABLE ROW LEVEL SECURITY;

-- ─── push_device_tokens: users see only their own tokens ─────────────────────

CREATE POLICY push_device_tokens_user ON push_device_tokens
  FOR ALL USING (user_id = get_current_user_id());

-- ─── notification_preferences: users see only their own prefs ────────────────

CREATE POLICY notification_preferences_user ON notification_preferences
  FOR ALL USING (user_id = get_current_user_id());

-- ─── notifications: users see only their own notifications ───────────────────

CREATE POLICY notifications_user ON notifications
  FOR ALL USING (user_id = get_current_user_id());

-- ─── daily_action_items: users see only their own action lists ───────────────

CREATE POLICY daily_action_items_user ON daily_action_items
  FOR ALL USING (user_id = get_current_user_id());

-- ─── follow_up_sequences ─────────────────────────────────────────────────────
-- Agents see:
--   1. Sequences they created
--   2. Global templates (created_by IS NULL)
--   3. Public templates (is_template = true)

CREATE POLICY follow_up_sequences_select ON follow_up_sequences
  FOR SELECT USING (
    created_by = get_current_user_id()
    OR created_by IS NULL
    OR is_template = true
  );

CREATE POLICY follow_up_sequences_insert ON follow_up_sequences
  FOR INSERT WITH CHECK (created_by = get_current_user_id());

CREATE POLICY follow_up_sequences_update ON follow_up_sequences
  FOR UPDATE USING (created_by = get_current_user_id());

CREATE POLICY follow_up_sequences_delete ON follow_up_sequences
  FOR DELETE USING (created_by = get_current_user_id());

-- ─── sequence_enrollments: users see enrollments they created ────────────────

CREATE POLICY sequence_enrollments_user ON sequence_enrollments
  FOR ALL USING (enrolled_by = get_current_user_id());

-- ─── Composite indexes for common query patterns ─────────────────────────────

-- notifications: the list endpoint always filters by user_id + category + status
-- partial index on non-deleted rows keeps it lean as data grows
CREATE INDEX idx_notifications_user_category_status
  ON notifications (user_id, category, status)
  WHERE is_deleted = false;

-- sequence_enrollments: contact detail page queries by contact_id + status
CREATE INDEX idx_enrollments_contact_status
  ON sequence_enrollments (contact_id, status);
