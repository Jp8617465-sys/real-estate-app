import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

const tasks = [
  { id: '1', title: 'Call Michael re: second inspection', priority: 'high', due: 'Today', contact: 'Michael Johnson' },
  { id: '2', title: 'Schedule Lisa private inspection', priority: 'high', due: 'Today', contact: 'Lisa Nguyen' },
  { id: '3', title: 'Send property shortlist to Priya', priority: 'medium', due: 'Tomorrow', contact: 'Priya Patel' },
  { id: '4', title: 'Prepare vendor report for David', priority: 'high', due: 'Wed', contact: 'David Williams' },
  { id: '5', title: 'Follow up with Robert Clarke', priority: 'medium', due: 'Thu', contact: 'Robert Clarke' },
];

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    default: return '#9ca3af';
  }
}

export default function TasksScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.taskItem}>
            <View style={[styles.priorityBar, { backgroundColor: getPriorityColor(item.priority) }]} />
            <View style={styles.taskContent}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <Text style={styles.taskMeta}>{item.contact} &middot; Due {item.due}</Text>
            </View>
            <View style={styles.checkbox} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16 },
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
  taskMeta: { fontSize: 12, color: '#6b7280', marginTop: 3 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 14,
  },
});
