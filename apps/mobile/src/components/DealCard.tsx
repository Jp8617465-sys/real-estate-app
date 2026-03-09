import { View, Text, TouchableOpacity } from 'react-native';
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
  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown';

  const price = transaction.contractPrice ?? transaction.offerAmount ?? null;

  const daysInStage = daysSince(transaction.updatedAt);
  const isStale = daysInStage >= STALE_THRESHOLD_DAYS;

  return (
    <TouchableOpacity
      className={[
        'rounded-[10px] border bg-white p-3 mx-2 mb-1 min-h-[48px]',
        isStale ? 'border-amber-200 border-l-4 border-l-amber-500' : 'border-gray-200',
      ].join(' ')}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Deal with ${contactName}`}
    >
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-semibold text-gray-900 flex-1" numberOfLines={1}>
          {contactName}
        </Text>
        {isStale ? <Ionicons name="warning" size={14} color="#f59e0b" /> : null}
      </View>

      {price ? (
        <Text className="text-[13px] font-semibold text-blue-600 mt-1">
          {formatPrice(price)}
        </Text>
      ) : null}

      <View className="flex-row justify-between items-center mt-1.5">
        <View className="flex-row items-center gap-0.5">
          <Ionicons
            name="time-outline"
            size={12}
            color={isStale ? '#f59e0b' : '#9ca3af'}
          />
          <Text
            className={[
              'text-[11px]',
              isStale ? 'text-amber-500 font-semibold' : 'text-gray-400',
            ].join(' ')}
          >
            {daysInStage}d in stage
          </Text>
        </View>
        {transaction.offerStatus ? (
          <View className="rounded-md bg-gray-100 px-1.5 py-0.5">
            <Text className="text-[10px] font-semibold text-gray-500 capitalize">
              {transaction.offerStatus}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
