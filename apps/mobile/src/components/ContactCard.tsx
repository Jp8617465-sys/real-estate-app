import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Contact } from '@realflow/shared';

interface ContactCardProps {
  contact: Contact;
  onPress: () => void;
}

function getTypeIcon(types: Contact['types']): keyof typeof Ionicons.glyphMap {
  if (types.includes('buyer') && types.includes('seller')) return 'swap-horizontal';
  if (types.includes('buyer')) return 'cart-outline';
  if (types.includes('seller')) return 'home-outline';
  if (types.includes('investor')) return 'trending-up-outline';
  if (types.includes('landlord')) return 'key-outline';
  return 'person-outline';
}

function getTypeBadgeColor(types: Contact['types']): string {
  if (types.includes('buyer')) return '#2563eb';
  if (types.includes('seller')) return '#16a34a';
  if (types.includes('investor')) return '#9333ea';
  return '#6b7280';
}

export function ContactCard({ contact, onPress }: ContactCardProps) {
  const fullName = `${contact.firstName} ${contact.lastName}`;
  const initials = `${contact.firstName[0] ?? ''}${contact.lastName[0] ?? ''}`.toUpperCase();
  const typeLabel = contact.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ');
  const badgeColor = getTypeBadgeColor(contact.types);
  const icon = getTypeIcon(contact.types);

  return (
    <TouchableOpacity
      className="flex-row items-center rounded-xl border border-gray-200 bg-white p-3.5 mb-2"
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View contact ${fullName}`}
    >
      {/* Avatar */}
      <View className="h-[42px] w-[42px] rounded-full bg-blue-100 items-center justify-center mr-3">
        <Text className="text-sm font-bold text-blue-700">{initials}</Text>
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-gray-900" numberOfLines={1}>
          {fullName}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Ionicons name={icon} size={12} color={badgeColor} />
          <Text className="text-xs font-medium ml-1" style={{ color: badgeColor }}>
            {typeLabel}
          </Text>
          {contact.phone ? (
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {' · '}{contact.phone}
            </Text>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </TouchableOpacity>
  );
}
