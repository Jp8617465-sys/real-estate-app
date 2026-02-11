import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useDashboardStats } from '../../src/hooks/use-dashboard';
import { useTasks } from '../../src/hooks/use-tasks';
import type { Task } from '@realflow/shared';

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
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
      return '#9ca3af';
  }
}

export default function DashboardScreen() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks({ status: 'pending' });

  const isLoading = statsLoading || tasksLoading;

  function handleRefresh() {
    refetchStats();
    refetchTasks();
  }

  if (isLoading && !stats && !tasks) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const pendingTasks = (tasks ?? []).slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
      }
    >
      <Text style={styles.greeting}>Welcome back</Text>

      <View style={styles.statsGrid}>
        <StatCard
          title="Active Leads"
          value={String(stats?.activeContacts ?? 0)}
          subtitle="contacts"
        />
        <StatCard
          title="Listed"
          value={String(stats?.listedProperties ?? 0)}
          subtitle="properties"
        />
        <StatCard
          title="Under Contract"
          value={String(stats?.underContract ?? 0)}
          subtitle="transactions"
        />
        <StatCard
          title="Tasks Due"
          value={String(stats?.tasksDueToday ?? 0)}
          subtitle="today"
        />
      </View>

      <Text style={styles.sectionTitle}>Today&apos;s Tasks</Text>
      {pendingTasks.length === 0 && (
        <Text style={styles.emptyText}>No pending tasks</Text>
      )}
      {pendingTasks.map((task: Task) => (
        <View key={task.id} style={styles.taskItem}>
          <View
            style={[
              styles.priorityDot,
              { backgroundColor: getPriorityColor(task.priority) },
            ]}
          />
          <Text style={styles.taskTitle}>{task.title}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  greeting: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statTitle: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  statValue: { fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 4 },
  statSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: 20 },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  taskTitle: { fontSize: 14, color: '#111827', fontWeight: '500' },
});
