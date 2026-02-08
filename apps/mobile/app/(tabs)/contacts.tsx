import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const contacts = [
  { id: '1', name: 'Michael Johnson', type: 'Buyer', phone: '0413 111 001', score: 82 },
  { id: '2', name: 'Priya Patel', type: 'Buyer / Investor', phone: '0413 111 002', score: 45 },
  { id: '3', name: 'David Williams', type: 'Seller', phone: '0413 111 003', score: 70 },
  { id: '4', name: 'Lisa Nguyen', type: 'Buyer', phone: '0413 111 004', score: 90 },
  { id: '5', name: 'Robert Clarke', type: 'Referral', phone: '0413 111 005', score: 0 },
];

function getScoreColor(score: number) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#eab308';
  if (score >= 25) return '#3b82f6';
  return '#9ca3af';
}

export default function ContactsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => router.push(`/contact/${item.id}`)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name.split(' ').map((n) => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.type} &middot; {item.phone}</Text>
            </View>
            {item.score > 0 && (
              <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(item.score) + '20' }]}>
                <Text style={[styles.scoreText, { color: getScoreColor(item.score) }]}>
                  {item.score}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  scoreBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  scoreText: { fontSize: 12, fontWeight: '600' },
});
