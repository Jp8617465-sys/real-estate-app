-- RealFlow Row Level Security (RLS) Policies
-- Multi-tenant data isolation: users can only access data within their office

-- ─── Enable RLS on All Tables ───────────────────────────────────────

ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_interested_buyers ENABLE ROW LEVEL SECURITY;

-- ─── Helper: Get Current User's Office ID ───────────────────────────

CREATE OR REPLACE FUNCTION get_current_user_office_id()
RETURNS UUID AS $$
  SELECT office_id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Users Policies ─────────────────────────────────────────────────

-- Users can see other users in their office
CREATE POLICY users_select ON users FOR SELECT
  USING (office_id = get_current_user_office_id() OR auth_id = auth.uid());

-- Only admins and principals can update other users
CREATE POLICY users_update ON users FOR UPDATE
  USING (auth_id = auth.uid() OR get_current_user_role() IN ('admin', 'principal'));

-- ─── Contacts Policies ──────────────────────────────────────────────

-- Agents see contacts in their office (via assigned agent's office)
CREATE POLICY contacts_select ON contacts FOR SELECT
  USING (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY contacts_insert ON contacts FOR INSERT
  WITH CHECK (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY contacts_update ON contacts FOR UPDATE
  USING (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- ─── Properties Policies ────────────────────────────────────────────

CREATE POLICY properties_select ON properties FOR SELECT
  USING (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY properties_insert ON properties FOR INSERT
  WITH CHECK (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY properties_update ON properties FOR UPDATE
  USING (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- ─── Transactions Policies ──────────────────────────────────────────

CREATE POLICY transactions_select ON transactions FOR SELECT
  USING (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY transactions_insert ON transactions FOR INSERT
  WITH CHECK (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY transactions_update ON transactions FOR UPDATE
  USING (
    assigned_agent_id IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- ─── Activities Policies ────────────────────────────────────────────

CREATE POLICY activities_select ON activities FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY activities_insert ON activities FOR INSERT
  WITH CHECK (
    created_by = get_current_user_id()
  );

-- ─── Tasks Policies ────────────────────────────────────────────────

CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (
    assigned_to IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY tasks_insert ON tasks FOR INSERT
  WITH CHECK (
    assigned_to IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY tasks_update ON tasks FOR UPDATE
  USING (
    assigned_to IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- ─── Notes Policies ────────────────────────────────────────────────

CREATE POLICY notes_select ON notes FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY notes_insert ON notes FOR INSERT
  WITH CHECK (created_by = get_current_user_id());

CREATE POLICY notes_update ON notes FOR UPDATE
  USING (created_by = get_current_user_id());

-- ─── Workflows Policies ────────────────────────────────────────────

CREATE POLICY workflows_select ON workflows FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY workflows_insert ON workflows FOR INSERT
  WITH CHECK (created_by = get_current_user_id());

CREATE POLICY workflows_update ON workflows FOR UPDATE
  USING (created_by = get_current_user_id() OR get_current_user_role() IN ('admin', 'principal'));

-- ─── Stage Transitions Policies ─────────────────────────────────────

CREATE POLICY stage_transitions_select ON stage_transitions FOR SELECT
  USING (
    triggered_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY stage_transitions_insert ON stage_transitions FOR INSERT
  WITH CHECK (triggered_by = get_current_user_id());

-- ─── Offices Policies ──────────────────────────────────────────────

CREATE POLICY offices_select ON offices FOR SELECT
  USING (id = get_current_user_office_id());

-- ─── Teams Policies ────────────────────────────────────────────────

CREATE POLICY teams_select ON teams FOR SELECT
  USING (office_id = get_current_user_office_id());

-- ─── Workflow Runs Policies ─────────────────────────────────────────

CREATE POLICY workflow_runs_select ON workflow_runs FOR SELECT
  USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── Portal Listings Policies ───────────────────────────────────────

CREATE POLICY portal_listings_select ON portal_listings FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── Social Posts Policies ──────────────────────────────────────────

CREATE POLICY social_posts_select ON social_posts FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY social_posts_insert ON social_posts FOR INSERT
  WITH CHECK (created_by = get_current_user_id());

-- ─── Social Messages Policies ───────────────────────────────────────

CREATE POLICY social_messages_select ON social_messages FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── Template Policies ──────────────────────────────────────────────

CREATE POLICY email_templates_select ON email_templates FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY sms_templates_select ON sms_templates FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- ─── Property Interested Buyers Policies ────────────────────────────

CREATE POLICY property_interested_buyers_select ON property_interested_buyers FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY property_interested_buyers_insert ON property_interested_buyers FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY property_interested_buyers_delete ON property_interested_buyers FOR DELETE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );
