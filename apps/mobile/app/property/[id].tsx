import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useProperty } from '../../src/hooks/use-properties';
import type { Property } from '@realflow/shared';

function formatAddress(address: Property['address']): string {
  const parts: string[] = [];
  if (address.unitNumber) parts.push(`${address.unitNumber}/`);
  parts.push(`${address.streetNumber} ${address.streetName}`);
  parts.push(`, ${address.suburb} ${address.state} ${address.postcode}`);
  return parts.join('');
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: property, isLoading, error } = useProperty(id ?? '');

  if (isLoading || !property) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load property</Text>
      </View>
    );
  }

  const displayPrice = property.priceGuide ?? (property.listPrice ? `$${property.listPrice.toLocaleString()}` : 'Price TBC');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imageEmoji}>🏠</Text>
      </View>

      <Text style={styles.address}>{formatAddress(property.address)}</Text>
      <Text style={styles.type}>{property.propertyType}</Text>

      <View style={styles.features}>
        <View style={styles.feature}>
          <Text style={styles.featureValue}>{property.bedrooms}</Text>
          <Text style={styles.featureLabel}>Beds</Text>
        </View>
        <View style={styles.feature}>
          <Text style={styles.featureValue}>{property.bathrooms}</Text>
          <Text style={styles.featureLabel}>Baths</Text>
        </View>
        <View style={styles.feature}>
          <Text style={styles.featureValue}>{property.carSpaces}</Text>
          <Text style={styles.featureLabel}>Cars</Text>
        </View>
        {property.landSize && (
          <View style={styles.feature}>
            <Text style={styles.featureValue}>{property.landSize}</Text>
            <Text style={styles.featureLabel}>m2</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Listing Details</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={[styles.infoValue, { color: property.listingStatus === 'active' ? '#15803d' : '#111827' }]}>
            {property.listingStatus}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sale Type</Text>
          <Text style={styles.infoValue}>{property.saleType}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Price</Text>
          <Text style={styles.infoValue}>{displayPrice}</Text>
        </View>
        {property.auctionDate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Auction Date</Text>
            <Text style={styles.infoValue}>
              {new Date(property.auctionDate).toLocaleDateString('en-AU')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Performance</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Portal Views</Text>
          <Text style={styles.infoValue}>{property.portalViews}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Enquiries</Text>
          <Text style={styles.infoValue}>{property.enquiryCount}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Inspections</Text>
          <Text style={styles.infoValue}>{property.inspectionCount}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 32 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  errorText: { fontSize: 16, color: '#dc2626' },
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
