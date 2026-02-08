-- RealFlow Database Schema
-- Initial migration: core tables for CRM, properties, pipeline, and workflows

-- ─── Enable Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ─── Enums ──────────────────────────────────────────────────────────

CREATE TYPE contact_type AS ENUM (
  'buyer', 'seller', 'investor', 'landlord', 'tenant',
  'referral-source', 'past-client'
);

CREATE TYPE lead_source AS ENUM (
  'domain', 'rea', 'instagram', 'facebook', 'linkedin',
  'referral', 'walk-in', 'cold-call', 'website', 'open-home',
  'signboard', 'print', 'other'
);

CREATE TYPE communication_preference AS ENUM ('email', 'phone', 'sms', 'any');

CREATE TYPE property_type AS ENUM (
  'house', 'unit', 'townhouse', 'villa', 'land', 'rural',
  'apartment', 'duplex', 'studio', 'acreage', 'retirement', 'commercial'
);

CREATE TYPE listing_status AS ENUM (
  'pre-market', 'active', 'under-offer', 'sold', 'withdrawn', 'leased'
);

CREATE TYPE sale_type AS ENUM (
  'private-treaty', 'auction', 'expression-of-interest', 'tender'
);

CREATE TYPE pipeline_type AS ENUM ('buying', 'selling');

CREATE TYPE buyer_stage AS ENUM (
  'new-enquiry', 'qualified-lead', 'active-search',
  'property-shortlisted', 'due-diligence', 'offer-made',
  'under-contract', 'settled'
);

CREATE TYPE seller_stage AS ENUM (
  'appraisal-request', 'listing-preparation', 'on-market',
  'offers-negotiation', 'under-contract', 'settled'
);

CREATE TYPE offer_status AS ENUM (
  'pending', 'countered', 'accepted', 'rejected', 'withdrawn'
);

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'in-progress', 'completed', 'cancelled');

CREATE TYPE task_type AS ENUM (
  'call', 'email', 'sms', 'meeting', 'inspection', 'follow-up',
  'document-review', 'appraisal', 'listing-preparation', 'marketing',
  'open-home', 'auction-prep', 'settlement-task', 'general'
);

CREATE TYPE activity_type AS ENUM (
  'call', 'email-sent', 'email-received', 'sms-sent', 'sms-received',
  'meeting', 'inspection', 'open-home', 'property-sent', 'note-added',
  'stage-change', 'task-completed', 'document-uploaded', 'offer-submitted',
  'contract-exchanged', 'settlement-completed', 'social-dm-sent',
  'social-dm-received', 'system'
);

CREATE TYPE user_role AS ENUM ('agent', 'principal', 'admin', 'assistant');

CREATE TYPE workflow_run_status AS ENUM ('running', 'completed', 'failed', 'cancelled');

-- ─── Offices ────────────────────────────────────────────────────────

CREATE TABLE offices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Teams ──────────────────────────────────────────────────────────

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  lead_agent_id UUID, -- FK added after users table
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users (Agents, Principals, Admins) ─────────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE, -- Supabase Auth user ID
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'agent',
  avatar_url TEXT,
  office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK for teams.lead_agent_id
ALTER TABLE teams ADD CONSTRAINT fk_teams_lead_agent
  FOREIGN KEY (lead_agent_id) REFERENCES users(id) ON DELETE SET NULL;

-- ─── Contacts ───────────────────────────────────────────────────────

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  types contact_type[] NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  secondary_phone TEXT,

  -- Address (embedded)
  address_street_number TEXT,
  address_street_name TEXT,
  address_unit_number TEXT,
  address_suburb TEXT,
  address_state TEXT,
  address_postcode TEXT,

  -- Source tracking
  source lead_source NOT NULL,
  source_detail TEXT,
  assigned_agent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Buyer profile (JSONB for flexibility)
  buyer_profile JSONB,

  -- Seller profile (JSONB for flexibility)
  seller_profile JSONB,

  -- Engagement
  tags TEXT[] NOT NULL DEFAULT '{}',
  last_contact_date TIMESTAMPTZ,
  next_follow_up TIMESTAMPTZ,
  communication_preference communication_preference NOT NULL DEFAULT 'any',

  -- Social
  social_instagram TEXT,
  social_facebook TEXT,
  social_linkedin TEXT,

  -- Lead scoring
  lead_score INTEGER DEFAULT 0,

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Properties ─────────────────────────────────────────────────────

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Address
  address_street_number TEXT NOT NULL,
  address_street_name TEXT NOT NULL,
  address_unit_number TEXT,
  address_suburb TEXT NOT NULL,
  address_state TEXT NOT NULL,
  address_postcode TEXT NOT NULL,

  property_type property_type NOT NULL,
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  car_spaces INTEGER NOT NULL DEFAULT 0,
  land_size NUMERIC,
  building_size NUMERIC,
  year_built INTEGER,

  -- Listing
  listing_status listing_status NOT NULL DEFAULT 'pre-market',
  list_price NUMERIC,
  price_guide TEXT,
  sale_type sale_type NOT NULL,
  auction_date TIMESTAMPTZ,

  -- Portal integration
  domain_listing_id TEXT,
  rea_listing_id TEXT,

  -- Media (JSONB arrays)
  photos JSONB NOT NULL DEFAULT '[]',
  floor_plans TEXT[] NOT NULL DEFAULT '{}',
  virtual_tour_url TEXT,
  video_url TEXT,

  -- Relationships
  vendor_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_agent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Analytics
  portal_views INTEGER NOT NULL DEFAULT 0,
  enquiry_count INTEGER NOT NULL DEFAULT 0,
  inspection_count INTEGER NOT NULL DEFAULT 0,

  -- Comparable sales (JSONB)
  comparables JSONB NOT NULL DEFAULT '[]',

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Property Interested Buyers (junction table) ────────────────────

CREATE TABLE property_interested_buyers (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (property_id, contact_id)
);

-- ─── Transactions (Pipeline) ────────────────────────────────────────

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  pipeline_type pipeline_type NOT NULL,
  current_stage TEXT NOT NULL,
  assigned_agent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Offer details
  offer_amount NUMERIC,
  offer_conditions TEXT,
  offer_status offer_status,

  -- Contract details
  contract_price NUMERIC,
  exchange_date TIMESTAMPTZ,
  cooling_off_expiry TIMESTAMPTZ,
  finance_approval_date TIMESTAMPTZ,
  settlement_date TIMESTAMPTZ,
  deposit_amount NUMERIC,
  deposit_paid BOOLEAN,

  -- Commission (selling side)
  commission_rate NUMERIC,
  commission_amount NUMERIC,

  notes TEXT,

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Stage Transitions ──────────────────────────────────────────────

CREATE TABLE stage_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  triggered_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Activities ─────────────────────────────────────────────────────

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Notes ──────────────────────────────────────────────────────────

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tasks ──────────────────────────────────────────────────────────

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type task_type NOT NULL DEFAULT 'general',
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',

  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  due_date TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,

  workflow_id UUID, -- FK added after workflows table
  is_automated BOOLEAN NOT NULL DEFAULT false,

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workflows ──────────────────────────────────────────────────────

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger JSONB NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK for tasks.workflow_id
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_workflow
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL;

-- ─── Workflow Runs ──────────────────────────────────────────────────

CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  status workflow_run_status NOT NULL DEFAULT 'running',
  current_action_index INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ─── Portal Listings ────────────────────────────────────────────────

CREATE TABLE portal_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  portal TEXT NOT NULL, -- 'domain' or 'rea'
  external_listing_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, portal)
);

-- ─── Social Posts ───────────────────────────────────────────────────

CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  platform TEXT NOT NULL, -- 'instagram', 'facebook', 'linkedin'
  external_post_id TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Social Messages ────────────────────────────────────────────────

CREATE TABLE social_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  external_conversation_id TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Email Templates ────────────────────────────────────────────────

CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  merge_fields TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SMS Templates ──────────────────────────────────────────────────

CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  merge_fields TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────

-- Contacts: full-text search
CREATE INDEX idx_contacts_search ON contacts
  USING GIN (
    (first_name || ' ' || last_name || ' ' || COALESCE(email, '') || ' ' || phone) gin_trgm_ops
  );
CREATE INDEX idx_contacts_phone ON contacts (phone);
CREATE INDEX idx_contacts_email ON contacts (email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_assigned_agent ON contacts (assigned_agent_id) WHERE NOT is_deleted;
CREATE INDEX idx_contacts_next_follow_up ON contacts (next_follow_up) WHERE next_follow_up IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_contacts_source ON contacts (source);
CREATE INDEX idx_contacts_tags ON contacts USING GIN (tags);
CREATE INDEX idx_contacts_types ON contacts USING GIN (types);
CREATE INDEX idx_contacts_not_deleted ON contacts (id) WHERE NOT is_deleted;

-- Properties
CREATE INDEX idx_properties_suburb ON properties (address_suburb, address_state);
CREATE INDEX idx_properties_listing_status ON properties (listing_status) WHERE NOT is_deleted;
CREATE INDEX idx_properties_assigned_agent ON properties (assigned_agent_id) WHERE NOT is_deleted;
CREATE INDEX idx_properties_type ON properties (property_type);
CREATE INDEX idx_properties_domain_id ON properties (domain_listing_id) WHERE domain_listing_id IS NOT NULL;
CREATE INDEX idx_properties_rea_id ON properties (rea_listing_id) WHERE rea_listing_id IS NOT NULL;

-- Transactions
CREATE INDEX idx_transactions_contact ON transactions (contact_id) WHERE NOT is_deleted;
CREATE INDEX idx_transactions_property ON transactions (property_id) WHERE property_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_transactions_stage ON transactions (pipeline_type, current_stage) WHERE NOT is_deleted;
CREATE INDEX idx_transactions_agent ON transactions (assigned_agent_id) WHERE NOT is_deleted;
CREATE INDEX idx_transactions_settlement ON transactions (settlement_date) WHERE settlement_date IS NOT NULL AND NOT is_deleted;

-- Activities
CREATE INDEX idx_activities_contact ON activities (contact_id, created_at DESC);
CREATE INDEX idx_activities_transaction ON activities (transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_activities_type ON activities (type, created_at DESC);

-- Tasks
CREATE INDEX idx_tasks_assigned ON tasks (assigned_to, status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_tasks_due_date ON tasks (due_date) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_tasks_contact ON tasks (contact_id) WHERE contact_id IS NOT NULL;

-- Stage transitions
CREATE INDEX idx_stage_transitions_transaction ON stage_transitions (transaction_id, created_at DESC);

-- Notes
CREATE INDEX idx_notes_contact ON notes (contact_id, created_at DESC) WHERE NOT is_deleted;

-- Workflow runs
CREATE INDEX idx_workflow_runs_status ON workflow_runs (status) WHERE status = 'running';

-- ─── Updated At Trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON offices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON portal_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON social_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sms_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
