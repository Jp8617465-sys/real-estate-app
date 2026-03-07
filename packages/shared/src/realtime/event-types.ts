/**
 * Typed event definitions for Supabase Realtime database change events.
 *
 * These types ensure type-safe handling of INSERT, UPDATE, and DELETE
 * payloads across all real-time subscriptions.
 */

// ─── Database Change Event Types ────────────────────────────────────────

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Generic payload shape emitted by Supabase postgres_changes.
 * The `new` and `old` fields depend on the event type:
 * - INSERT: `new` is populated, `old` is empty
 * - UPDATE: both `new` and `old` are populated
 * - DELETE: `old` is populated, `new` is empty
 */
export interface RealtimePayload<T> {
  eventType: RealtimeEventType;
  new: Partial<T>;
  old: Partial<T>;
  schema: string;
  table: string;
  commitTimestamp: string;
}

// ─── Table-specific row shapes (snake_case DB columns) ──────────────────

export interface TransactionRow {
  id: string;
  contact_id: string;
  property_id: string | null;
  pipeline_type: string;
  current_stage: string;
  assigned_agent_id: string;
  offer_amount: number | null;
  offer_status: string | null;
  contract_price: number | null;
  settlement_date: string | null;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessageRow {
  id: string;
  channel: string;
  direction: string;
  contact_id: string;
  agent_id: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  property_id: string | null;
  transaction_id: string | null;
  thread_id: string | null;
  status: string;
  is_read: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  contact_id: string | null;
  transaction_id: string | null;
  status: string;
  current_action_index: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface DocumentRow {
  id: string;
  name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  category: string;
  contact_id: string | null;
  transaction_id: string | null;
  property_id: string | null;
  uploaded_by: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  priority: string;
  category: string;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  action_primary: string | null;
  action_secondary: string | null;
  action_tertiary: string | null;
  dedup_key: string | null;
  scheduled_for: string | null;
  snoozed_until: string | null;
  sent_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  is_digest_item: boolean;
  digest_sent_at: string | null;
  metadata: Record<string, unknown> | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Typed change events per table ──────────────────────────────────────

export type TransactionChangeEvent = RealtimePayload<TransactionRow>;
export type MessageChangeEvent = RealtimePayload<ConversationMessageRow>;
export type WorkflowRunChangeEvent = RealtimePayload<WorkflowRunRow>;
export type DocumentChangeEvent = RealtimePayload<DocumentRow>;
export type NotificationChangeEvent = RealtimePayload<NotificationRow>;
