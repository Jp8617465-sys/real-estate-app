import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNotifications, useMarkNotificationRead, useDismissNotification } from '../../src/hooks/use-notifications';
import type { Notification } from '@realflow/shared';

function getCategoryIcon(category: string): string {
  const map: Record<string, string> = {
    new_lead: '👤',
    property_match: '🏠',
    key_date: '📅',
    pipeline_update: '📈',
    follow_up_due: '💬',
    daily_action_list: '⭐',
    digest: '📋',
    system: 'ℹ️',
  };
  return map[category] ?? '🔔';
}

function getPriorityBadgeStyle(priority: string) {
  switch (priority) {
    case 'critical':
      return { backgroundColor: '#fee2e2', color: '#991b1b' };
    case 'high':
      return { backgroundColor: '#ffedd5', color: '#9a3412' };
    case 'medium':
      return { backgroundColor: '#fef9c3', color: '#854d0e' };
    default:
      return { backgroundColor: '#f3f4f6', color: '#374151' };
  }
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const dismiss = useDismissNotification();

  const handlePress = (notification: Notification) => {
    if (notification.status !== 'read') {
      markRead.mutate(notification.id);
    }
    if (notification.entityType === 'contact' && notification.entityId) {
      router.push(`/contact/${notification.entityId}`);
    } else if (notification.entityType === 'property' && notification.entityId) {
      router.push(`/property/${notification.entityId}`);
    }
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No notifications</Text>}
        renderItem={({ item }) => {
          const isUnread = item.status === 'sent';
          const badgeStyle = getPriorityBadgeStyle(item.priority);

          return (
            <TouchableOpacity
              style={[styles.card, isUnread && styles.cardUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{getCategoryIcon(item.category)}</Text>
                {isUnread && <View style={styles.unreadDot} />}
              </View>

              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.priorityBadge, { backgroundColor: badgeStyle.backgroundColor }]}>
                    <Text style={[styles.priorityBadgeText, { color: badgeStyle.color }]}>
                      {item.priority}
                    </Text>
                  </View>
                </View>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
              </View>

              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => dismiss.mutate(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.dismissText}>×</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 8 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    gap: 10,
  },
  cardUnread: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  iconContainer: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  content: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: 14, fontWeight: '500', color: '#374151', flex: 1 },
  titleUnread: { fontWeight: '700', color: '#111827' },
  priorityBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  priorityBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  dismissBtn: { paddingHorizontal: 4 },
  dismissText: { fontSize: 18, color: '#9ca3af', fontWeight: '700' },
});
