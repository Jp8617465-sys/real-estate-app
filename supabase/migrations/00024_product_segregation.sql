-- Migration: 00024_product_segregation.sql
-- Purpose: Add product dimension to data model for buyer's agent / selling agent split
-- Dependencies: 00001 (offices, users tables)

-- Product type enum
CREATE TYPE product_type AS ENUM ('buyers_agent', 'selling_agent', 'both');

-- Add product scope to offices
ALTER TABLE offices
  ADD COLUMN product_type product_type NOT NULL DEFAULT 'both';

-- Add user-level product access (inherits from office, overridable)
ALTER TABLE users
  ADD COLUMN product_access product_type;

-- Helper function: resolve effective product access
CREATE OR REPLACE FUNCTION effective_product_access(p_user_id UUID)
RETURNS product_type AS $$
  SELECT COALESCE(
    u.product_access,
    o.product_type,
    'both'::product_type
  )
  FROM users u
  LEFT JOIN offices o ON o.id = u.office_id
  WHERE u.id = p_user_id;
$$ LANGUAGE sql STABLE;

-- Feature flag table for granular control
CREATE TABLE product_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  product_type product_type NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE product_features ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read feature flags
CREATE POLICY "Authenticated users can read product features"
  ON product_features FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed feature flags
INSERT INTO product_features (feature_key, product_type, description) VALUES
  ('client_briefs', 'buyers_agent', 'Client brief management'),
  ('property_matching', 'buyers_agent', 'AI property matching against briefs'),
  ('off_market', 'buyers_agent', 'Off-market property network'),
  ('due_diligence', 'buyers_agent', 'Due diligence checklists by state'),
  ('selling_agents', 'buyers_agent', 'Selling agent relationship CRM'),
  ('ba_compliance', 'buyers_agent', 'Buyer agent compliance management'),
  ('listings', 'selling_agent', 'Property listing management'),
  ('domain_sync', 'selling_agent', 'Domain.com.au portal sync'),
  ('social_publishing', 'selling_agent', 'Social media post scheduling'),
  ('open_homes', 'selling_agent', 'Open home scheduling and tracking'),
  ('appraisals', 'selling_agent', 'Property appraisal management'),
  ('seller_marketing', 'selling_agent', 'Listing marketing campaigns');
