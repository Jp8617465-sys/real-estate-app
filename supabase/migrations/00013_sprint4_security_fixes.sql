-- Sprint 4 Security Fixes — post-review hardening
-- Addresses issues identified in architectural/security review before merge

-- ─── AML Identity Documents: soft-delete support ─────────────────────────────

-- AUSTRAC requires AML records be retained for 7 years after the customer
-- relationship ends. Hard-deleting documents violates this obligation.
-- Use soft-delete (deleted_at IS NOT NULL) instead of physical deletion.

ALTER TABLE aml_identity_documents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_aml_identity_docs_active
  ON aml_identity_documents (check_id)
  WHERE deleted_at IS NULL;

-- ─── AML Identity Documents: prevent duplicate document types ─────────────────

-- A single check cannot have the same document type twice. This prevents
-- agents from submitting duplicate documents to inflate point totals.
-- Only enforce on active (non-deleted) documents.

CREATE UNIQUE INDEX IF NOT EXISTS uq_aml_identity_docs_type_per_check
  ON aml_identity_documents (check_id, document_type)
  WHERE deleted_at IS NULL;

-- ─── AML RLS: remove DELETE permission from agent policies ───────────────────

-- Agents must not be able to physically delete AML checks or documents.
-- Soft-delete (deleted_at) is used instead to preserve the audit trail.

-- aml_checks: replace FOR ALL with explicit SELECT / INSERT / UPDATE only
DROP POLICY IF EXISTS "agents_own_aml_checks" ON aml_checks;

CREATE POLICY "agents_select_own_aml_checks"
  ON aml_checks
  FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "agents_insert_own_aml_checks"
  ON aml_checks
  FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agents_update_own_aml_checks"
  ON aml_checks
  FOR UPDATE
  USING (agent_id = auth.uid());

-- aml_identity_documents: replace FOR ALL with SELECT / INSERT / UPDATE only
DROP POLICY IF EXISTS "agents_access_identity_documents" ON aml_identity_documents;

CREATE POLICY "agents_select_identity_documents"
  ON aml_identity_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   aml_checks ac
      WHERE  ac.id = aml_identity_documents.check_id
        AND  ac.agent_id = auth.uid()
    )
  );

CREATE POLICY "agents_insert_identity_documents"
  ON aml_identity_documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   aml_checks ac
      WHERE  ac.id = aml_identity_documents.check_id
        AND  ac.agent_id = auth.uid()
    )
  );

CREATE POLICY "agents_update_identity_documents"
  ON aml_identity_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   aml_checks ac
      WHERE  ac.id = aml_identity_documents.check_id
        AND  ac.agent_id = auth.uid()
    )
  );

-- aml_suspicious_matter_reports: replace FOR ALL with SELECT / INSERT / UPDATE only
DROP POLICY IF EXISTS "agents_own_smr" ON aml_suspicious_matter_reports;

CREATE POLICY "agents_select_own_smr"
  ON aml_suspicious_matter_reports
  FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "agents_insert_own_smr"
  ON aml_suspicious_matter_reports
  FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agents_update_own_smr"
  ON aml_suspicious_matter_reports
  FOR UPDATE
  USING (agent_id = auth.uid());

-- ─── Analytics RLS: scope service_role write policies correctly ───────────────

-- The FOR ALL policies without TO clause apply to ALL authenticated users,
-- letting any agent write to any other agent's snapshot. Scope them to service_role.

DROP POLICY IF EXISTS "service_role_write_snapshots" ON analytics_daily_snapshots;
CREATE POLICY "service_role_write_snapshots"
  ON analytics_daily_snapshots
  FOR ALL
  TO service_role
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "service_role_write_market_data" ON market_data_snapshots;
CREATE POLICY "service_role_write_market_data"
  ON market_data_snapshots
  FOR ALL
  TO service_role
  WITH CHECK (TRUE);
