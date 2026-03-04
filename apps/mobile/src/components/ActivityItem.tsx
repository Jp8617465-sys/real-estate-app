import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Activity, ActivityType } from '@realflow/shared';

interface ActivityItemProps {
  activity: Activity;
}

function getActivityIcon(type: ActivityType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'call':
      return 'call-outline';
    case 'email-sent':
    case 'email-received':
      return 'mail-outline';
    case 'sms-sent':
    case 'sms-received':
      return 'chatbubble-outline';
    case 'meeting':
      return 'people-outline';
    case 'inspection':
    case 'inspection-logged':
      return 'search-outline';
    case 'open-home':
      return 'home-outline';
    case 'note-added':
      return 'document-text-outline';
    case 'stage-change':
      return 'arrow-forward-outline';
    case 'task-completed':
      return 'checkmark-circle-outline';
    case 'offer-submitted':
    case 'offer-round':
      return 'cash-outline';
    case 'contract-exchanged':
      return 'document-outline';
    case 'settlement-completed':
      return 'flag-outline';
    case 'social-dm-sent':
    case 'social-dm-received':
      return 'share-social-outline';
    case 'property-matched':
      return 'flash-outline';
    case 'brief-updated':
      return 'create-outline';
    case 'property-sent':
      return 'send-outline';
    case 'document-uploaded':
      return 'cloud-upload-outline';
    case 'dd-item-completed':
      return 'shield-checkmark-outline';
    default:
      return 'ellipse-outline';
  }
}

function getActivityColor(type: ActivityType): string {
  switch (type) {
    case 'call':
      return '#16a34a';
    case 'email-sent':
    case 'email-received':
      return '#2563eb';
    case 'stage-change':
      return '#9333ea';
    case 'offer-submitted':
    case 'offer-round':
      return '#ea580c';
    case 'contract-exchanged':
    case 'settlement-completed':
      return '#059669';
    case 'task-completed':
      return '#16a34a';
    case 'property-matched':
      return '#2563eb';
    default:
      return '#6b7280';
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const icon = getActivityIcon(activity.type);
  const color = getActivityColor(activity.type);
  const timeAgo = formatTimeAgo(activity.createdAt);

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`${activity.title}, ${timeAgo}`}
    >
      <View style={[styles.iconWrapper, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{activity.title}</Text>
        {activity.description ? (
          <Text style={styles.description} numberOfLines={1}>{activity.description}</Text>
        ) : null}
      </View>
      <Text style={styles.time}>{timeAgo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 18,
  },
  description: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 8,
  },
});
