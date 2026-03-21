-- Migration: 00025_subscriptions.sql
-- Purpose: Add subscription/billing tables for Stripe integration
-- Dependencies: 00024 (product_type enum), 00001 (offices, users tables)

-- Subscription tier enum
CREATE TYPE subscription_tier AS ENUM ('free', 'professional', 'enterprise');

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'inactive');

-- Subscriptions table (one per office)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'inactive',
  product_scope product_type NOT NULL DEFAULT 'both',
  seat_count INTEGER NOT NULL DEFAULT 1,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_office_id_unique UNIQUE (office_id)
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT: users can view their own office's subscription
CREATE POLICY "Users can view own office subscription"
  ON subscriptions FOR SELECT
  USING (
    office_id IN (
      SELECT office_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for users — managed server-side via service role

-- Index for Stripe webhook lookups
CREATE INDEX idx_subscriptions_stripe_sub_id
  ON subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();
