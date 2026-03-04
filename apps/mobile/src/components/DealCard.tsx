import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Transaction } from '@realflow/shared';

interface DealCardContact {
  id: string;
  first_name: string;
  last_name: string;
  buyer_profile: Record<string, unknown> | null;
}

interface DealCardProps {
  transaction: Transaction & { contact?: DealCardContact };
  onPress: () => void;
}

const STALE_THRESHOLD_DAYS = 14;

function daysSince(dateString: string): number {
  const then = new Date(dateString);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function formatPrice(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${(amount / 1_000).toFixed(0)}K`;
}

export function DealCard({ transaction, onPress }: DealCardProps) {
  const contact = transaction.contact;
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : 'Unknown';

  const price = transaction.contractPrice
    ?? transaction.offerAmount
    ?? null;

  const daysInStage = daysSince(transaction.updatedAt);
  const isStale = daysInStage >= STALE_THRESHOLD_DAYS;

  return (
    <TouchableOpacity
      style={[styles.container, isStale && styles.staleContainer]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Deal with ${contactName}`}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{contactName}</Text>
        {isStale ? (
          <Ionicons name="warning" size={14} color="#f59e0b" />
        ) : null}
      </View>

      {price ? (
        <Text style={styles.price}>{formatPrice(price)}</Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.daysRow}>
          <Ionicons name="time-outline" size={12} color={isStale ? '#f59e0b' : '#9ca3af'} />
          <Text style={[styles.daysText, isStale && styles.staleDaysText]}>
            {daysInStage}d in stage
          </Text>
        </View>
        {transaction.offerStatus ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{transaction.offerStatus}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    margin: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 48,
  },
  staleContainer: {
    borderColor: '#fde68a',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  price: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  daysText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  staleDaysText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'capitalize',
  },
});
