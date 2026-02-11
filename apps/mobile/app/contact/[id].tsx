import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useContact } from '../../src/hooks/use-contacts';
import type { Contact } from '@realflow/shared';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: contact, isLoading, error } = useContact(id ?? '');

  if (isLoading || !contact) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load contact</Text>
      </View>
    );
  }

  const name = `${contact.firstName} ${contact.lastName}`;
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Contact Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.badges}>
          {contact.types.map((type) => (
            <View key={type} style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{type}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionEmoji}>📞</Text>
          <Text style={styles.actionLabel}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionEmoji}>💬</Text>
          <Text style={styles.actionLabel}>SMS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionEmoji}>📧</Text>
          <Text style={styles.actionLabel}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionEmoji}>📝</Text>
          <Text style={styles.actionLabel}>Note</Text>
        </TouchableOpacity>
      </View>

      {/* Contact Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{contact.phone}</Text>
        </View>
        {contact.email && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{contact.email}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Source</Text>
          <Text style={styles.infoValue}>{contact.source}</Text>
        </View>
        {contact.communicationPreference && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Preferred</Text>
            <Text style={styles.infoValue}>{contact.communicationPreference}</Text>
          </View>
        )}
      </View>

      {/* Buyer Profile */}
      {contact.buyerProfile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Buyer Profile</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Budget</Text>
            <Text style={styles.infoValue}>
              ${contact.buyerProfile.budgetMin.toLocaleString()} - ${contact.buyerProfile.budgetMax.toLocaleString()}
            </Text>
          </View>
          {contact.buyerProfile.preApproved && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pre-Approved</Text>
              <Text style={styles.infoValue}>
                ${(contact.buyerProfile.preApprovalAmount ?? 0).toLocaleString()}
              </Text>
            </View>
          )}
          {contact.buyerProfile.suburbs.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Suburbs</Text>
              <Text style={styles.infoValue}>{contact.buyerProfile.suburbs.join(', ')}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Beds / Bath / Car</Text>
            <Text style={styles.infoValue}>
              {contact.buyerProfile.bedrooms.min}+ / {contact.buyerProfile.bathrooms.min}+ / {contact.buyerProfile.carSpaces.min}+
            </Text>
          </View>
        </View>
      )}

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tags</Text>
          <View style={styles.tagsRow}>
            {contact.tags.map((tag) => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  errorText: { fontSize: 16, color: '#dc2626' },
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#1d4ed8' },
  name: { fontSize: 22, fontWeight: '700', color: '#111827' },
  badges: { flexDirection: 'row', gap: 8, marginTop: 8 },
  typeBadge: { backgroundColor: '#dcfce7', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { fontSize: 12, fontWeight: '600', color: '#15803d' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  actionButton: { alignItems: 'center' },
  actionEmoji: { fontSize: 24, marginBottom: 4 },
  actionLabel: { fontSize: 12, color: '#4b5563', fontWeight: '500' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '500' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagBadge: { backgroundColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
});
