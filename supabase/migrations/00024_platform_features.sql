-- =====================================================================
-- Migration 00024: Platform Features
-- Adds: subscriptions, payment history, reports, saved views,
--        calendar events, import jobs, onboarding
-- =====================================================================

-- ─── Subscriptions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('starter', 'professional', 'team', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete')),
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  trial_ends_at TIMESTAMPTZ,
  seat_count INTEGER NOT NULL DEFAULT 1 CHECK (seat_count > 0),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_office_id ON subscriptions(office_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ─── Payment History ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount_aud NUMERIC(10, 2) NOT NULL CHECK (amount_aud >= 0),
  gst_amount_aud NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (gst_amount_aud >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('succeeded', 'failed', 'pending', 'refunded')),
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_invoice_id TEXT,
  description TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_history_office_id ON payment_history(office_id);
CREATE INDEX idx_payment_history_subscription_id ON payment_history(subscription_id);
CREATE INDEX idx_payment_history_status ON payment_history(status);

-- ─── Report Definitions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('pipeline_value', 'agent_performance', 'revenue', 'lead_conversion', 'property_market', 'client_activity', 'team_overview', 'custom')),
  chart_type TEXT NOT NULL DEFAULT 'table' CHECK (chart_type IN ('bar', 'line', 'pie', 'donut', 'table', 'number', 'funnel')),
  filters JSONB NOT NULL DEFAULT '[]',
  date_range JSONB NOT NULL DEFAULT '{"preset": "last_30_days"}',
  group_by TEXT,
  order_by TEXT,
  order_direction TEXT NOT NULL DEFAULT 'desc' CHECK (order_direction IN ('asc', 'desc')),
  is_template BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_definitions_office_id ON report_definitions(office_id);
CREATE INDEX idx_report_definitions_type ON report_definitions(type);

-- ─── Report Schedules ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  recipient_emails JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Dashboard Widgets ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  report_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_widgets_user_id ON dashboard_widgets(user_id);

-- ─── Saved Views ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contacts', 'properties', 'pipeline', 'tasks', 'inspections')),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '[]',
  sorts JSONB NOT NULL DEFAULT '[]',
  columns JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_views_user_id ON saved_views(user_id);
CREATE INDEX idx_saved_views_entity_type ON saved_views(entity_type);

-- ─── Calendar Connections ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  calendar_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  account_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, calendar_id)
);

CREATE INDEX idx_calendar_connections_user_id ON calendar_connections(user_id);

-- ─── Calendar Events ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES calendar_connections(id) ON DELETE SET NULL,
  external_event_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'other' CHECK (event_type IN ('inspection', 'open_home', 'client_meeting', 'auction', 'settlement', 'phone_call', 'other')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  reminder_minutes INTEGER NOT NULL DEFAULT 15,
  sync_status TEXT NOT NULL DEFAULT 'local_only' CHECK (sync_status IN ('synced', 'pending', 'failed', 'local_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_contact_id ON calendar_events(contact_id);
CREATE INDEX idx_calendar_events_property_id ON calendar_events(property_id);

-- ─── Import Jobs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  source TEXT NOT NULL CHECK (source IN ('csv', 'hubspot', 'rex', 'agentbox', 'mydesktop', 'spreadsheet')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contacts', 'properties')),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'mapping', 'previewing', 'processing', 'completed', 'failed', 'cancelled')),
  field_mappings JSONB NOT NULL DEFAULT '[]',
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  skip_duplicates BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_jobs_office_id ON import_jobs(office_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);

-- ─── Import Errors ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  field TEXT,
  message TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_errors_job_id ON import_errors(import_job_id);

-- ─── Onboarding Progress ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE UNIQUE,
  current_step TEXT NOT NULL DEFAULT 'office_setup' CHECK (current_step IN ('office_setup', 'invite_team', 'connect_portals', 'import_data', 'configure_pipelines', 'setup_workflows', 'complete')),
  completed_steps JSONB NOT NULL DEFAULT '[]',
  skipped_steps JSONB NOT NULL DEFAULT '[]',
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
