import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View contact ${fullName}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
        <View style={styles.metaRow}>
          <Ionicons name={icon} size={12} color={badgeColor} />
          <Text style={[styles.typeLabel, { color: badgeColor }]}>{typeLabel}</Text>
          {contact.phone ? (
            <Text style={styles.phone} numberOfLines={1}> · {contact.phone}</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  phone: {
    fontSize: 12,
    color: '#6b7280',
  },
});
