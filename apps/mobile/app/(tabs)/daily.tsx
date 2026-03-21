import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDailyActions, useCompleteDailyAction } from '../../src/hooks/use-daily-actions';
import type { DailyActionItem } from '@realflow/shared';

function getPriorityColor(score: number): string {
  if (score >= 80) return '#ef4444'; // red — urgent
  if (score >= 50) return '#f97316'; // orange — high
  return '#eab308'; // yellow — medium
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    call: '📞',
    follow_up: '💬',
    key_date: '📅',
    inspection: '🏠',
    offer_review: '💰',
    document: '📄',
    pre_approval: '🏦',
    settlement: '🔑',
    general: '✅',
  };
  return map[category] ?? '✅';
}

type DailySection = { title: string; color: string; data: DailyActionItem[] };

export default function DailyActionsScreen() {
  const router = useRouter();
  const { data: response, isLoading, refetch } = useDailyActions();
  const completeAction = useCompleteDailyAction();

  const items = response?.data ?? [];
  const meta = response?.meta;

  const urgentItems = items.filter((i) => (i.compositeScore ?? 0) >= 80 && !i.isCompleted);
  const todayItems = items.filter(
    (i) => (i.compositeScore ?? 0) < 80 && (i.compositeScore ?? 0) >= 40 && !i.isCompleted,
  );
  const suggestItems = items.filter((i) => (i.compositeScore ?? 0) < 40 && !i.isCompleted);
  const completedItems = items.filter((i) => i.isCompleted);

  const sections: Array<{ title: string; color: string; data: DailyActionItem[] }> = [
    { title: '🔴 Urgent', color: '#fef2f2', data: urgentItems },
    { title: '🟠 Due Today', color: '#fff7ed', data: todayItems },
    { title: '🔵 Suggested', color: '#eff6ff', data: suggestItems },
    { title: '✓ Completed', color: '#f9fafb', data: completedItems },
  ].filter((s) => s.data.length > 0);

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (isLoading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Generating your action list…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerDate}>{today}</Text>
        <Text style={styles.headerStats}>
          {meta?.totalCount ?? 0} actions · {meta?.urgentCount ?? 0} urgent
        </Text>
      </View>

      <FlatList<DailySection>
        data={sections}
        keyExtractor={(s: DailySection) => s.title}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No actions for today 🎉</Text>}
        renderItem={({ item: section }: { item: DailySection }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((item: DailyActionItem) => (
              <ActionCard
                key={item.id}
                item={item}
                onComplete={() => completeAction.mutate(item.id)}
                onPress={() => {
                  if (item.contactId) {
                    router.push(`/contact/${item.contactId}`);
                  }
                }}
              />
            ))}
          </View>
        )}
      />
    </View>
  );
}

function ActionCard({
  item,
  onComplete,
  onPress,
}: {
  item: DailyActionItem;
  onComplete: () => void;
  onPress: () => void;
}) {
  const isCompleted = item.isCompleted;

  return (
    <TouchableOpacity
      style={[styles.card, isCompleted && styles.cardCompleted]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Priority bar */}
      <View
        style={[
          styles.priorityBar,
          { backgroundColor: isCompleted ? '#9ca3af' : getPriorityColor(item.compositeScore ?? 0) },
        ]}
      />

      <View style={styles.cardContent}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.categoryEmoji}>{getCategoryEmoji(item.category)}</Text>
          <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>

        {/* AI-generated subtitle */}
        {item.subtitle && item.subtitle !== item.title && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        )}
      </View>

      {/* Complete button */}
      <TouchableOpacity
        style={[styles.completeBtn, isCompleted && styles.completeBtnDone]}
        onPress={onComplete}
        disabled={isCompleted}
      >
        <Text style={styles.completeBtnText}>{isCompleted ? '✓' : '○'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
  },
  loadingText: { fontSize: 14, color: '#6b7280' },
  header: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerDate: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  headerStats: { fontSize: 13, color: '#93c5fd', marginTop: 4 },
  list: { padding: 16, gap: 16 },
  emptyText: { fontSize: 15, color: '#6b7280', textAlign: 'center', padding: 40 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    minHeight: 64,
  },
  cardCompleted: { opacity: 0.5 },
  priorityBar: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryEmoji: { fontSize: 15 },
  title: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  titleCompleted: { textDecorationLine: 'line-through', color: '#9ca3af' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 3, lineHeight: 16 },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnDone: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  completeBtnText: { fontSize: 14, color: '#6b7280', fontWeight: '700' },
});
