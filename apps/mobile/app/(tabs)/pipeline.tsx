import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SELLER_STAGE_LABELS, type SellerStage } from '@realflow/shared';
import { usePipeline } from '../../src/hooks/use-pipeline';

export default function PipelineScreen() {
  const { data: transactions, isLoading } = usePipeline('selling');
  const stages = Object.entries(SELLER_STAGE_LABELS) as [SellerStage, string][];

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
        return (
          <View key={key} style={styles.column}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{label}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{cards.length}</Text>
              </View>
            </View>
            {cards.map((card) => {
              const contact = (card as Record<string, unknown>).contact as
                | { first_name: string; last_name: string }
                | undefined;
              const name = contact
                ? `${contact.first_name} ${contact.last_name}`
                : 'Unknown';
              const price = card.contractPrice
                ? `$${card.contractPrice.toLocaleString()}`
                : card.offerAmount
                  ? `$${card.offerAmount.toLocaleString()}`
                  : '';

              return (
                <View key={card.id} style={styles.card}>
                  <Text style={styles.cardName}>{name}</Text>
                  {price ? <Text style={styles.cardBudget}>{price}</Text> : null}
                </View>
              );
            })}
            {cards.length === 0 && (
              <Text style={styles.emptyText}>No contacts</Text>
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
    width: 240,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  columnTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  countBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: { fontSize: 11, fontWeight: '600', color: '#4b5563' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    margin: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardBudget: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 16 },
});
