/**
 * Presence state types for Supabase Realtime presence channels.
 *
 * These define the shape of state that users broadcast when
 * participating in shared channels (e.g. typing indicators,
 * online status).
 */

/** State broadcast by a user who is typing in a conversation */
export interface TypingPresenceState {
  /** The user's unique ID */
  userId: string;
  /** Display name for the typing indicator */
  displayName: string;
  /** ISO timestamp when typing started — used to auto-expire stale indicators */
  typingStartedAt: string;
  /** Whether the user is currently actively typing */
  isTyping: boolean;
}

/** State broadcast by an agent who is online */
export interface AgentOnlinePresenceState {
  /** The agent's user ID */
  userId: string;
  /** Display name */
  displayName: string;
  /** ISO timestamp of last activity */
  lastActiveAt: string;
  /** Current page/view the agent is on (optional, for collaboration awareness) */
  currentView?: string;
}

/** Presence event types emitted by Supabase */
export type PresenceEventType = 'sync' | 'join' | 'leave';

/** Generic presence event wrapper */
export interface PresenceEvent<T> {
  type: PresenceEventType;
  key: string;
  currentPresences: T[];
  newPresences: T[];
  leftPresences: T[];
}
