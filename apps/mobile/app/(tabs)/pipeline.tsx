import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { BUYER_STAGE_LABELS, type BuyerStage } from '@realflow/shared';

const stageData: Record<string, { name: string; budget: string }[]> = {
  'new-enquiry': [{ name: 'Tom Richards', budget: '$600K-$800K' }],
  'qualified-lead': [{ name: 'Priya Patel', budget: '$500K-$750K' }],
  'active-search': [{ name: 'Michael Johnson', budget: '$800K-$1.2M' }],
  'property-shortlisted': [{ name: 'Lisa Nguyen', budget: '$1.5M-$2M' }],
  'due-diligence': [],
  'offer-made': [],
  'under-contract': [{ name: 'Mark Stevens', budget: '$1.1M' }],
  settled: [],
};

export default function PipelineScreen() {
  const stages = Object.entries(BUYER_STAGE_LABELS) as [BuyerStage, string][];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {stages.map(([key, label]) => {
        const cards = stageData[key] ?? [];
        return (
          <View key={key} style={styles.column}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{label}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{cards.length}</Text>
              </View>
            </View>
            {cards.map((card, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardName}>{card.name}</Text>
                <Text style={styles.cardBudget}>{card.budget}</Text>
              </View>
            ))}
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
