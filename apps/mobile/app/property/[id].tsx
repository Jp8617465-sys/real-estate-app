import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imageEmoji}>🏠</Text>
      </View>

      <Text style={styles.address}>42 Ocean Street, Bondi NSW 2026</Text>
      <Text style={styles.type}>House</Text>

      <View style={styles.features}>
        <View style={styles.feature}>
          <Text style={styles.featureValue}>4</Text>
          <Text style={styles.featureLabel}>Beds</Text>
        </View>
        <View style={styles.feature}>
          <Text style={styles.featureValue}>2</Text>
          <Text style={styles.featureLabel}>Baths</Text>
        </View>
        <View style={styles.feature}>
          <Text style={styles.featureValue}>2</Text>
          <Text style={styles.featureLabel}>Cars</Text>
        </View>
        <View style={styles.feature}>
          <Text style={styles.featureValue}>450</Text>
          <Text style={styles.featureLabel}>m²</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Listing Details</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={[styles.infoValue, { color: '#15803d' }]}>Active</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sale Type</Text>
          <Text style={styles.infoValue}>Auction</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Agent</Text>
          <Text style={styles.infoValue}>James Chen</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vendor</Text>
          <Text style={styles.infoValue}>David Williams</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Performance</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Portal Views</Text>
          <Text style={styles.infoValue}>342</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Enquiries</Text>
          <Text style={styles.infoValue}>12</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Inspections</Text>
          <Text style={styles.infoValue}>8</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 32 },
  imagePlaceholder: {
    height: 220,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmoji: { fontSize: 60 },
  address: { fontSize: 20, fontWeight: '700', color: '#111827', paddingHorizontal: 16, paddingTop: 16 },
  type: { fontSize: 14, color: '#6b7280', paddingHorizontal: 16, marginTop: 4 },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  feature: { alignItems: 'center' },
  featureValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  featureLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '500' },
});
