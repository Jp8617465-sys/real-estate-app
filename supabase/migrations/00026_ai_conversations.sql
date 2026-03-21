-- Migration: 00026_ai_conversations.sql
-- Purpose: AI assistant conversation and message storage
-- Dependencies: 00001 (users table), 00002 (get_current_user_id function)

-- ─── AI Conversations Table ──────────────────────────────────────────

CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_aud NUMERIC(10,4) NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI Messages Table ───────────────────────────────────────────────

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool_result')),
  content TEXT,
  tool_calls JSONB,
  tool_results JSONB,
  token_usage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);

-- ─── Updated_at Trigger ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversations_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: users can only access their own
CREATE POLICY ai_conversations_select ON ai_conversations FOR SELECT
  USING (user_id = get_current_user_id());

CREATE POLICY ai_conversations_insert ON ai_conversations FOR INSERT
  WITH CHECK (user_id = get_current_user_id());

CREATE POLICY ai_conversations_update ON ai_conversations FOR UPDATE
  USING (user_id = get_current_user_id());

CREATE POLICY ai_conversations_delete ON ai_conversations FOR DELETE
  USING (user_id = get_current_user_id());

-- Messages: users can access messages in their own conversations
CREATE POLICY ai_messages_select ON ai_messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM ai_conversations WHERE user_id = get_current_user_id()
  ));

CREATE POLICY ai_messages_insert ON ai_messages FOR INSERT
  WITH CHECK (conversation_id IN (
    SELECT id FROM ai_conversations WHERE user_id = get_current_user_id()
  ));
