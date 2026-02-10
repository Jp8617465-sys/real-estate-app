-- ============================================================================
-- Migration 00005: Portal Clients, Documents, OAuth Tokens, Integration Config
-- ============================================================================

-- ─── Portal Clients ─────────────────────────────────────────────────────────
-- Links Supabase Auth users (client-side) to their contact record in CRM

CREATE TABLE portal_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portal_clients_auth_id ON portal_clients(auth_id);
CREATE INDEX idx_portal_clients_contact_id ON portal_clients(contact_id);
CREATE INDEX idx_portal_clients_agent_id ON portal_clients(agent_id);

-- ─── Documents ──────────────────────────────────────────────────────────────
-- File metadata for uploads (actual files stored in Supabase Storage)

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_contact_id ON documents(contact_id);
CREATE INDEX idx_documents_transaction_id ON documents(transaction_id);
CREATE INDEX idx_documents_property_id ON documents(property_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_is_deleted ON documents(is_deleted);

-- ─── OAuth Tokens ───────────────────────────────────────────────────────────
-- Store OAuth credentials for integration clients (Gmail, Meta, etc.)

CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  account_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);

-- ─── Integration Connections ────────────────────────────────────────────────
-- Track which integrations are active per user/office

CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_integration_connections_user ON integration_connections(user_id);
CREATE INDEX idx_integration_connections_provider ON integration_connections(provider);

-- ─── Workflow Runs Table ────────────────────────────────────────────────────
-- Track execution history for the workflow engine

CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',
  current_action_index INTEGER NOT NULL DEFAULT 0,
  resume_at TIMESTAMPTZ,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_resume_at ON workflow_runs(resume_at);

-- ─── Workflows Table ────────────────────────────────────────────────────────
-- Store workflow definitions (trigger, conditions, actions)

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_config JSONB NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_is_active ON workflows(is_active);
CREATE INDEX idx_workflows_is_deleted ON workflows(is_deleted);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);

-- ─── Social Posts Enhancements ──────────────────────────────────────────────
-- Add soft delete support and image URL to existing social_posts table

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE portal_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Portal clients: clients see only their own record
CREATE POLICY portal_clients_own_select ON portal_clients
  FOR SELECT USING (auth.uid() = auth_id);

-- Portal clients: agents can manage their clients
CREATE POLICY portal_clients_agent_all ON portal_clients
  FOR ALL USING (auth.uid() = agent_id);

-- Documents: users can see documents they uploaded or that belong to their contacts
CREATE POLICY documents_own ON documents
  FOR ALL USING (auth.uid() = uploaded_by);

CREATE POLICY documents_portal_read ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portal_clients pc
      WHERE pc.auth_id = auth.uid()
        AND pc.contact_id = documents.contact_id
    )
  );

-- OAuth tokens: users see only their own
CREATE POLICY oauth_tokens_own ON oauth_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Integration connections: users see only their own
CREATE POLICY integration_connections_own ON integration_connections
  FOR ALL USING (auth.uid() = user_id);

-- Workflows: users see only their own
CREATE POLICY workflows_own ON workflows
  FOR ALL USING (auth.uid() = created_by);

-- Workflow runs: viewable by workflow creator
CREATE POLICY workflow_runs_own ON workflow_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_runs.workflow_id
        AND w.created_by = auth.uid()
    )
  );
