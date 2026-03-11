import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Task } from '@realflow/shared';

interface TaskItemProps {
  task: Task;
  onComplete: () => void;
  onPress?: () => void;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return '#ef4444';
    case 'high':
      return '#f97316';
    case 'medium':
      return '#eab308';
    default:
      return '#d1d5db';
  }
}

function getTaskTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'call':
      return 'call-outline';
    case 'email':
      return 'mail-outline';
    case 'sms':
      return 'chatbubble-outline';
    case 'meeting':
      return 'people-outline';
    case 'inspection':
      return 'search-outline';
    case 'follow-up':
      return 'arrow-redo-outline';
    case 'open-home':
      return 'home-outline';
    default:
      return 'checkbox-outline';
  }
}

function formatDueDate(dueDate: string): { label: string; isOverdue: boolean } {
  const date = new Date(dueDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
  }
  if (diffDays === 0) return { label: 'Today', isOverdue: false };
  if (diffDays === 1) return { label: 'Tomorrow', isOverdue: false };
  if (diffDays <= 7) {
    return {
      label: date.toLocaleDateString('en-AU', { weekday: 'short' }),
      isOverdue: false,
    };
  }
  return {
    label: date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    isOverdue: false,
  };
}

function formatDueTime(dueDate: string): string {
  const date = new Date(dueDate);
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function TaskItem({ task, onComplete, onPress }: TaskItemProps) {
  const isCompleted = task.status === 'completed';
  const { label: dueDateLabel, isOverdue } = formatDueDate(task.dueDate);
  const dueTime = formatDueTime(task.dueDate);
  const typeIcon = getTaskTypeIcon(task.type);

  return (
    <TouchableOpacity
      style={[styles.container, isOverdue && !isCompleted && styles.overdueContainer]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${task.title}. ${dueDateLabel}`}
    >
      <View style={[styles.priorityBar, { backgroundColor: getPriorityColor(task.priority) }]} />

      <TouchableOpacity
        style={[styles.checkbox, isCompleted && styles.checkboxCompleted]}
        onPress={() => {
          if (!isCompleted) {
            onComplete();
          }
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={`Mark ${task.title} as complete`}
      >
        {isCompleted ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Ionicons name={typeIcon} size={14} color="#6b7280" style={styles.typeIcon} />
          <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={1}>
            {task.title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.dueDate, isOverdue && !isCompleted && styles.overdueDateText]}>
            {dueDateLabel}
          </Text>
          <Text style={styles.dueTime}> · {dueTime}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  overdueContainer: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  priorityBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    paddingRight: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    marginRight: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  dueDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  overdueDateText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  dueTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
