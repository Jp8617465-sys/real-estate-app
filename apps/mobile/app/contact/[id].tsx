import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Contact Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>MJ</Text>
        </View>
        <Text style={styles.name}>Michael Johnson</Text>
        <View style={styles.badges}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>Buyer</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>Score: 82</Text>
          </View>
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
          <Text style={styles.infoValue}>0413 111 001</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>michael.j@email.com</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Source</Text>
          <Text style={styles.infoValue}>Domain</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Agent</Text>
          <Text style={styles.infoValue}>James Chen</Text>
        </View>
      </View>

      {/* Buyer Profile */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Buyer Profile</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Budget</Text>
          <Text style={styles.infoValue}>$800K - $1.2M</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Pre-Approved</Text>
          <Text style={styles.infoValue}>$1.1M</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Suburbs</Text>
          <Text style={styles.infoValue}>Bondi, Coogee, Randwick</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Beds / Bath / Car</Text>
          <Text style={styles.infoValue}>3+ / 2+ / 1+</Text>
        </View>
      </View>

      {/* Activity */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Activity</Text>
        {[
          { title: 'Inspected 42 Ocean St, Bondi', time: '2h ago' },
          { title: 'Sent 5 property matches', time: '2 days ago' },
          { title: 'Initial discovery call', time: '5 days ago' },
        ].map((activity, i) => (
          <View key={i} style={styles.activityItem}>
            <Text style={styles.activityTitle}>{activity.title}</Text>
            <Text style={styles.activityTime}>{activity.time}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
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
  scoreBadge: { backgroundColor: '#fee2e2', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeText: { fontSize: 12, fontWeight: '600', color: '#dc2626' },
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
  activityItem: {
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
    paddingLeft: 12,
    paddingVertical: 8,
  },
  activityTitle: { fontSize: 14, color: '#111827', fontWeight: '500' },
  activityTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
});
