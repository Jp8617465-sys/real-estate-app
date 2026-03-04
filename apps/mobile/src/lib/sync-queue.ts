import { supabase } from './supabase';
import { storageGet, storageSet, StorageKeys } from './offline-storage';

// ─── Types ─────────────────────────────────────────────────────────

export type SyncOperationType = 'create' | 'update' | 'delete';

export type SyncTable =
  | 'contacts'
  | 'transactions'
  | 'tasks'
  | 'conversation_messages';

export interface SyncQueueEntry {
  /** Unique identifier for this queue entry */
  id: string;
  /** The operation type */
  type: SyncOperationType;
  /** The database table to sync to */
  table: SyncTable;
  /** The record ID (for update/delete operations) */
  recordId: string | null;
  /** The data payload to send */
  data: Record<string, unknown>;
  /** ISO timestamp when this entry was created */
  createdAt: string;
  /** Number of times this entry has been retried */
  retryCount: number;
  /** ISO timestamp of the last retry attempt */
  lastRetryAt: string | null;
  /** Error message from the last failed attempt */
  lastError: string | null;
}

export interface SyncResult {
  success: boolean;
  entry: SyncQueueEntry;
  error?: string;
  serverData?: Record<string, unknown>;
}

export interface SyncQueueStatus {
  pendingCount: number;
  deadLetterCount: number;
  isProcessing: boolean;
  lastProcessedAt: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────

const MAX_RETRY_COUNT = 5;

// ─── Queue State ───────────────────────────────────────────────────

let isProcessing = false;
let lastProcessedAt: string | null = null;
let currentUserId: string | null = null;

// ─── Listeners ─────────────────────────────────────────────────────

type SyncQueueListener = (status: SyncQueueStatus) => void;
const listeners = new Set<SyncQueueListener>();

export function subscribeSyncQueue(listener: SyncQueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function notifyListeners(): Promise<void> {
  const status = await getSyncQueueStatus();
  for (const listener of listeners) {
    listener(status);
  }
}

// ─── User Management ───────────────────────────────────────────────

export function setSyncQueueUserId(userId: string): void {
  currentUserId = userId;
}

function getUserId(): string {
  if (!currentUserId) {
    throw new Error('Sync queue user ID not set. Call setSyncQueueUserId first.');
  }
  return currentUserId;
}

// ─── UUID Generation ───────────────────────────────────────────────

function generateId(): string {
  // Simple UUID v4 generation without external dependency
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += hex[Math.floor(Math.random() * 4) + 8];
    } else {
      uuid += hex[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

// ─── Queue Operations ──────────────────────────────────────────────

/**
 * Load the current sync queue from storage.
 */
async function loadQueue(): Promise<SyncQueueEntry[]> {
  const userId = getUserId();
  const queue = await storageGet<SyncQueueEntry[]>(StorageKeys.syncQueue(userId));
  return queue ?? [];
}

/**
 * Save the sync queue to storage.
 */
async function saveQueue(queue: SyncQueueEntry[]): Promise<void> {
  const userId = getUserId();
  await storageSet(StorageKeys.syncQueue(userId), queue);
}

/**
 * Load the dead letter queue from storage.
 */
async function loadDeadLetterQueue(): Promise<SyncQueueEntry[]> {
  const userId = getUserId();
  const queue = await storageGet<SyncQueueEntry[]>(
    StorageKeys.syncQueueDeadLetter(userId),
  );
  return queue ?? [];
}

/**
 * Save the dead letter queue to storage.
 */
async function saveDeadLetterQueue(queue: SyncQueueEntry[]): Promise<void> {
  const userId = getUserId();
  await storageSet(StorageKeys.syncQueueDeadLetter(userId), queue);
}

/**
 * Add a mutation to the sync queue. Deduplicates updates to the same record.
 */
export async function enqueue(
  type: SyncOperationType,
  table: SyncTable,
  data: Record<string, unknown>,
  recordId?: string,
): Promise<SyncQueueEntry> {
  const queue = await loadQueue();

  // Deduplication: if there is already a pending update for the same record,
  // merge the data into the existing entry instead of adding a duplicate.
  if (type === 'update' && recordId) {
    const existingIndex = queue.findIndex(
      (entry) =>
        entry.table === table &&
        entry.recordId === recordId &&
        entry.type === 'update',
    );

    if (existingIndex !== -1) {
      const existing = queue[existingIndex];
      queue[existingIndex] = {
        ...existing,
        data: { ...existing.data, ...data },
        createdAt: new Date().toISOString(),
      };
      await saveQueue(queue);
      await notifyListeners();
      return queue[existingIndex];
    }
  }

  // If we have a create followed by an update for the same temp ID, merge into create
  if (type === 'update' && recordId) {
    const createIndex = queue.findIndex(
      (entry) =>
        entry.table === table &&
        entry.recordId === recordId &&
        entry.type === 'create',
    );

    if (createIndex !== -1) {
      const existing = queue[createIndex];
      queue[createIndex] = {
        ...existing,
        data: { ...existing.data, ...data },
      };
      await saveQueue(queue);
      await notifyListeners();
      return queue[createIndex];
    }
  }

  const entry: SyncQueueEntry = {
    id: generateId(),
    type,
    table,
    recordId: recordId ?? null,
    data,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastRetryAt: null,
    lastError: null,
  };

  queue.push(entry);
  await saveQueue(queue);
  await notifyListeners();
  return entry;
}

/**
 * Remove an entry from the queue (after successful processing).
 */
async function dequeue(entryId: string): Promise<void> {
  const queue = await loadQueue();
  const filtered = queue.filter((entry) => entry.id !== entryId);
  await saveQueue(filtered);
}

/**
 * Move a failed entry to the dead letter queue.
 */
async function moveToDeadLetter(entry: SyncQueueEntry): Promise<void> {
  const deadLetter = await loadDeadLetterQueue();
  deadLetter.push(entry);
  await saveDeadLetterQueue(deadLetter);
  await dequeue(entry.id);
}

// ─── Processing ────────────────────────────────────────────────────

/**
 * Process a single sync queue entry against Supabase.
 */
async function processEntry(entry: SyncQueueEntry): Promise<SyncResult> {
  try {
    let result: { data: Record<string, unknown> | null; error: { message: string } | null };

    switch (entry.type) {
      case 'create': {
        // For creates, strip the temporary ID if present and let the server assign one
        const createData = { ...entry.data };
        if (
          typeof createData.id === 'string' &&
          createData.id.startsWith('temp_')
        ) {
          delete createData.id;
        }

        result = await supabase
          .from(entry.table)
          .insert(createData)
          .select()
          .single();
        break;
      }

      case 'update': {
        if (!entry.recordId) {
          return {
            success: false,
            entry,
            error: 'Update operation requires a recordId',
          };
        }

        result = await supabase
          .from(entry.table)
          .update(entry.data)
          .eq('id', entry.recordId)
          .select()
          .single();
        break;
      }

      case 'delete': {
        if (!entry.recordId) {
          return {
            success: false,
            entry,
            error: 'Delete operation requires a recordId',
          };
        }

        // Soft delete per project conventions
        result = await supabase
          .from(entry.table)
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', entry.recordId)
          .select()
          .single();
        break;
      }

      default:
        return {
          success: false,
          entry,
          error: `Unknown operation type: ${entry.type}`,
        };
    }

    if (result.error) {
      return {
        success: false,
        entry,
        error: result.error.message,
      };
    }

    return {
      success: true,
      entry,
      serverData: (result.data as Record<string, unknown>) ?? undefined,
    };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error during sync';
    return {
      success: false,
      entry,
      error: errorMessage,
    };
  }
}

/**
 * Process all entries in the sync queue, in order.
 * Returns an array of results for each processed entry.
 */
export async function processQueue(): Promise<SyncResult[]> {
  if (isProcessing) return [];

  isProcessing = true;
  await notifyListeners();

  const results: SyncResult[] = [];

  try {
    const queue = await loadQueue();

    if (queue.length === 0) {
      return results;
    }

    // Process entries in order (FIFO)
    for (const entry of queue) {
      const result = await processEntry(entry);

      if (result.success) {
        await dequeue(entry.id);
        results.push(result);
      } else {
        // Increment retry count
        const updatedEntry: SyncQueueEntry = {
          ...entry,
          retryCount: entry.retryCount + 1,
          lastRetryAt: new Date().toISOString(),
          lastError: result.error ?? null,
        };

        if (updatedEntry.retryCount >= MAX_RETRY_COUNT) {
          // Move to dead letter queue
          await moveToDeadLetter(updatedEntry);
          results.push({
            ...result,
            error: `Moved to dead letter queue after ${MAX_RETRY_COUNT} retries: ${result.error}`,
          });
        } else {
          // Update the entry in the queue with incremented retry count
          const currentQueue = await loadQueue();
          const idx = currentQueue.findIndex((e) => e.id === entry.id);
          if (idx !== -1) {
            currentQueue[idx] = updatedEntry;
            await saveQueue(currentQueue);
          }
          results.push(result);

          // Stop processing on first failure to maintain order
          break;
        }
      }
    }

    lastProcessedAt = new Date().toISOString();
  } finally {
    isProcessing = false;
    await notifyListeners();
  }

  return results;
}

// ─── Queue Status ──────────────────────────────────────────────────

/**
 * Get the current status of the sync queue.
 */
export async function getSyncQueueStatus(): Promise<SyncQueueStatus> {
  let pendingCount = 0;
  let deadLetterCount = 0;

  try {
    const queue = await loadQueue();
    pendingCount = queue.length;
  } catch {
    // Queue not initialised yet
  }

  try {
    const deadLetter = await loadDeadLetterQueue();
    deadLetterCount = deadLetter.length;
  } catch {
    // Dead letter queue not initialised yet
  }

  return {
    pendingCount,
    deadLetterCount,
    isProcessing,
    lastProcessedAt,
  };
}

/**
 * Get all pending entries in the sync queue.
 */
export async function getPendingEntries(): Promise<SyncQueueEntry[]> {
  return loadQueue();
}

/**
 * Get all entries in the dead letter queue.
 */
export async function getDeadLetterEntries(): Promise<SyncQueueEntry[]> {
  return loadDeadLetterQueue();
}

/**
 * Retry all dead letter entries by moving them back to the main queue.
 */
export async function retryDeadLetterEntries(): Promise<void> {
  const deadLetter = await loadDeadLetterQueue();
  if (deadLetter.length === 0) return;

  const queue = await loadQueue();

  // Reset retry counts and add back to main queue
  const retriedEntries = deadLetter.map((entry) => ({
    ...entry,
    retryCount: 0,
    lastRetryAt: null,
    lastError: null,
  }));

  await saveQueue([...queue, ...retriedEntries]);
  await saveDeadLetterQueue([]);
  await notifyListeners();
}

/**
 * Clear the dead letter queue entirely.
 */
export async function clearDeadLetterQueue(): Promise<void> {
  await saveDeadLetterQueue([]);
  await notifyListeners();
}

/**
 * Clear the entire sync queue (use with caution).
 */
export async function clearSyncQueue(): Promise<void> {
  await saveQueue([]);
  await notifyListeners();
}
