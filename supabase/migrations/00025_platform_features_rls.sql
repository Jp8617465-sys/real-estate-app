-- =====================================================================
-- Migration 00025: RLS Policies for Platform Features
-- =====================================================================

-- ─── Subscriptions RLS ──────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their office subscription"
  ON subscriptions FOR SELECT
  USING (office_id = get_current_user_office_id());

CREATE POLICY "Admins and principals can manage subscriptions"
  ON subscriptions FOR ALL
  USING (
    office_id = get_current_user_office_id()
    AND get_current_user_role() IN ('admin', 'principal')
  );

-- ─── Payment History RLS ────────────────────────────────────────────

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their office payments"
  ON payment_history FOR SELECT
  USING (office_id = get_current_user_office_id());

-- Payment history is only written by webhooks (service role), no INSERT/UPDATE policy needed for users

-- ─── Report Definitions RLS ─────────────────────────────────────────

ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared and own reports"
  ON report_definitions FOR SELECT
  USING (
    office_id = get_current_user_office_id()
    AND (is_shared = true OR created_by = get_current_user_id() OR is_template = true)
  );

CREATE POLICY "Users can create reports in their office"
  ON report_definitions FOR INSERT
  WITH CHECK (
    office_id = get_current_user_office_id()
    AND created_by = get_current_user_id()
  );

CREATE POLICY "Users can update their own reports"
  ON report_definitions FOR UPDATE
  USING (created_by = get_current_user_id())
  WITH CHECK (office_id = get_current_user_office_id());

CREATE POLICY "Users can delete their own reports"
  ON report_definitions FOR DELETE
  USING (created_by = get_current_user_id());

-- ─── Report Schedules RLS ───────────────────────────────────────────

ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage schedules for their reports"
  ON report_schedules FOR ALL
  USING (
    report_id IN (
      SELECT id FROM report_definitions
      WHERE office_id = get_current_user_office_id()
        AND created_by = get_current_user_id()
    )
  );

-- ─── Dashboard Widgets RLS ──────────────────────────────────────────

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own widgets"
  ON dashboard_widgets FOR ALL
  USING (user_id = get_current_user_id());

-- ─── Saved Views RLS ────────────────────────────────────────────────

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared and own views"
  ON saved_views FOR SELECT
  USING (
    office_id = get_current_user_office_id()
    AND (is_shared = true OR user_id = get_current_user_id())
  );

CREATE POLICY "Users can create views"
  ON saved_views FOR INSERT
  WITH CHECK (
    office_id = get_current_user_office_id()
    AND user_id = get_current_user_id()
  );

CREATE POLICY "Users can update their own views"
  ON saved_views FOR UPDATE
  USING (user_id = get_current_user_id());

CREATE POLICY "Users can delete their own views"
  ON saved_views FOR DELETE
  USING (user_id = get_current_user_id());

-- ─── Calendar Connections RLS ───────────────────────────────────────

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calendar connections"
  ON calendar_connections FOR ALL
  USING (user_id = get_current_user_id());

-- ─── Calendar Events RLS ────────────────────────────────────────────

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events in their office"
  ON calendar_events FOR SELECT
  USING (office_id = get_current_user_office_id());

CREATE POLICY "Users can manage their own events"
  ON calendar_events FOR INSERT
  WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update their own events"
  ON calendar_events FOR UPDATE
  USING (user_id = get_current_user_id());

CREATE POLICY "Users can delete their own events"
  ON calendar_events FOR DELETE
  USING (user_id = get_current_user_id());

-- ─── Import Jobs RLS ────────────────────────────────────────────────

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view imports in their office"
  ON import_jobs FOR SELECT
  USING (office_id = get_current_user_office_id());

CREATE POLICY "Users can create imports"
  ON import_jobs FOR INSERT
  WITH CHECK (
    office_id = get_current_user_office_id()
    AND user_id = get_current_user_id()
  );

CREATE POLICY "Users can update their own imports"
  ON import_jobs FOR UPDATE
  USING (user_id = get_current_user_id());

-- ─── Import Errors RLS ──────────────────────────────────────────────

ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view errors for their office imports"
  ON import_errors FOR SELECT
  USING (
    import_job_id IN (
      SELECT id FROM import_jobs
      WHERE office_id = get_current_user_office_id()
    )
  );

-- ─── Onboarding Progress RLS ────────────────────────────────────────

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their office onboarding"
  ON onboarding_progress FOR SELECT
  USING (office_id = get_current_user_office_id());

CREATE POLICY "Admins can manage onboarding"
  ON onboarding_progress FOR ALL
  USING (
    office_id = get_current_user_office_id()
    AND get_current_user_role() IN ('admin', 'principal')
  );
