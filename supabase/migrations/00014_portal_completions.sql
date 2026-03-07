-- Migration: 00014_portal_completions
-- Sprint 5 Team A — Client Portal completion

-- 1. Brief acknowledgement (sign-off)
ALTER TABLE client_briefs
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_ip INET;

-- 2. Document visibility control
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Client inspection feedback
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS client_rating   INTEGER CHECK (client_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS client_feedback TEXT,
  ADD COLUMN IF NOT EXISTS client_feedback_at TIMESTAMPTZ;

-- 4. Client match feedback
ALTER TABLE property_matches
  ADD COLUMN IF NOT EXISTS client_feedback      TEXT CHECK (client_feedback IN ('interested','not_interested','ask_agent')),
  ADD COLUMN IF NOT EXISTS client_feedback_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_feedback_note TEXT;

-- 5. RLS: portal client reads on client_briefs (via portal_clients.contact_id)
CREATE POLICY "portal_client_read_brief" ON client_briefs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = client_briefs.contact_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

CREATE POLICY "portal_client_acknowledge_brief" ON client_briefs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = client_briefs.contact_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- 6. RLS: portal client reads on property_matches (sent_to_client only)
CREATE POLICY "portal_client_read_sent_matches" ON property_matches
  FOR SELECT USING (
    status = 'sent_to_client'
    AND EXISTS (
      SELECT 1
      FROM client_briefs cb
      JOIN portal_clients pc ON pc.contact_id = cb.contact_id
      WHERE cb.id = property_matches.client_brief_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

CREATE POLICY "portal_client_feedback_match" ON property_matches
  FOR UPDATE USING (
    status = 'sent_to_client'
    AND EXISTS (
      SELECT 1
      FROM client_briefs cb
      JOIN portal_clients pc ON pc.contact_id = cb.contact_id
      WHERE cb.id = property_matches.client_brief_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- 7. RLS: portal client reads on inspections
CREATE POLICY "portal_client_read_inspections" ON inspections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = inspections.client_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

CREATE POLICY "portal_client_feedback_inspection" ON inspections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = inspections.client_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- 8. RLS: portal client reads on key_dates
CREATE POLICY "portal_client_read_key_dates" ON key_dates
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM transactions t
      JOIN contacts c ON c.id = t.contact_id
      JOIN portal_clients pc ON pc.contact_id = c.id
      WHERE t.id = key_dates.transaction_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );

-- 9. RLS: portal documents (portal_visible only)
DROP POLICY IF EXISTS "portal_clients_read_documents" ON documents;
CREATE POLICY "portal_client_read_documents" ON documents
  FOR SELECT USING (
    portal_visible = TRUE
    AND EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.contact_id = documents.contact_id
        AND pc.auth_id = auth.uid()
        AND pc.is_active = TRUE
    )
  );
