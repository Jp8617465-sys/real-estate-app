-- RealFlow: Buyers Agent Tables
-- Migration 00003: Adds buyers-agent-specific enums, tables, indexes, triggers, and RLS policies.
--
-- New enum:       buyers_agent_stage (8 stages)
-- Enum additions: contact_type, lead_source, pipeline_type, task_type, activity_type
-- New tables:     client_briefs, property_matches, selling_agent_profiles, inspections,
--                 offers, offer_rounds, auction_events, due_diligence_checklists,
--                 due_diligence_items, key_dates, fee_structures, invoices, referral_fees

-- ─── New Enum: Buyers Agent Pipeline Stage ────────────────────────────

CREATE TYPE buyers_agent_stage AS ENUM (
  'enquiry', 'consult-qualify', 'engaged', 'strategy-brief',
  'active-search', 'offer-negotiate', 'under-contract', 'settled-nurture'
);

-- ─── Enum Additions ───────────────────────────────────────────────────

ALTER TYPE contact_type ADD VALUE 'selling-agent';

ALTER TYPE lead_source ADD VALUE 'google_ads';

ALTER TYPE pipeline_type ADD VALUE 'buyers-agent';

ALTER TYPE task_type ADD VALUE 'brief-review';
ALTER TYPE task_type ADD VALUE 'due-diligence-check';
ALTER TYPE task_type ADD VALUE 'pre-settlement-inspection';
ALTER TYPE task_type ADD VALUE 'client-portal-update';

ALTER TYPE activity_type ADD VALUE 'inspection-logged';
ALTER TYPE activity_type ADD VALUE 'property-matched';
ALTER TYPE activity_type ADD VALUE 'offer-round';
ALTER TYPE activity_type ADD VALUE 'dd-item-completed';
ALTER TYPE activity_type ADD VALUE 'brief-updated';

-- ─── Client Briefs ───────────────────────────────────────────────────

CREATE TABLE client_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

  -- Purchase context
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('owner_occupier', 'investor', 'development', 'smsf')),
  enquiry_type TEXT NOT NULL CHECK (enquiry_type IN ('home_buyer', 'investor', 'both', 'unsure')),

  -- Budget
  budget_min NUMERIC NOT NULL,
  budget_max NUMERIC NOT NULL,
  budget_absolute_max NUMERIC,
  stamp_duty_budgeted BOOLEAN NOT NULL DEFAULT false,

  -- Finance
  pre_approved BOOLEAN NOT NULL DEFAULT false,
  pre_approval_amount NUMERIC,
  pre_approval_expiry TIMESTAMPTZ,
  lender TEXT,
  broker_name TEXT,
  broker_phone TEXT,
  broker_email TEXT,
  deposit_available NUMERIC,
  first_home_buyer BOOLEAN NOT NULL DEFAULT false,

  -- Requirements
  property_types TEXT[] NOT NULL DEFAULT '{}',
  bedrooms_min INTEGER NOT NULL DEFAULT 0,
  bedrooms_ideal INTEGER,
  bathrooms_min INTEGER NOT NULL DEFAULT 0,
  bathrooms_ideal INTEGER,
  car_spaces_min INTEGER NOT NULL DEFAULT 0,
  car_spaces_ideal INTEGER,
  land_size_min NUMERIC,
  land_size_max NUMERIC,
  building_age_min INTEGER,
  building_age_max INTEGER,

  -- Location
  suburbs JSONB NOT NULL DEFAULT '[]',
  max_commute JSONB,
  school_zones TEXT[] DEFAULT '{}',

  -- Preferences
  must_haves TEXT[] NOT NULL DEFAULT '{}',
  nice_to_haves TEXT[] NOT NULL DEFAULT '{}',
  deal_breakers TEXT[] NOT NULL DEFAULT '{}',

  -- Investor criteria (nullable, only for investors)
  investor_criteria JSONB,

  -- Timeline
  urgency TEXT NOT NULL CHECK (urgency IN ('asap', '1_3_months', '3_6_months', '6_12_months', 'no_rush')) DEFAULT 'no_rush',
  must_settle_before TIMESTAMPTZ,
  ideal_settlement TEXT,

  -- Communication
  preferred_contact_method TEXT CHECK (preferred_contact_method IN ('phone', 'email', 'sms', 'whatsapp')),
  update_frequency TEXT CHECK (update_frequency IN ('daily', 'twice_weekly', 'weekly')),
  best_time_to_call TEXT,
  partner_name TEXT,
  partner_phone TEXT,
  partner_email TEXT,

  -- Solicitor
  solicitor_firm TEXT,
  solicitor_contact TEXT,
  solicitor_phone TEXT,
  solicitor_email TEXT,

  -- Metadata
  brief_version INTEGER NOT NULL DEFAULT 1,
  client_signed_off BOOLEAN NOT NULL DEFAULT false,
  signed_off_at TIMESTAMPTZ,

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Property Matches ─────────────────────────────────────────────────

CREATE TABLE property_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_brief_id UUID NOT NULL REFERENCES client_briefs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  score_breakdown JSONB NOT NULL DEFAULT '{}',

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'sent_to_client', 'client_interested', 'inspection_booked', 'rejected', 'under_review')),
  rejection_reason TEXT,
  agent_notes TEXT,

  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (property_id, client_brief_id)
);

-- ─── Selling Agent Profiles ──────────────────────────────────────────

CREATE TABLE selling_agent_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  agency TEXT,
  suburbs TEXT[] NOT NULL DEFAULT '{}',
  relationship_score INTEGER CHECK (relationship_score BETWEEN 1 AND 5),
  total_interactions INTEGER NOT NULL DEFAULT 0,
  last_contact_date TIMESTAMPTZ,
  properties_sent INTEGER NOT NULL DEFAULT 0,
  deals_closed_with INTEGER NOT NULL DEFAULT 0,
  average_response_time TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Inspections ──────────────────────────────────────────────────────

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  selling_agent_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  inspection_date TIMESTAMPTZ NOT NULL,
  time_spent_minutes INTEGER,
  overall_impression TEXT NOT NULL CHECK (overall_impression IN ('positive', 'negative', 'neutral')),
  condition_notes TEXT,
  area_feel_notes TEXT,
  client_suitability TEXT CHECK (client_suitability IN ('match', 'maybe', 'no')),
  photos JSONB NOT NULL DEFAULT '[]',
  voice_note_url TEXT,
  voice_note_transcript TEXT,
  agent_notes TEXT,

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Offers ───────────────────────────────────────────────────────────

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  sale_method TEXT NOT NULL CHECK (sale_method IN ('private_treaty', 'auction', 'eoi', 'tender')),
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'submitted', 'countered', 'accepted', 'rejected', 'withdrawn')),

  strategy_notes TEXT,
  client_max_price NUMERIC,
  recommended_offer NUMERIC,
  walk_away_price NUMERIC,

  conditions TEXT[] NOT NULL DEFAULT '{}',
  settlement_period INTEGER,
  deposit_amount NUMERIC,
  deposit_type TEXT CHECK (deposit_type IN ('cash', 'deposit_bond', 'bank_guarantee')),

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Offer Rounds ─────────────────────────────────────────────────────

CREATE TABLE offer_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

  amount NUMERIC NOT NULL,
  conditions TEXT[] NOT NULL DEFAULT '{}',
  response TEXT NOT NULL DEFAULT 'pending' CHECK (response IN ('pending', 'accepted', 'rejected', 'countered')),
  counter_amount NUMERIC,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auction Events ──────────────────────────────────────────────────

CREATE TABLE auction_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL UNIQUE REFERENCES offers(id) ON DELETE CASCADE,

  auction_date TIMESTAMPTZ NOT NULL,
  registration_number TEXT,
  bidding_strategy TEXT,
  result TEXT CHECK (result IN ('won', 'passed_in', 'outbid')),
  final_price NUMERIC,
  number_of_bidders INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Due Diligence Checklists ─────────────────────────────────────────

CREATE TABLE due_diligence_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  property_type TEXT NOT NULL,

  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked')),

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Due Diligence Items ──────────────────────────────────────────────

CREATE TABLE due_diligence_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES due_diligence_checklists(id) ON DELETE CASCADE,

  category TEXT NOT NULL CHECK (category IN ('legal', 'physical', 'financial', 'environmental', 'council', 'strata')),
  name TEXT NOT NULL,
  description TEXT,

  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'issue_found', 'not_applicable')),
  assigned_to TEXT NOT NULL CHECK (assigned_to IN ('buyers_agent', 'solicitor', 'broker', 'building_inspector', 'pest_inspector', 'client')),

  due_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  documents JSONB NOT NULL DEFAULT '[]',
  notes TEXT,

  is_blocking BOOLEAN NOT NULL DEFAULT false,
  is_critical BOOLEAN NOT NULL DEFAULT false,

  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Key Dates ────────────────────────────────────────────────────────

CREATE TABLE key_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

  label TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  reminder_days_before INTEGER[] NOT NULL DEFAULT '{7,3,1}',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due_soon', 'overdue', 'completed')),
  completed_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Fee Structures ──────────────────────────────────────────────────

CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

  retainer_fee NUMERIC NOT NULL DEFAULT 0,
  retainer_paid_date TIMESTAMPTZ,

  success_fee_type TEXT NOT NULL CHECK (success_fee_type IN ('flat', 'percentage', 'tiered')),
  success_fee_flat_amount NUMERIC,
  success_fee_percentage NUMERIC,
  success_fee_tiers JSONB,
  success_fee_due_date TIMESTAMPTZ,
  success_fee_paid BOOLEAN NOT NULL DEFAULT false,
  success_fee_amount NUMERIC,

  gst_included BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Invoices ─────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('retainer', 'success_fee', 'referral_fee')),
  amount NUMERIC NOT NULL,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  due_date TIMESTAMPTZ,
  paid_date TIMESTAMPTZ,
  stripe_invoice_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Referral Fees ────────────────────────────────────────────────────

CREATE TABLE referral_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  referrer_name TEXT NOT NULL,
  referrer_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('flat', 'percentage_of_success')),
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────

-- Client Briefs
CREATE INDEX idx_client_briefs_contact ON client_briefs (contact_id) WHERE NOT is_deleted;
CREATE INDEX idx_client_briefs_transaction ON client_briefs (transaction_id) WHERE transaction_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_client_briefs_created_by ON client_briefs (created_by) WHERE NOT is_deleted;

-- Property Matches
CREATE INDEX idx_property_matches_client_brief ON property_matches (client_brief_id);
CREATE INDEX idx_property_matches_property ON property_matches (property_id);
CREATE INDEX idx_property_matches_client ON property_matches (client_id);
CREATE INDEX idx_property_matches_status ON property_matches (status);
CREATE INDEX idx_property_matches_score ON property_matches (overall_score DESC);

-- Selling Agent Profiles
CREATE INDEX idx_selling_agent_profiles_suburbs ON selling_agent_profiles USING GIN (suburbs);

-- Inspections
CREATE INDEX idx_inspections_property ON inspections (property_id) WHERE NOT is_deleted;
CREATE INDEX idx_inspections_client ON inspections (client_id) WHERE client_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_inspections_date ON inspections (inspection_date DESC) WHERE NOT is_deleted;
CREATE INDEX idx_inspections_created_by ON inspections (created_by) WHERE NOT is_deleted;

-- Offers
CREATE INDEX idx_offers_transaction ON offers (transaction_id) WHERE NOT is_deleted;
CREATE INDEX idx_offers_property ON offers (property_id) WHERE NOT is_deleted;
CREATE INDEX idx_offers_client ON offers (client_id) WHERE NOT is_deleted;
CREATE INDEX idx_offers_status ON offers (status) WHERE NOT is_deleted;

-- Offer Rounds
CREATE INDEX idx_offer_rounds_offer ON offer_rounds (offer_id, created_at DESC);

-- Due Diligence Checklists
CREATE INDEX idx_dd_checklists_transaction ON due_diligence_checklists (transaction_id);

-- Due Diligence Items
CREATE INDEX idx_dd_items_checklist ON due_diligence_items (checklist_id);
CREATE INDEX idx_dd_items_status ON due_diligence_items (status);
CREATE INDEX idx_dd_items_blocking ON due_diligence_items (is_blocking) WHERE is_blocking = true;

-- Key Dates
CREATE INDEX idx_key_dates_transaction ON key_dates (transaction_id);
CREATE INDEX idx_key_dates_date ON key_dates (date);
CREATE INDEX idx_key_dates_status ON key_dates (status);

-- Fee Structures
CREATE INDEX idx_fee_structures_client ON fee_structures (client_id);
CREATE INDEX idx_fee_structures_transaction ON fee_structures (transaction_id) WHERE transaction_id IS NOT NULL;

-- Invoices
CREATE INDEX idx_invoices_fee_structure ON invoices (fee_structure_id);
CREATE INDEX idx_invoices_client ON invoices (client_id);
CREATE INDEX idx_invoices_status ON invoices (status);

-- Referral Fees
CREATE INDEX idx_referral_fees_fee_structure ON referral_fees (fee_structure_id);

-- ─── Updated At Triggers ──────────────────────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON client_briefs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON property_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON selling_agent_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON auction_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON due_diligence_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON due_diligence_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON key_dates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON fee_structures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON referral_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Enable Row Level Security ────────────────────────────────────────

ALTER TABLE client_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE selling_agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_fees ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: Client Briefs ──────────────────────────────────────
-- Access via created_by's office

CREATE POLICY client_briefs_select ON client_briefs FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY client_briefs_insert ON client_briefs FOR INSERT
  WITH CHECK (
    created_by = get_current_user_id()
  );

CREATE POLICY client_briefs_update ON client_briefs FOR UPDATE
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- ─── RLS Policies: Property Matches ──────────────────────────────────
-- Access via client_id's assigned agent's office

CREATE POLICY property_matches_select ON property_matches FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY property_matches_insert ON property_matches FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY property_matches_update ON property_matches FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── RLS Policies: Selling Agent Profiles ─────────────────────────────
-- Access via contact_id's assigned agent's office

CREATE POLICY selling_agent_profiles_select ON selling_agent_profiles FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY selling_agent_profiles_insert ON selling_agent_profiles FOR INSERT
  WITH CHECK (
    contact_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY selling_agent_profiles_update ON selling_agent_profiles FOR UPDATE
  USING (
    contact_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── RLS Policies: Inspections ────────────────────────────────────────
-- Access via created_by's office

CREATE POLICY inspections_select ON inspections FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

CREATE POLICY inspections_insert ON inspections FOR INSERT
  WITH CHECK (
    created_by = get_current_user_id()
  );

CREATE POLICY inspections_update ON inspections FOR UPDATE
  USING (
    created_by IN (
      SELECT id FROM users WHERE office_id = get_current_user_office_id()
    )
  );

-- ─── RLS Policies: Offers ────────────────────────────────────────────
-- Access via transaction_id's assigned agent's office

CREATE POLICY offers_select ON offers FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY offers_insert ON offers FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY offers_update ON offers FOR UPDATE
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── RLS Policies: Offer Rounds ──────────────────────────────────────
-- Access via parent offer's transaction's assigned agent's office

CREATE POLICY offer_rounds_select ON offer_rounds FOR SELECT
  USING (
    offer_id IN (
      SELECT id FROM offers WHERE transaction_id IN (
        SELECT id FROM transactions WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

CREATE POLICY offer_rounds_insert ON offer_rounds FOR INSERT
  WITH CHECK (
    offer_id IN (
      SELECT id FROM offers WHERE transaction_id IN (
        SELECT id FROM transactions WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

-- ─── RLS Policies: Auction Events ────────────────────────────────────
-- Access via parent offer's transaction's assigned agent's office

CREATE POLICY auction_events_select ON auction_events FOR SELECT
  USING (
    offer_id IN (
      SELECT id FROM offers WHERE transaction_id IN (
        SELECT id FROM transactions WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

CREATE POLICY auction_events_insert ON auction_events FOR INSERT
  WITH CHECK (
    offer_id IN (
      SELECT id FROM offers WHERE transaction_id IN (
        SELECT id FROM transactions WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

CREATE POLICY auction_events_update ON auction_events FOR UPDATE
  USING (
    offer_id IN (
      SELECT id FROM offers WHERE transaction_id IN (
        SELECT id FROM transactions WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

-- ─── RLS Policies: Due Diligence Checklists ──────────────────────────
-- Access via transaction_id's assigned agent's office

CREATE POLICY dd_checklists_select ON due_diligence_checklists FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY dd_checklists_insert ON due_diligence_checklists FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY dd_checklists_update ON due_diligence_checklists FOR UPDATE
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── RLS Policies: Due Diligence Items ───────────────────────────────
-- Access via parent checklist's transaction's assigned agent's office

CREATE POLICY dd_items_select ON due_diligence_items FOR SELECT
  USING (
    checklist_id IN (
      SELECT id FROM due_diligence_checklists WHERE transaction_id IN (
        SELECT id FROM transactions WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

CREATE POLICY dd_items_insert ON due_diligence_items FOR INSERT
  WITH CHECK (
    checklist_id IN (
      SELECT id FROM due_diligence_checklists WHERE transaction_id IN (
        SELECT id FROM transactions WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

CREATE POLICY dd_items_update ON due_diligence_items FOR UPDATE
  USING (
    checklist_id IN (
      SELECT id FROM due_diligence_checklists WHERE transaction_id IN (
        SELECT id FROM transactions WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

-- ─── RLS Policies: Key Dates ─────────────────────────────────────────
-- Access via transaction_id's assigned agent's office

CREATE POLICY key_dates_select ON key_dates FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY key_dates_insert ON key_dates FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY key_dates_update ON key_dates FOR UPDATE
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── RLS Policies: Fee Structures ────────────────────────────────────
-- Access via client_id's assigned agent's office

CREATE POLICY fee_structures_select ON fee_structures FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY fee_structures_insert ON fee_structures FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY fee_structures_update ON fee_structures FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── RLS Policies: Invoices ──────────────────────────────────────────
-- Access via client_id's assigned agent's office

CREATE POLICY invoices_select ON invoices FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY invoices_insert ON invoices FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

CREATE POLICY invoices_update ON invoices FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE assigned_agent_id IN (
        SELECT id FROM users WHERE office_id = get_current_user_office_id()
      )
    )
  );

-- ─── RLS Policies: Referral Fees ─────────────────────────────────────
-- Access via parent fee_structure's client's assigned agent's office

CREATE POLICY referral_fees_select ON referral_fees FOR SELECT
  USING (
    fee_structure_id IN (
      SELECT id FROM fee_structures WHERE client_id IN (
        SELECT id FROM contacts WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

CREATE POLICY referral_fees_insert ON referral_fees FOR INSERT
  WITH CHECK (
    fee_structure_id IN (
      SELECT id FROM fee_structures WHERE client_id IN (
        SELECT id FROM contacts WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );

CREATE POLICY referral_fees_update ON referral_fees FOR UPDATE
  USING (
    fee_structure_id IN (
      SELECT id FROM fee_structures WHERE client_id IN (
        SELECT id FROM contacts WHERE assigned_agent_id IN (
          SELECT id FROM users WHERE office_id = get_current_user_office_id()
        )
      )
    )
  );
