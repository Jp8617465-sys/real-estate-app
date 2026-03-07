import { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { subscribeSyncQueue, type SyncQueueStatus } from '../lib/sync-queue';

// ─── Types ─────────────────────────────────────────────────────────

interface OfflineBannerProps {
  /** Whether to show the pending changes count. Default: true */
  showPendingCount?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────

export function OfflineBanner({ showPendingCount = true }: OfflineBannerProps) {
  const { isOffline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const isVisibleRef = useRef(false);

  // Track pending sync count
  useEffect(() => {
    if (!showPendingCount) return;

    const unsubscribe = subscribeSyncQueue((status: SyncQueueStatus) => {
      setPendingCount(status.pendingCount);
    });
    return unsubscribe;
  }, [showPendingCount]);

  // Slide animation
  useEffect(() => {
    if (isOffline && !isVisibleRef.current) {
      isVisibleRef.current = true;
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else if (!isOffline && isVisibleRef.current) {
      Animated.timing(slideAnim, {
        toValue: -60,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        isVisibleRef.current = false;
      });
    }
  }, [isOffline, slideAnim]);

  // Always render (for animation), but position offscreen when online
  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={`You are offline.${pendingCount > 0 ? ` ${pendingCount} changes waiting to sync.` : ''}`}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline-outline" size={16} color="#92400e" />
        <Text style={styles.text}>You are offline</Text>
        {showPendingCount && pendingCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {pendingCount} pending
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#fef3c7',
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 6,
  },
  badge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
