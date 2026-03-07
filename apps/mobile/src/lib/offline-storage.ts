import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Key Namespace ─────────────────────────────────────────
const STORAGE_PREFIX = '@realflow';

function userKey(userId: string, key: string): string {
  return `${STORAGE_PREFIX}:${userId}:${key}`;
}

function globalKey(key: string): string {
  return `${STORAGE_PREFIX}:global:${key}`;
}

// ─── Storage Keys ──────────────────────────────────────────────────
export const StorageKeys = {
  contacts: (userId: string) => userKey(userId, 'contacts'),
  pipeline: (userId: string, pipelineType: string) =>
    userKey(userId, `pipeline:${pipelineType}`),
  syncQueue: (userId: string) => userKey(userId, 'sync-queue'),
  syncQueueDeadLetter: (userId: string) => userKey(userId, 'sync-queue:dead-letter'),
  lastSyncTimestamp: (userId: string, entity: string) =>
    userKey(userId, `last-sync:${entity}`),
  cachedData: (userId: string, cacheKey: string) =>
    userKey(userId, `cache:${cacheKey}`),
  currentUserId: () => globalKey('current-user-id'),
} as const;

// ─── Typed Storage Wrapper ─────────────────────────────────────────
export interface StorageMetadata {
  storedAt: string;
  expiresAt: string | null;
}

interface StorageEntry<T> {
  data: T;
  meta: StorageMetadata;
}

/**
 * Get a typed value from AsyncStorage.
 * Returns null if the key does not exist or if the stored data has expired.
 */
export async function storageGet<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;

  try {
    const entry: StorageEntry<T> = JSON.parse(raw);

    // Check expiration
    if (entry.meta.expiresAt) {
      const expiresAt = new Date(entry.meta.expiresAt);
      if (expiresAt < new Date()) {
        // Expired: remove and return null
        await AsyncStorage.removeItem(key);
        return null;
      }
    }

    return entry.data;
  } catch {
    // Corrupted data: remove and return null
    await AsyncStorage.removeItem(key);
    return null;
  }
}

/**
 * Get a typed value along with its metadata.
 * Returns null if the key does not exist or if the stored data has expired.
 */
export async function storageGetWithMeta<T>(
  key: string,
): Promise<{ data: T; meta: StorageMetadata } | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;

  try {
    const entry: StorageEntry<T> = JSON.parse(raw);

    if (entry.meta.expiresAt) {
      const expiresAt = new Date(entry.meta.expiresAt);
      if (expiresAt < new Date()) {
        await AsyncStorage.removeItem(key);
        return null;
      }
    }

    return { data: entry.data, meta: entry.meta };
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

/**
 * Set a typed value in AsyncStorage with optional TTL (in milliseconds).
 */
export async function storageSet<T>(
  key: string,
  data: T,
  ttlMs?: number,
): Promise<void> {
  const now = new Date();
  const entry: StorageEntry<T> = {
    data,
    meta: {
      storedAt: now.toISOString(),
      expiresAt: ttlMs ? new Date(now.getTime() + ttlMs).toISOString() : null,
    },
  };

  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

/**
 * Remove a key from AsyncStorage.
 */
export async function storageRemove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/**
 * Check if a key exists and is not expired.
 */
export async function storageHas(key: string): Promise<boolean> {
  const value = await storageGet<unknown>(key);
  return value !== null;
}

// ─── Batch Operations ──────────────────────────────────────────────

/**
 * Get multiple values at once.
 */
export async function storageMultiGet<T>(
  keys: string[],
): Promise<Map<string, T>> {
  const pairs = await AsyncStorage.multiGet(keys);
  const result = new Map<string, T>();

  for (const [key, raw] of pairs) {
    if (raw === null) continue;
    try {
      const entry: StorageEntry<T> = JSON.parse(raw);

      if (entry.meta.expiresAt) {
        const expiresAt = new Date(entry.meta.expiresAt);
        if (expiresAt < new Date()) continue;
      }

      result.set(key, entry.data);
    } catch {
      // Skip corrupted entries
    }
  }

  return result;
}

// ─── Storage Size Monitoring ───────────────────────────────────────

export interface StorageSizeInfo {
  totalKeys: number;
  userKeys: number;
  estimatedSizeBytes: number;
}

/**
 * Get storage size information for a specific user.
 */
export async function getStorageSize(userId: string): Promise<StorageSizeInfo> {
  const allKeys = await AsyncStorage.getAllKeys();
  const userPrefix = `${STORAGE_PREFIX}:${userId}:`;
  const userKeys = allKeys.filter((k) => k.startsWith(userPrefix));

  let estimatedSizeBytes = 0;

  if (userKeys.length > 0) {
    const pairs = await AsyncStorage.multiGet(userKeys);
    for (const [key, value] of pairs) {
      // Estimate size: key length + value length (UTF-16 = 2 bytes per char)
      estimatedSizeBytes += (key.length + (value?.length ?? 0)) * 2;
    }
  }

  return {
    totalKeys: allKeys.length,
    userKeys: userKeys.length,
    estimatedSizeBytes,
  };
}

// ─── Clear User Data ───────────────────────────────────────────────

/**
 * Remove all stored data for a specific user. Call this on logout.
 */
export async function clearUserData(userId: string): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const userPrefix = `${STORAGE_PREFIX}:${userId}:`;
  const userKeys = allKeys.filter((k) => k.startsWith(userPrefix));

  if (userKeys.length > 0) {
    await AsyncStorage.multiRemove(userKeys);
  }
}

/**
 * Remove all RealFlow data from storage.
 */
export async function clearAllData(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const appKeys = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));

  if (appKeys.length > 0) {
    await AsyncStorage.multiRemove(appKeys);
  }
}
