-- Sprint 3: Automation & Intelligence
-- Creates tables for: push_device_tokens, notification_preferences, notifications,
-- daily_action_items, follow_up_sequences, sequence_enrollments

-- ─── ENUMs ────────────────────────────────────────────────────────────────────

CREATE TYPE notification_priority AS ENUM ('critical', 'high', 'medium', 'low');

CREATE TYPE notification_category AS ENUM (
  'new_lead',
  'property_match',
  'key_date',
  'pipeline_update',
  'follow_up_due',
  'daily_action_list',
  'system',
  'digest'
);

CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'read', 'dismissed', 'snoozed');

CREATE TYPE action_item_category AS ENUM (
  'call',
  'follow_up',
  'key_date',
  'inspection',
  'offer_review',
  'document',
  'pre_approval',
  'settlement',
  'general'
);

CREATE TYPE enrollment_status AS ENUM ('active', 'paused', 'completed', 'cancelled');

-- ─── push_device_tokens ───────────────────────────────────────────────────────
-- Stores Expo push tokens per user-device pair.

CREATE TABLE push_device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX idx_push_tokens_user_id ON push_device_tokens (user_id);
CREATE INDEX idx_push_tokens_active  ON push_device_tokens (is_active) WHERE is_active = true;

-- ─── notification_preferences ────────────────────────────────────────────────
-- Per-user notification settings: quiet hours, digest mode, category toggles.

CREATE TABLE notification_preferences (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  quiet_hours_start            TIME NOT NULL DEFAULT '21:00',
  quiet_hours_end              TIME NOT NULL DEFAULT '07:00',
  digest_mode_enabled          BOOLEAN NOT NULL DEFAULT true,
  digest_send_time             TIME NOT NULL DEFAULT '07:00',
  notify_new_lead              BOOLEAN NOT NULL DEFAULT true,
  notify_property_match        BOOLEAN NOT NULL DEFAULT true,
  notify_key_date_reminder     BOOLEAN NOT NULL DEFAULT true,
  notify_pipeline_update       BOOLEAN NOT NULL DEFAULT true,
  notify_follow_up_due         BOOLEAN NOT NULL DEFAULT true,
  notify_low_priority          BOOLEAN NOT NULL DEFAULT false,
  daily_action_list_enabled    BOOLEAN NOT NULL DEFAULT true,
  daily_action_list_time       TIME NOT NULL DEFAULT '07:00',
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── notifications ────────────────────────────────────────────────────────────
-- All generated notifications (push, in-app, digest items).

CREATE TABLE notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  priority         notification_priority NOT NULL DEFAULT 'medium',
  category         notification_category NOT NULL,
  status           notification_status NOT NULL DEFAULT 'pending',
  entity_type      TEXT,
  entity_id        UUID,
  action_primary   TEXT,
  action_secondary TEXT,
  action_tertiary  TEXT,
  dedup_key        TEXT UNIQUE,
  scheduled_for    TIMESTAMPTZ,
  snoozed_until    TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  dismissed_at     TIMESTAMPTZ,
  is_digest_item   BOOLEAN NOT NULL DEFAULT false,
  digest_sent_at   TIMESTAMPTZ,
  metadata         JSONB,
  is_deleted       BOOLEAN NOT NULL DEFAULT false,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id      ON notifications (user_id);
CREATE INDEX idx_notifications_status       ON notifications (status);
CREATE INDEX idx_notifications_category     ON notifications (category);
CREATE INDEX idx_notifications_scheduled    ON notifications (scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_notifications_dedup        ON notifications (dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX idx_notifications_unread       ON notifications (user_id, status) WHERE status = 'sent' AND is_deleted = false;

-- ─── daily_action_items ───────────────────────────────────────────────────────
-- AI-generated prioritized action list per agent per day.

CREATE TABLE daily_action_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  rank                INTEGER NOT NULL,
  category            action_item_category NOT NULL,
  title               TEXT NOT NULL,
  subtitle            TEXT NOT NULL,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  transaction_id      UUID REFERENCES transactions(id) ON DELETE SET NULL,
  task_id             UUID REFERENCES tasks(id) ON DELETE SET NULL,
  urgency_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
  recency_penalty     NUMERIC(5,2) NOT NULL DEFAULT 0,
  deadline_proximity  NUMERIC(5,2) NOT NULL DEFAULT 0,
  lead_score          NUMERIC(5,2) NOT NULL DEFAULT 0,
  composite_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_completed        BOOLEAN NOT NULL DEFAULT false,
  completed_at        TIMESTAMPTZ,
  ai_model            TEXT,
  ai_cost_aud         NUMERIC(10,6),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_daily_actions_user_date_rank ON daily_action_items (user_id, date, rank);
CREATE INDEX idx_daily_actions_user_date            ON daily_action_items (user_id, date);
CREATE INDEX idx_daily_actions_incomplete           ON daily_action_items (user_id, date, is_completed) WHERE is_completed = false;

-- ─── follow_up_sequences ─────────────────────────────────────────────────────
-- Sequence template definitions (5 pre-built + user-created).

CREATE TABLE follow_up_sequences (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL,
  trigger_type   TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  steps          JSONB NOT NULL,
  is_template    BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  is_deleted     BOOLEAN NOT NULL DEFAULT false,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sequences_created_by ON follow_up_sequences (created_by);
CREATE INDEX idx_sequences_template   ON follow_up_sequences (is_template) WHERE is_template = true;
CREATE INDEX idx_sequences_active     ON follow_up_sequences (is_active) WHERE is_active = true AND is_deleted = false;

-- ─── sequence_enrollments ────────────────────────────────────────────────────
-- Tracks which contacts are enrolled in a sequence and what step they are at.

CREATE TABLE sequence_enrollments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id          UUID NOT NULL REFERENCES follow_up_sequences(id) ON DELETE RESTRICT,
  contact_id           UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  transaction_id       UUID REFERENCES transactions(id) ON DELETE SET NULL,
  enrolled_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  current_step_index   INTEGER NOT NULL DEFAULT 0,
  status               enrollment_status NOT NULL DEFAULT 'active',
  preferred_send_hour  INTEGER CHECK (preferred_send_hour >= 0 AND preferred_send_hour <= 23),
  last_step_sent_at    TIMESTAMPTZ,
  next_step_due_at     TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  ai_content_overrides JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sequence_id, contact_id)
);

CREATE INDEX idx_enrollments_sequence_id  ON sequence_enrollments (sequence_id);
CREATE INDEX idx_enrollments_contact_id   ON sequence_enrollments (contact_id);
CREATE INDEX idx_enrollments_status       ON sequence_enrollments (status);
CREATE INDEX idx_enrollments_next_step    ON sequence_enrollments (next_step_due_at)
  WHERE status = 'active';
