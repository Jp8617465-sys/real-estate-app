import { useState, useEffect, useCallback, useRef } from 'react';
import { storageSet, storageGetWithMeta } from '../lib/offline-storage';
import { useNetworkStatus } from './useNetworkStatus';

// ─── Types ─────────────────────────────────────────────────────────

export interface UseOfflineDataOptions {
  /** Time-to-live for cached data, in milliseconds. Default: no expiry. */
  ttlMs?: number;
  /** Background refresh interval in milliseconds. Default: no background refresh. */
  refreshIntervalMs?: number;
  /** Whether to enable background refresh. Default: true if refreshIntervalMs set. */
  enableBackgroundRefresh?: boolean;
  /** Whether to fetch fresh data on mount when online. Default: true. */
  fetchOnMount?: boolean;
}

export interface UseOfflineDataResult<T> {
  /** The current data (from cache or server) */
  data: T | null;
  /** Whether data is currently being fetched from the server */
  isLoading: boolean;
  /** Whether the data came from cache (stale) */
  isStale: boolean;
  /** Error from the last fetch attempt */
  error: Error | null;
  /** ISO timestamp of when the data was last updated */
  lastUpdatedAt: string | null;
  /** Manually trigger a refresh from the server */
  refresh: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────

/**
 * Generic offline-aware data hook implementing stale-while-revalidate.
 *
 * Returns cached data immediately, then fetches fresh data from the server
 * when online. Saves fetched data to offline storage automatically.
 *
 * @param key - Storage key for caching this data
 * @param fetchFn - Async function to fetch data from the server
 * @param options - Configuration options
 */
export function useOfflineData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: UseOfflineDataOptions = {},
): UseOfflineDataResult<T> {
  const {
    ttlMs,
    refreshIntervalMs,
    enableBackgroundRefresh = !!refreshIntervalMs,
    fetchOnMount = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const { isOnline } = useNetworkStatus();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // Load cached data on mount
  useEffect(() => {
    void loadCachedData();
  }, [key]);

  async function loadCachedData(): Promise<void> {
    const result = await storageGetWithMeta<T>(key);
    if (result && mountedRef.current) {
      setData(result.data);
      setLastUpdatedAt(result.meta.storedAt);
      setIsStale(true);
    }
  }

  const fetchFromServer = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const freshData = await fetchFnRef.current();

      if (!mountedRef.current) return;

      setData(freshData);
      setIsStale(false);

      const now = new Date().toISOString();
      setLastUpdatedAt(now);

      // Cache the fresh data
      await storageSet(key, freshData, ttlMs);
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      const fetchError = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(fetchError);

      // If we have cached data, keep showing it (stale)
      // If we don't, surface the error
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [key, ttlMs]);

  // Fetch fresh data when online and on mount
  useEffect(() => {
    if (isOnline && fetchOnMount) {
      void fetchFromServer();
    }
  }, [isOnline, fetchOnMount, fetchFromServer]);

  // Background refresh interval
  useEffect(() => {
    if (enableBackgroundRefresh && refreshIntervalMs && isOnline) {
      intervalRef.current = setInterval(() => {
        void fetchFromServer();
      }, refreshIntervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enableBackgroundRefresh, refreshIntervalMs, isOnline, fetchFromServer]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (isOnline) {
      await fetchFromServer();
    }
  }, [isOnline, fetchFromServer]);

  return {
    data,
    isLoading,
    isStale,
    error,
    lastUpdatedAt,
    refresh,
  };
}
