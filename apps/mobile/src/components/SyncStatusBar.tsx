import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeSyncQueue, processQueue, type SyncQueueStatus } from '../lib/sync-queue';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

// ─── Types ─────────────────────────────────────────────────────────

interface SyncStatusBarProps {
  /** Whether to show the last sync timestamp */
  showTimestamp?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ─── Component ─────────────────────────────────────────────────────

export function SyncStatusBar({ showTimestamp = true }: SyncStatusBarProps) {
  const { isOnline } = useNetworkStatus();
  const [status, setStatus] = useState<SyncQueueStatus>({
    pendingCount: 0,
    deadLetterCount: 0,
    isProcessing: false,
    lastProcessedAt: null,
  });
  const [isForceSyncing, setIsForceSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSyncQueue(setStatus);
    return unsubscribe;
  }, []);

  const handleForceSync = useCallback(async () => {
    if (!isOnline || status.isProcessing || isForceSyncing) return;

    setIsForceSyncing(true);
    try {
      await processQueue();
    } finally {
      setIsForceSyncing(false);
    }
  }, [isOnline, status.isProcessing, isForceSyncing]);

  const isSyncing = status.isProcessing || isForceSyncing;
  const hasPending = status.pendingCount > 0;
  const hasDeadLetter = status.deadLetterCount > 0;

  // Determine display state
  let statusText: string;
  let statusColor: string;
  let iconName: keyof typeof Ionicons.glyphMap;

  if (isSyncing) {
    statusText = 'Syncing...';
    statusColor = '#2563eb';
    iconName = 'sync-outline';
  } else if (!isOnline && hasPending) {
    statusText = `${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} pending`;
    statusColor = '#d97706';
    iconName = 'cloud-offline-outline';
  } else if (hasPending) {
    statusText = `${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} pending`;
    statusColor = '#d97706';
    iconName = 'cloud-upload-outline';
  } else if (hasDeadLetter) {
    statusText = `${status.deadLetterCount} failed sync${status.deadLetterCount === 1 ? '' : 's'}`;
    statusColor = '#dc2626';
    iconName = 'warning-outline';
  } else {
    statusText = 'All synced';
    statusColor = '#16a34a';
    iconName = 'checkmark-circle-outline';
  }

  // Don't render if everything is synced and we don't need to show timestamp
  const allGood = !hasPending && !hasDeadLetter && !isSyncing;
  if (allGood && !showTimestamp && !status.lastProcessedAt) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.container, { borderColor: statusColor + '40' }]}
      onPress={handleForceSync}
      disabled={!isOnline || isSyncing || (!hasPending && !hasDeadLetter)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${statusText}. ${hasPending && isOnline ? 'Tap to force sync.' : ''}`}
    >
      <View style={styles.leftSection}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={statusColor} />
        ) : (
          <Ionicons name={iconName} size={16} color={statusColor} />
        )}
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
      </View>

      <View style={styles.rightSection}>
        {showTimestamp && status.lastProcessedAt ? (
          <Text style={styles.timestamp}>Last sync: {formatTimestamp(status.lastProcessedAt)}</Text>
        ) : null}

        {hasPending && isOnline && !isSyncing ? (
          <Ionicons name="refresh-outline" size={14} color="#9ca3af" style={styles.refreshIcon} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 11,
    color: '#9ca3af',
  },
  refreshIcon: {
    marginLeft: 6,
  },
});
