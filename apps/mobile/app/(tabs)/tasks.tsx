import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTasks, useCompleteTask } from '../../src/hooks/use-tasks';
import { TaskItem as TaskItemComponent, LoadingSpinner, EmptyState } from '../../src/components';
import type { Task } from '@realflow/shared';

// ─── Filter Tabs ────────────────────────────────────────────────────
type TimeFilter = 'today' | 'week' | 'all';

interface FilterTabConfig {
  key: TimeFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TIME_FILTERS: FilterTabConfig[] = [
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: 'week', label: 'This Week', icon: 'calendar-outline' },
  { key: 'all', label: 'All', icon: 'list-outline' },
];

// ─── Date helpers ───────────────────────────────────────────────────
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatSectionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date < today) return 'Overdue';
  if (date >= today && date < tomorrow) return 'Today';

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  if (date >= tomorrow && date < dayAfterTomorrow) return 'Tomorrow';

  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

// ─── Section grouping ───────────────────────────────────────────────
interface TaskSection {
  title: string;
  isOverdue: boolean;
  data: Task[];
}

function groupTasksByDate(tasks: Task[]): TaskSection[] {
  const groups: Record<string, Task[]> = {};
  const order: string[] = [];

  for (const task of tasks) {
    const key = formatSectionDate(task.dueDate);
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key]!.push(task);
  }

  // Ensure "Overdue" is always first
  const sections: TaskSection[] = [];
  if (groups['Overdue']) {
    sections.push({ title: 'Overdue', isOverdue: true, data: groups['Overdue'] });
  }
  for (const key of order) {
    if (key !== 'Overdue') {
      sections.push({ title: key, isOverdue: false, data: groups[key]! });
    }
  }

  return sections;
}

// ─── Completable Task Item ──────────────────────────────────────────
function CompletableTaskItem({ task }: { task: Task }) {
  const completeTask = useCompleteTask(task.id);

  return (
    <TaskItemComponent
      task={task}
      onComplete={() => completeTask.mutate()}
    />
  );
}

// ─── Tasks Screen ───────────────────────────────────────────────────
export default function TasksScreen() {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('today');
  const [refreshing, setRefreshing] = useState(false);

  // Build dueDate filter
  const dueDate = useMemo(() => {
    const now = new Date();
    switch (activeFilter) {
      case 'today':
        return endOfDay(now).toISOString();
      case 'week':
        return endOfWeek(now).toISOString();
      default:
        return undefined;
    }
  }, [activeFilter]);

  const { data: tasks, isLoading, refetch } = useTasks(
    dueDate ? { dueDate } : undefined,
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Split into pending and completed, group pending by date
  const { sections, completedCount, pendingCount } = useMemo(() => {
    const allTasks = tasks ?? [];
    const pending = allTasks.filter((t) => t.status !== 'completed');
    const completed = allTasks.filter((t) => t.status === 'completed');
    const grouped = groupTasksByDate(pending);

    return {
      sections: grouped,
      completedCount: completed.length,
      pendingCount: pending.length,
    };
  }, [tasks]);

  if (isLoading && !tasks) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryCount}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, { color: '#16a34a' }]}>{completedCount}</Text>
          <Text style={styles.summaryLabel}>Done</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {TIME_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterTab, isActive && styles.activeFilterTab]}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={filter.icon}
                size={14}
                color={isActive ? '#2563eb' : '#6b7280'}
              />
              <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Task Sections */}
      <SectionList<Task, TaskSection>
        sections={sections}
        keyExtractor={(item: Task) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
        }
        renderSectionHeader={({ section }: { section: TaskSection }) => (
          <View style={[styles.sectionHeader, section.isOverdue && styles.overdueSectionHeader]}>
            {section.isOverdue ? (
              <Ionicons name="alert-circle" size={14} color="#ef4444" style={styles.sectionIcon} />
            ) : null}
            <Text style={[styles.sectionTitle, section.isOverdue && styles.overdueSectionTitle]}>
              {section.title}
            </Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }: { item: Task }) => <CompletableTaskItem task={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="All clear!"
            message={
              activeFilter === 'today'
                ? 'No tasks due today. Enjoy your day!'
                : activeFilter === 'week'
                  ? 'No tasks due this week.'
                  : 'No tasks found.'
            }
          />
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 24,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 1,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e5e7eb',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  activeFilterTab: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeFilterText: {
    color: '#2563eb',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#f9fafb',
  },
  overdueSectionHeader: {
    backgroundColor: '#fef2f2',
    marginHorizontal: -16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 4,
  },
  sectionIcon: {
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    flex: 1,
  },
  overdueSectionTitle: {
    color: '#ef4444',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
});
