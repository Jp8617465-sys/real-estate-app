import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const properties = [
  { id: '1', address: '42 Ocean St, Bondi', type: 'House', beds: 4, baths: 2, cars: 2, status: 'Active', price: 'Auction' },
  { id: '2', address: '3/15 Crown St, Surry Hills', type: 'Apartment', beds: 2, baths: 1, cars: 1, status: 'Active', price: '$680,000' },
  { id: '3', address: '8 View Rd, Mosman', type: 'House', beds: 5, baths: 3, cars: 2, status: 'Pre-market', price: '$2.8M-$3.0M' },
];

export default function PropertiesScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/property/${item.id}`)}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageEmoji}>🏠</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.address}>{item.address}</Text>
              <Text style={styles.type}>{item.type}</Text>
              <View style={styles.features}>
                <Text style={styles.feature}>{item.beds} bed</Text>
                <Text style={styles.feature}>{item.baths} bath</Text>
                <Text style={styles.feature}>{item.cars} car</Text>
              </View>
              <View style={styles.footer}>
                <Text style={styles.price}>{item.price}</Text>
                <View style={[styles.statusBadge, item.status === 'Active' ? styles.statusActive : styles.statusPremarket]}>
                  <Text style={[styles.statusText, item.status === 'Active' ? styles.statusActiveText : styles.statusPremarketText]}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    height: 140,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmoji: { fontSize: 40 },
  cardContent: { padding: 14 },
  address: { fontSize: 15, fontWeight: '600', color: '#111827' },
  type: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  features: { flexDirection: 'row', gap: 12, marginTop: 8 },
  feature: { fontSize: 12, color: '#6b7280' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  price: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusPremarket: { backgroundColor: '#fef9c3' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusActiveText: { color: '#15803d' },
  statusPremarketText: { color: '#a16207' },
});
