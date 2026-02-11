import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTasks, useCompleteTask } from '../../src/hooks/use-tasks';
import type { Task } from '@realflow/shared';

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent':
      return '#ef4444';
    case 'high':
      return '#f97316';
    case 'medium':
      return '#eab308';
    default:
      return '#9ca3af';
  }
}

function formatDueDate(dueDate: string): string {
  const date = new Date(dueDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays <= 7) {
    return date.toLocaleDateString('en-AU', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function TasksScreen() {
  const { data: tasks, isLoading, refetch } = useTasks();

  if (isLoading && !tasks) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tasks found</Text>
        }
        renderItem={({ item }: { item: Task }) => (
          <TaskItem task={item} />
        )}
      />
    </View>
  );
}

function TaskItem({ task }: { task: Task }) {
  const completeTask = useCompleteTask(task.id);
  const isCompleted = task.status === 'completed';

  return (
    <TouchableOpacity style={styles.taskItem} activeOpacity={0.7}>
      <View style={[styles.priorityBar, { backgroundColor: getPriorityColor(task.priority) }]} />
      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, isCompleted && styles.taskTitleCompleted]}>
          {task.title}
        </Text>
        <Text style={styles.taskMeta}>
          Due {formatDueDate(task.dueDate)}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.checkbox, isCompleted && styles.checkboxCompleted]}
        onPress={() => {
          if (!isCompleted) {
            completeTask.mutate();
          }
        }}
      >
        {isCompleted && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  list: { padding: 16 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: 40 },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  priorityBar: { width: 4, alignSelf: 'stretch' },
  taskContent: { flex: 1, padding: 14 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  taskTitleCompleted: { textDecorationLine: 'line-through', color: '#9ca3af' },
  taskMeta: { fontSize: 12, color: '#6b7280', marginTop: 3 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
