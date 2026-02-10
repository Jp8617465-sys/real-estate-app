import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BUYERS_AGENT_STAGE_LABELS,
  type BuyersAgentStage,
} from '@realflow/shared';

interface BAPipelineCard {
  id: string;
  clientName: string;
  budget: string;
  propertyCount: number;
}

const stageData: Record<string, BAPipelineCard[]> = {
  'enquiry': [
    { id: 't1', clientName: 'Sarah Mitchell', budget: '$800K-$1M', propertyCount: 0 },
    { id: 't2', clientName: 'James Lee', budget: '$1.2M-$1.5M', propertyCount: 0 },
  ],
  'consult-qualify': [
    { id: 't3', clientName: 'Emma Wilson', budget: '$600K-$750K', propertyCount: 0 },
  ],
  'engaged': [
    { id: 't4', clientName: 'David Chen', budget: '$900K-$1.1M', propertyCount: 0 },
  ],
  'strategy-brief': [
    { id: 't5', clientName: 'Rachel Green', budget: '$1.5M-$2M', propertyCount: 2 },
  ],
  'active-search': [
    { id: 't6', clientName: 'Michael Johnson', budget: '$800K-$1.2M', propertyCount: 8 },
    { id: 't7', clientName: 'Priya Patel', budget: '$500K-$750K', propertyCount: 5 },
  ],
  'offer-negotiate': [
    { id: 't8', clientName: 'Lisa Nguyen', budget: '$1.5M-$2M', propertyCount: 1 },
  ],
  'under-contract': [
    { id: 't9', clientName: 'Mark Stevens', budget: '$1.1M', propertyCount: 1 },
  ],
  'settled-nurture': [],
};

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
  const stages = Object.entries(BUYERS_AGENT_STAGE_LABELS) as [BuyersAgentStage, string][];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {stages.map(([key, label]) => {
        const cards = stageData[key] ?? [];
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
            {cards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={styles.card}
                onPress={() => router.push(`/brief/${card.id}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardName}>{card.clientName}</Text>
                <Text style={styles.cardBudget}>{card.budget}</Text>
                {card.propertyCount > 0 && (
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardMetaText}>
                      {card.propertyCount} {card.propertyCount === 1 ? 'property' : 'properties'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
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
  cardMeta: {
    marginTop: 6,
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  cardMetaText: { fontSize: 11, fontWeight: '500', color: '#2563eb' },
  emptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 16 },
});
