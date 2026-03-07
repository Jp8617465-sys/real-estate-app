/**
 * Consistent channel naming conventions for Supabase Realtime subscriptions.
 *
 * All channel names follow the pattern: `realflow:{resource}:{scope}`
 * This prevents collisions and makes debugging straightforward.
 */

/** Database change channels — used for postgres_changes subscriptions */
export const RealtimeChannels = {
  /** Pipeline / transaction changes scoped to a pipeline type */
  pipeline: (pipelineType: string) =>
    `realflow:pipeline:${pipelineType}` as const,

  /** All transaction changes (unscoped) */
  pipelineAll: () => 'realflow:pipeline:all' as const,

  /** Conversation messages for a specific contact thread */
  conversationMessages: (contactId: string) =>
    `realflow:messages:${contactId}` as const,

  /** Inbox-level message notifications (all inbound messages for an agent) */
  inboxMessages: (agentId: string) =>
    `realflow:inbox:${agentId}` as const,

  /** Workflow execution status updates */
  workflowRuns: (workflowId: string) =>
    `realflow:workflow-runs:${workflowId}` as const,

  /** All workflow runs (unscoped) */
  workflowRunsAll: () => 'realflow:workflow-runs:all' as const,

  /** Document changes for a contact */
  documents: (contactId: string) =>
    `realflow:documents:${contactId}` as const,

  /** Notifications for a user */
  notifications: (userId: string) =>
    `realflow:notifications:${userId}` as const,

  /** Portal search progress for a contact */
  searchProgress: (contactId: string) =>
    `realflow:search-progress:${contactId}` as const,
} as const;

/** Presence channels — used for typing indicators, online status, etc. */
export const PresenceChannels = {
  /** Typing indicator for a conversation */
  conversationPresence: (contactId: string) =>
    `realflow:presence:conversation:${contactId}` as const,

  /** Online agents channel */
  agentsOnline: () => 'realflow:presence:agents' as const,
} as const;
