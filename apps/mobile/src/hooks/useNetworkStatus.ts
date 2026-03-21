import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { processQueue } from '../lib/sync-queue';

// ─── Types ─────────────────────────────────────────────────────────

export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';

export interface NetworkStatus {
  /** Whether the device currently has network connectivity */
  isOnline: boolean;
  /** Inverse of isOnline for convenience */
  isOffline: boolean;
  /** The current connection type */
  connectionType: ConnectionType;
  /** Whether the sync queue is currently being processed */
  isSyncing: boolean;
}

interface UseNetworkStatusOptions {
  /** Callback fired when the device transitions from offline to online */
  onOnline?: () => void;
  /** Callback fired when the device transitions from online to offline */
  onOffline?: () => void;
  /** Whether to automatically process the sync queue when coming back online */
  autoSync?: boolean;
  /** Debounce interval for connectivity changes, in milliseconds */
  debounceMs?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────

function mapConnectionType(state: NetInfoState): ConnectionType {
  switch (state.type) {
    case NetInfoStateType.wifi:
      return 'wifi';
    case NetInfoStateType.cellular:
      return 'cellular';
    case NetInfoStateType.ethernet:
      return 'ethernet';
    case NetInfoStateType.none:
    case NetInfoStateType.unknown:
      return state.isConnected ? 'unknown' : 'none';
    default:
      return 'unknown';
  }
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useNetworkStatus(options: UseNetworkStatusOptions = {}): NetworkStatus {
  const { onOnline, onOffline, autoSync = true, debounceMs = 1000 } = options;

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [connectionType, setConnectionType] = useState<ConnectionType>('unknown');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Refs for latest callback values to avoid stale closures
  const onOnlineRef = useRef(onOnline);
  const onOfflineRef = useRef(onOffline);
  const previousOnlineRef = useRef<boolean | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  onOnlineRef.current = onOnline;
  onOfflineRef.current = onOffline;

  const handleSyncQueue = useCallback(async () => {
    if (!autoSync) return;
    setIsSyncing(true);
    try {
      await processQueue();
    } finally {
      setIsSyncing(false);
    }
  }, [autoSync]);

  const handleConnectivityChange = useCallback(
    (state: NetInfoState) => {
      // Clear any pending debounce
      if (debounceTimerRef.current) {
        globalThis.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = globalThis.setTimeout(() => {
        const nowOnline = state.isConnected === true && state.isInternetReachable !== false;
        const connType = mapConnectionType(state);

        setIsOnline(nowOnline);
        setConnectionType(connType);

        const wasOnline = previousOnlineRef.current;
        previousOnlineRef.current = nowOnline;

        // Only fire callbacks on actual transitions (not initial state)
        if (wasOnline !== null) {
          if (!wasOnline && nowOnline) {
            onOnlineRef.current?.();
            void handleSyncQueue();
          } else if (wasOnline && !nowOnline) {
            onOfflineRef.current?.();
          }
        }
      }, debounceMs);
    },
    [debounceMs, handleSyncQueue],
  );

  useEffect(() => {
    // Fetch initial state
    void NetInfo.fetch().then((state) => {
      const nowOnline = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(nowOnline);
      setConnectionType(mapConnectionType(state));
      previousOnlineRef.current = nowOnline;
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        globalThis.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleConnectivityChange]);

  return {
    isOnline,
    isOffline: !isOnline,
    connectionType,
    isSyncing,
  };
}
