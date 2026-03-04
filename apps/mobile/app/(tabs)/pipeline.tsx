import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  SELLER_STAGE_LABELS,
  BUYER_STAGE_LABELS,
  type SellerStage,
  type BuyerStage,
  type PipelineType,
  type Transaction,
} from '@realflow/shared';
import { usePipeline } from '../../src/hooks/use-pipeline';
import { DealCard, LoadingSpinner, EmptyState } from '../../src/components';

// ─── Stage colors ───────────────────────────────────────────────────
const SELLER_STAGE_COLORS: Record<SellerStage, string> = {
  'appraisal-request': '#6b7280',
  'listing-preparation': '#8b5cf6',
  'on-market': '#2563eb',
  'offers-negotiation': '#ca8a04',
  'under-contract': '#ea580c',
  'settled': '#16a34a',
};

const BUYER_STAGE_COLORS: Record<BuyerStage, string> = {
  'new-enquiry': '#6b7280',
  'qualified-lead': '#8b5cf6',
  'active-search': '#2563eb',
  'property-shortlisted': '#0891b2',
  'due-diligence': '#ca8a04',
  'offer-made': '#ea580c',
  'under-contract': '#dc2626',
  'settled': '#16a34a',
};

// ─── Pipeline type config ───────────────────────────────────────────
interface PipelineConfig {
  type: PipelineType;
  label: string;
  stages: [string, string][];
  colors: Record<string, string>;
}

const PIPELINE_CONFIGS: PipelineConfig[] = [
  {
    type: 'selling',
    label: 'Selling',
    stages: Object.entries(SELLER_STAGE_LABELS),
    colors: SELLER_STAGE_COLORS as Record<string, string>,
  },
  {
    type: 'buying',
    label: 'Buying',
    stages: Object.entries(BUYER_STAGE_LABELS),
    colors: BUYER_STAGE_COLORS as Record<string, string>,
  },
];

// ─── Deal card contact type ─────────────────────────────────────────
interface DealContact {
  id: string;
  first_name: string;
  last_name: string;
  buyer_profile: Record<string, unknown> | null;
}

type DealWithContact = Transaction & { contact: DealContact };

// ─── Pipeline Screen ────────────────────────────────────────────────
export default function PipelineScreen() {
  const router = useRouter();
  const [activePipeline, setActivePipeline] = useState(0);
  const config = PIPELINE_CONFIGS[activePipeline]!;

  const { data: transactions, isLoading, refetch } = usePipeline(config.type);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading && !transactions) {
    return <LoadingSpinner />;
  }

  // Group transactions by stage
  const grouped: Record<string, DealWithContact[]> = {};
  for (const [stageKey] of config.stages) {
    grouped[stageKey] = [];
  }
  for (const tx of (transactions ?? []) as DealWithContact[]) {
    const stage = tx.currentStage ?? tx.current_stage;
    if (grouped[stage]) {
      grouped[stage]!.push(tx);
    }
  }

  const totalDeals = transactions?.length ?? 0;

  return (
    <View style={styles.container}>
      {/* Pipeline Type Selector */}
      <View style={styles.selectorContainer}>
        {PIPELINE_CONFIGS.map((pConfig, index) => {
          const isActive = activePipeline === index;
          return (
            <TouchableOpacity
              key={pConfig.type}
              style={[styles.selectorTab, isActive && styles.activeSelectorTab]}
              onPress={() => setActivePipeline(index)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.selectorText, isActive && styles.activeSelectorText]}>
                {pConfig.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <View style={styles.dealCount}>
          <Ionicons name="briefcase-outline" size={14} color="#6b7280" />
          <Text style={styles.dealCountText}>{totalDeals} deals</Text>
        </View>
      </View>

      {/* Horizontal Stages */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stagesScroll}
        contentContainerStyle={styles.stagesContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
        }
      >
        {config.stages.map(([key, label]) => {
          const cards = grouped[key] ?? [];
          const color = config.colors[key] ?? '#6b7280';

          return (
            <View key={key} style={styles.column}>
              {/* Column Header */}
              <View style={styles.columnHeader}>
                <View style={[styles.stageIndicator, { backgroundColor: color }]} />
                <Text style={styles.columnTitle} numberOfLines={1}>{label}</Text>
                <View style={[styles.countBadge, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.countText, { color }]}>{cards.length}</Text>
                </View>
              </View>

              {/* Cards */}
              <ScrollView
                style={styles.columnScroll}
                contentContainerStyle={styles.columnContent}
                showsVerticalScrollIndicator={false}
              >
                {cards.length === 0 ? (
                  <View style={styles.emptyColumn}>
                    <Ionicons name="folder-open-outline" size={20} color="#d1d5db" />
                    <Text style={styles.emptyText}>No deals</Text>
                  </View>
                ) : (
                  cards.map((card) => (
                    <DealCard
                      key={card.id}
                      transaction={card}
                      onPress={() => router.push(`/contact/${card.contactId ?? card.contact_id}` as never)}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  selectorTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activeSelectorTab: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeSelectorText: {
    color: '#ffffff',
  },
  dealCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 4,
  },
  dealCountText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  stagesScroll: {
    flex: 1,
  },
  stagesContent: {
    padding: 16,
    paddingTop: 4,
  },
  column: {
    width: 260,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
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
  columnTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  columnScroll: {
    flex: 1,
  },
  columnContent: {
    paddingBottom: 8,
  },
  emptyColumn: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
  },
});
