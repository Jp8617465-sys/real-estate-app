import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BUYERS_AGENT_STAGE_LABELS,
  type BuyersAgentStage,
} from '@realflow/shared';
import { usePipeline } from '../../src/hooks/use-pipeline';

function getStageColor(stage: BuyersAgentStage): string {
  const colors: Record<BuyersAgentStage, string> = {
    'enquiry': '#6b7280',
    'consult-qualify': '#8b5cf6',
    'engaged': '#2563eb',
    'strategy-brief': '#0891b2',
    'active-search': '#16a34a',
    'offer-negotiate': '#ca8a04',
    'under-contract': '#ea580c',
    'settled-nurture': '#16a34a',
  };
  return colors[stage];
}

export default function BAPipelineScreen() {
  const router = useRouter();
  const { data: transactions, isLoading } = usePipeline('buyers-agent');
  const stages = Object.entries(BUYERS_AGENT_STAGE_LABELS) as [BuyersAgentStage, string][];

  if (isLoading && !transactions) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Group transactions by current_stage
  const grouped: Record<string, typeof transactions> = {};
  for (const stage of stages) {
    grouped[stage[0]] = [];
  }
  for (const tx of transactions ?? []) {
    const stage = tx.currentStage ?? tx.current_stage;
    if (grouped[stage]) {
      grouped[stage]!.push(tx);
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {stages.map(([key, label]) => {
        const cards = grouped[key] ?? [];
        const color = getStageColor(key);
        return (
          <View key={key} style={styles.column}>
            <View style={styles.columnHeader}>
              <View style={[styles.stageIndicator, { backgroundColor: color }]} />
              <Text style={styles.columnTitle} numberOfLines={1}>{label}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{cards.length}</Text>
              </View>
            </View>
            {cards.map((card) => {
              const contact = (card as Record<string, unknown>).contact as
                | { first_name: string; last_name: string; buyer_profile: Record<string, unknown> | null }
                | undefined;
              const clientName = contact
                ? `${contact.first_name} ${contact.last_name}`
                : 'Unknown';
              const budget = contact?.buyer_profile
                ? `$${((contact.buyer_profile.budgetMin as number) / 1000).toFixed(0)}K-$${((contact.buyer_profile.budgetMax as number) / 1000).toFixed(0)}K`
                : '';

              return (
                <TouchableOpacity
                  key={card.id}
                  style={styles.card}
                  onPress={() => router.push(`/brief/${card.contactId ?? card.contact_id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cardName}>{clientName}</Text>
                  {budget ? <Text style={styles.cardBudget}>{budget}</Text> : null}
                </TouchableOpacity>
              );
            })}
            {cards.length === 0 && (
              <Text style={styles.emptyText}>No clients</Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  column: {
    width: 260,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  columnTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  countBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countText: { fontSize: 11, fontWeight: '600', color: '#4b5563' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    margin: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 48,
  },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardBudget: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 16 },
});
