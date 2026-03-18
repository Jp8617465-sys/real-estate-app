import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDashboardStats } from '../../src/hooks/use-dashboard';
import { useTasks } from '../../src/hooks/use-tasks';
import { usePipeline } from '../../src/hooks/use-pipeline';
import { LoadingSpinner, QuickActionButton, EmptyState } from '../../src/components';
import type { Task } from '@realflow/shared';

// ─── Stat Card ──────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

function StatCard({ title, value, subtitle, icon, iconColor }: StatCardProps) {
  return (
    <View
      style={styles.statCard}
      accessibilityRole="text"
      accessibilityLabel={`${title}: ${value} ${subtitle}`}
    >
      <View style={[styles.statIconWrapper, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

// ─── Pipeline Summary Row ───────────────────────────────────────────
interface PipelineSummaryProps {
  label: string;
  count: number;
  color: string;
  total: number;
}

function PipelineSummaryRow({ label, count, color, total }: PipelineSummaryProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <View style={styles.pipelineRow}>
      <View style={styles.pipelineLabel}>
        <View style={[styles.pipelineDot, { backgroundColor: color }]} />
        <Text style={styles.pipelineLabelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.pipelineBarContainer}>
        <View
          style={[
            styles.pipelineBar,
            { width: `${Math.max(percentage, 2)}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.pipelineCount}>{count}</Text>
    </View>
  );
}

// ─── Priority helpers ───────────────────────────────────────────────
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
    default:
      return 'checkbox-outline';
  }
}

// ─── Seller stage colors ────────────────────────────────────────────
const STAGE_COLORS: Record<string, string> = {
  'appraisal-request': '#6b7280',
  'listing-preparation': '#8b5cf6',
  'on-market': '#2563eb',
  'offers-negotiation': '#ca8a04',
  'under-contract': '#ea580c',
  settled: '#16a34a',
};

const STAGE_LABELS: Record<string, string> = {
  'appraisal-request': 'Appraisal',
  'listing-preparation': 'Listing Prep',
  'on-market': 'On Market',
  'offers-negotiation': 'Offers',
  'under-contract': 'Under Contract',
  settled: 'Settled',
};

// ─── Dashboard Screen ───────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const {
    data: tasks,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useTasks({ status: 'pending' });
  const {
    data: sellingDeals,
    isLoading: pipelineLoading,
    refetch: refetchPipeline,
  } = usePipeline('selling');

  const [refreshing, setRefreshing] = useState(false);

  const isInitialLoading = (statsLoading || tasksLoading || pipelineLoading) && !stats && !tasks;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchTasks(), refetchPipeline()]);
    setRefreshing(false);
  }, [refetchStats, refetchTasks, refetchPipeline]);

  if (isInitialLoading) {
    return <LoadingSpinner />;
  }

  const pendingTasks = (tasks ?? []).slice(0, 5);

  // Build pipeline summary
  const stageKeys = Object.keys(STAGE_LABELS);
  const stageCounts: Record<string, number> = {};
  for (const key of stageKeys) {
    stageCounts[key] = 0;
  }
  for (const deal of sellingDeals ?? []) {
    const stage = deal.currentStage;
    if (stageCounts[stage] !== undefined) {
      stageCounts[stage]++;
    }
  }
  const totalDeals = sellingDeals?.length ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Active Leads"
            value={String(stats?.activeContacts ?? 0)}
            subtitle="contacts"
            icon="people"
            iconColor="#2563eb"
          />
          <StatCard
            title="Listed"
            value={String(stats?.listedProperties ?? 0)}
            subtitle="properties"
            icon="home"
            iconColor="#16a34a"
          />
          <StatCard
            title="Under Contract"
            value={String(stats?.underContract ?? 0)}
            subtitle="transactions"
            icon="document-text"
            iconColor="#9333ea"
          />
          <StatCard
            title="Tasks Due"
            value={String(stats?.tasksDueToday ?? 0)}
            subtitle="today"
            icon="alarm"
            iconColor="#ea580c"
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickActionButton
            icon="person-add-outline"
            label="Add Contact"
            onPress={() => router.push('/contact/new' as never)}
          />
          <QuickActionButton
            icon="home-outline"
            label="Add Property"
            onPress={() => router.push('/property/new' as never)}
            color="#16a34a"
          />
          <QuickActionButton
            icon="add-circle-outline"
            label="New Task"
            onPress={() => router.push('/(tabs)/tasks')}
            color="#9333ea"
          />
          <QuickActionButton
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push('/notifications')}
            color="#ea580c"
          />
        </View>

        {/* Pipeline Summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pipeline Summary</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/pipeline')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {totalDeals === 0 ? (
            <Text style={styles.emptyCardText}>No active deals</Text>
          ) : (
            stageKeys.map((key) => (
              <PipelineSummaryRow
                key={key}
                label={STAGE_LABELS[key] ?? key}
                count={stageCounts[key] ?? 0}
                color={STAGE_COLORS[key] ?? '#6b7280'}
                total={totalDeals}
              />
            ))
          )}
        </View>

        {/* Today's Tasks */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today&apos;s Tasks</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {pendingTasks.length === 0 ? (
          <View style={styles.card}>
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="All caught up!"
              message="No pending tasks for today"
            />
          </View>
        ) : (
          <View style={styles.card}>
            {pendingTasks.map((task: Task) => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskRow}
                onPress={() => router.push('/(tabs)/tasks')}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]}
                />
                <Ionicons
                  name={getTaskTypeIcon(task.type)}
                  size={14}
                  color="#6b7280"
                  style={styles.taskIcon}
                />
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#d1d5db" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  dateText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 0,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 24,
  },
  emptyCardText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
  },
  // Pipeline summary
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pipelineLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  pipelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pipelineLabelText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  pipelineBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  pipelineBar: {
    height: 6,
    borderRadius: 3,
  },
  pipelineCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    width: 24,
    textAlign: 'right',
  },
  // Task rows
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  taskIcon: {
    marginRight: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  bottomSpacer: {
    height: 20,
  },
});
