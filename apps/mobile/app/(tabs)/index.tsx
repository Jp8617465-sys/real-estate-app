import { View, Text, ScrollView, StyleSheet } from 'react-native';

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Welcome back, Sarah</Text>

      <View style={styles.statsGrid}>
        <StatCard title="Active Leads" value="24" subtitle="+3 this week" />
        <StatCard title="Listed" value="8" subtitle="+1 this week" />
        <StatCard title="Under Contract" value="3" subtitle="$2.4M" />
        <StatCard title="Tasks Due" value="7" subtitle="2 overdue" />
      </View>

      <Text style={styles.sectionTitle}>Today&apos;s Tasks</Text>
      {[
        { title: 'Call Michael re: inspection', priority: 'high' },
        { title: 'Schedule Lisa private inspection', priority: 'high' },
        { title: 'Send shortlist to Priya', priority: 'medium' },
      ].map((task, i) => (
        <View key={i} style={styles.taskItem}>
          <View
            style={[
              styles.priorityDot,
              { backgroundColor: task.priority === 'high' ? '#f97316' : '#eab308' },
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
