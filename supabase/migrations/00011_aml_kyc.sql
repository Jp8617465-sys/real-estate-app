-- Sprint 4 / Team C: AML/KYC compliance tables
-- Meets AUSTRAC obligations for buyers agents under the AML/CTF Act 2006

-- ─── Document Type Enum + Point Values ───────────────────────────────────────

CREATE TYPE aml_document_type AS ENUM (
  -- Primary ID (70 points each)
  'passport',
  'birth_certificate',
  'citizenship_certificate',
  -- Secondary ID — Category A (40 points each)
  'drivers_licence',
  'government_id_card',
  'proof_of_age_card',
  -- Secondary ID — Category B (25 points each)
  'medicare_card',
  'credit_card',
  'bank_card',
  -- Supporting documents (25 points each)
  'utility_bill',
  'bank_statement',
  'council_rates',
  'lease_agreement',
  'centrelink_letter'
);

CREATE TABLE aml_document_point_values (
  document_type   aml_document_type PRIMARY KEY,
  points          INTEGER NOT NULL CHECK (points IN (25, 40, 70)),
  category        TEXT    NOT NULL
    CHECK (category IN ('primary', 'secondary_a', 'secondary_b', 'supporting'))
);

INSERT INTO aml_document_point_values (document_type, points, category) VALUES
  ('passport',                70, 'primary'),
  ('birth_certificate',       70, 'primary'),
  ('citizenship_certificate', 70, 'primary'),
  ('drivers_licence',         40, 'secondary_a'),
  ('government_id_card',      40, 'secondary_a'),
  ('proof_of_age_card',       40, 'secondary_a'),
  ('medicare_card',           25, 'secondary_b'),
  ('credit_card',             25, 'secondary_b'),
  ('bank_card',               25, 'secondary_b'),
  ('utility_bill',            25, 'supporting'),
  ('bank_statement',          25, 'supporting'),
  ('council_rates',           25, 'supporting'),
  ('lease_agreement',         25, 'supporting'),
  ('centrelink_letter',       25, 'supporting');

-- ─── AML Checks ───────────────────────────────────────────────────────────────

CREATE TABLE aml_checks (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID    NOT NULL REFERENCES contacts(id)  ON DELETE CASCADE,
  agent_id              UUID    NOT NULL REFERENCES users(id),
  status                TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'expired', 'waived')),

  verification_method   TEXT
    CHECK (verification_method IN ('face_to_face', 'certified_copies', 'electronic', 'third_party')),

  -- 100-point check progress
  total_points          INTEGER NOT NULL DEFAULT 0
    CHECK (total_points >= 0 AND total_points <= 300),
  points_required       INTEGER NOT NULL DEFAULT 100,

  -- Identity captured
  full_legal_name       TEXT,
  date_of_birth         DATE,
  residential_address   TEXT,
  address_verified      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Dates
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  expiry_date           DATE,        -- typically 2 years after completion
  last_reviewed_at      TIMESTAMPTZ,

  -- Outcome
  verified_by_user_id   UUID REFERENCES users(id),
  rejection_reason      TEXT,
  notes                 TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aml_checks_contact ON aml_checks (contact_id);
CREATE INDEX idx_aml_checks_agent   ON aml_checks (agent_id, status);
CREATE INDEX idx_aml_checks_expiry  ON aml_checks (expiry_date)
  WHERE status = 'passed';
CREATE INDEX idx_aml_checks_status  ON aml_checks (status);

-- ─── Identity Documents ───────────────────────────────────────────────────────

CREATE TABLE aml_identity_documents (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id            UUID              NOT NULL REFERENCES aml_checks(id) ON DELETE CASCADE,
  document_id         UUID              REFERENCES documents(id) ON DELETE SET NULL,
  document_type       aml_document_type NOT NULL,
  points              INTEGER           NOT NULL CHECK (points > 0),

  -- Document details captured by agent
  document_number     TEXT,
  issuing_authority   TEXT,
  issue_date          DATE,
  expiry_date         DATE,

  -- Whether document has expired (computed at query time via view or application layer)
  is_expired          BOOLEAN NOT NULL DEFAULT FALSE,

  -- Verification
  verified            BOOLEAN     NOT NULL DEFAULT FALSE,
  verified_by         UUID        REFERENCES users(id),
  verified_at         TIMESTAMPTZ,
  notes               TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aml_identity_docs_check ON aml_identity_documents (check_id);

-- ─── Suspicious Matter Reports ────────────────────────────────────────────────

CREATE TABLE aml_suspicious_matter_reports (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID    NOT NULL REFERENCES users(id),
  contact_id        UUID    REFERENCES contacts(id)     ON DELETE SET NULL,
  transaction_id    UUID    REFERENCES transactions(id) ON DELETE SET NULL,
  description       TEXT    NOT NULL,
  suspicion_basis   TEXT    NOT NULL,
  amount_aud        NUMERIC(12, 2),
  report_date       DATE    NOT NULL DEFAULT CURRENT_DATE,
  austrac_ref       TEXT,   -- filled after submission to AUSTRAC portal
  status            TEXT    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aml_smr_agent  ON aml_suspicious_matter_reports (agent_id, report_date DESC);
CREATE INDEX idx_aml_smr_status ON aml_suspicious_matter_reports (status);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE aml_document_point_values         ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_checks                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_identity_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_suspicious_matter_reports     ENABLE ROW LEVEL SECURITY;

-- Point values table is read-only reference data for all authenticated users
CREATE POLICY "all_agents_read_point_values"
  ON aml_document_point_values
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "agents_own_aml_checks"
  ON aml_checks
  USING (agent_id = auth.uid());

CREATE POLICY "agents_access_identity_documents"
  ON aml_identity_documents
  USING (
    EXISTS (
      SELECT 1
      FROM   aml_checks ac
      WHERE  ac.id = aml_identity_documents.check_id
        AND  ac.agent_id = auth.uid()
    )
  );

CREATE POLICY "agents_own_smr"
  ON aml_suspicious_matter_reports
  USING (agent_id = auth.uid());
