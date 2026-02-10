-- ============================================================================
-- Migration 00004: Unified Inbox — Conversation Messages & Integration Support
-- ============================================================================

-- ─── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE message_channel AS ENUM (
  'email',
  'sms',
  'phone_call',
  'whatsapp',
  'instagram_dm',
  'facebook_messenger',
  'domain_enquiry',
  'rea_enquiry',
  'linkedin',
  'internal_note',
  'portal_notification'
);

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

CREATE TYPE message_status AS ENUM ('pending', 'delivered', 'read', 'failed');

CREATE TYPE call_outcome AS ENUM ('answered', 'missed', 'voicemail', 'no_answer');

CREATE TYPE portal_source AS ENUM ('domain', 'realestate.com.au');

CREATE TYPE integration_provider AS ENUM (
  'gmail',
  'outlook',
  'twilio',
  'instagram',
  'facebook',
  'whatsapp',
  'google_calendar',
  'outlook_calendar'
);

CREATE TYPE oauth_provider AS ENUM ('google', 'microsoft', 'meta', 'whatsapp');

-- ─── Contact Channels ──────────────────────────────────────────────────────
-- Maps a contact to all their identifiers across channels.
-- This enables the contact matching engine to link incoming messages.

CREATE TABLE contact_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  emails TEXT[] NOT NULL DEFAULT '{}',
  phones TEXT[] NOT NULL DEFAULT '{}',
  instagram_id TEXT,
  facebook_id TEXT,
  whatsapp_number TEXT,
  linkedin_profile_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_contact_channels UNIQUE (contact_id)
);

CREATE INDEX idx_contact_channels_emails ON contact_channels USING GIN (emails);
CREATE INDEX idx_contact_channels_phones ON contact_channels USING GIN (phones);
CREATE INDEX idx_contact_channels_instagram ON contact_channels (instagram_id) WHERE instagram_id IS NOT NULL;
CREATE INDEX idx_contact_channels_facebook ON contact_channels (facebook_id) WHERE facebook_id IS NOT NULL;
CREATE INDEX idx_contact_channels_whatsapp ON contact_channels (whatsapp_number) WHERE whatsapp_number IS NOT NULL;

-- ─── Conversation Messages ─────────────────────────────────────────────────
-- Every message from every channel is stored here.
-- This is the core table for the unified inbox.

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Channel identification
  channel message_channel NOT NULL,
  direction message_direction NOT NULL,

  -- Contact linking
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES users(id),

  -- Content
  content JSONB NOT NULL DEFAULT '{}',
  -- Expected structure:
  -- { text?: string, html?: string, subject?: string, attachments?: Attachment[] }

  -- Channel-specific metadata
  metadata JSONB NOT NULL DEFAULT '{}',
  -- Expected structure varies by channel (email headers, Twilio SID, social IDs, etc.)

  -- Context
  property_id UUID REFERENCES properties(id),
  transaction_id UUID REFERENCES transactions(id),
  thread_id UUID,  -- Groups messages in the same conversation thread

  -- Status
  status message_status NOT NULL DEFAULT 'pending',
  is_read BOOLEAN NOT NULL DEFAULT false,

  -- External ID for deduplication
  external_message_id TEXT,

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query: unread messages for an agent, ordered by recency
CREATE INDEX idx_conv_messages_agent_unread ON conversation_messages (agent_id, is_read, created_at DESC)
  WHERE is_deleted = false;

-- Contact conversation thread: all messages for a contact
CREATE INDEX idx_conv_messages_contact ON conversation_messages (contact_id, created_at DESC)
  WHERE is_deleted = false;

-- Channel filter
CREATE INDEX idx_conv_messages_channel ON conversation_messages (channel, created_at DESC)
  WHERE is_deleted = false;

-- Thread grouping
CREATE INDEX idx_conv_messages_thread ON conversation_messages (thread_id, created_at ASC)
  WHERE thread_id IS NOT NULL AND is_deleted = false;

-- External message deduplication
CREATE UNIQUE INDEX idx_conv_messages_external_id ON conversation_messages (external_message_id)
  WHERE external_message_id IS NOT NULL;

-- Property-linked messages
CREATE INDEX idx_conv_messages_property ON conversation_messages (property_id, created_at DESC)
  WHERE property_id IS NOT NULL AND is_deleted = false;

-- ─── OAuth Tokens ──────────────────────────────────────────────────────────
-- Encrypted storage for OAuth access/refresh tokens per user per provider.

CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider oauth_provider NOT NULL,

  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  account_email TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

-- ─── Integration Connections ───────────────────────────────────────────────
-- Tracks which integrations an agent/office has enabled and their config.

CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id),
  provider integration_provider NOT NULL,

  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  -- Provider-specific config (e.g., Twilio phone number, Instagram page ID)

  last_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_provider_connection UNIQUE (user_id, provider)
);

CREATE INDEX idx_integration_connections_office ON integration_connections (office_id, provider)
  WHERE is_active = true;

-- ─── Inbound Message Queue ─────────────────────────────────────────────────
-- Temporary queue for incoming webhook payloads before processing.
-- Ensures reliability: webhook returns 200 immediately, processing happens async.

CREATE TABLE inbound_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel message_channel NOT NULL,
  raw_payload JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  processed_message_id UUID REFERENCES conversation_messages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_inbound_queue_pending ON inbound_message_queue (created_at ASC)
  WHERE processing_status = 'pending';

-- ─── Updated At Triggers ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_contact_channels_updated_at
  BEFORE UPDATE ON contact_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_conversation_messages_updated_at
  BEFORE UPDATE ON conversation_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Row Level Security ────────────────────────────────────────────────────

ALTER TABLE contact_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_message_queue ENABLE ROW LEVEL SECURITY;

-- Contact channels: visible to users in the same office as the contact's assigned agent
CREATE POLICY contact_channels_office_policy ON contact_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contacts c
      JOIN users u ON u.id = c.assigned_agent_id
      WHERE c.id = contact_channels.contact_id
        AND u.office_id = get_current_user_office_id()
    )
  );

-- Conversation messages: visible to users in the same office
CREATE POLICY conversation_messages_office_policy ON conversation_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = conversation_messages.agent_id
        AND u.office_id = get_current_user_office_id()
    )
  );

-- OAuth tokens: only visible to the owning user
CREATE POLICY oauth_tokens_user_policy ON oauth_tokens
  FOR ALL USING (user_id = get_current_user_id());

-- Integration connections: visible to users in the same office
CREATE POLICY integration_connections_office_policy ON integration_connections
  FOR ALL USING (office_id = get_current_user_office_id());

-- Inbound message queue: service role only (no user policy — handled by service key)
CREATE POLICY inbound_queue_service_policy ON inbound_message_queue
  FOR ALL USING (false);
-- Service role key bypasses RLS, so this table is effectively service-only.

-- ─── Helper Views ──────────────────────────────────────────────────────────

-- View: inbox threads grouped by contact with last message and unread count
CREATE OR REPLACE VIEW inbox_thread_summaries AS
SELECT
  cm.contact_id,
  c.first_name AS contact_first_name,
  c.last_name AS contact_last_name,
  cm.id AS last_message_id,
  cm.channel AS last_message_channel,
  cm.direction AS last_message_direction,
  cm.content AS last_message_content,
  cm.status AS last_message_status,
  cm.is_read AS last_message_is_read,
  cm.created_at AS last_message_at,
  cm.agent_id,
  unread.unread_count,
  channels_used.channels
FROM conversation_messages cm
JOIN contacts c ON c.id = cm.contact_id
JOIN LATERAL (
  SELECT COUNT(*)::int AS unread_count
  FROM conversation_messages um
  WHERE um.contact_id = cm.contact_id
    AND um.direction = 'inbound'
    AND um.is_read = false
    AND um.is_deleted = false
) unread ON true
JOIN LATERAL (
  SELECT ARRAY_AGG(DISTINCT ch.channel) AS channels
  FROM conversation_messages ch
  WHERE ch.contact_id = cm.contact_id
    AND ch.is_deleted = false
) channels_used ON true
WHERE cm.is_deleted = false
  AND cm.created_at = (
    SELECT MAX(latest.created_at)
    FROM conversation_messages latest
    WHERE latest.contact_id = cm.contact_id
      AND latest.is_deleted = false
  )
ORDER BY cm.created_at DESC;

-- ─── Populate contact_channels for existing contacts ───────────────────────
-- Seed the contact_channels table from existing contact data.

INSERT INTO contact_channels (contact_id, emails, phones)
SELECT
  id,
  CASE WHEN email IS NOT NULL THEN ARRAY[email] ELSE '{}' END,
  ARRAY_REMOVE(
    ARRAY[
      CASE WHEN phone IS NOT NULL AND phone != '' THEN phone END,
      CASE WHEN secondary_phone IS NOT NULL AND secondary_phone != '' THEN secondary_phone END
    ],
    NULL
  )
FROM contacts
WHERE is_deleted = false
ON CONFLICT (contact_id) DO NOTHING;
