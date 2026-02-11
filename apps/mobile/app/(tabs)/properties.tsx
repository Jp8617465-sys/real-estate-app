import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useProperties } from '../../src/hooks/use-properties';
import type { Property } from '@realflow/shared';

function formatAddress(address: Property['address']): string {
  const parts: string[] = [];
  if (address.unitNumber) parts.push(`${address.unitNumber}/`);
  parts.push(`${address.streetNumber} ${address.streetName}`);
  parts.push(`, ${address.suburb}`);
  return parts.join('');
}

function getStatusStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case 'active':
      return { bg: '#dcfce7', text: '#15803d' };
    case 'pre-market':
      return { bg: '#fef9c3', text: '#a16207' };
    case 'under-offer':
      return { bg: '#dbeafe', text: '#2563eb' };
    case 'sold':
      return { bg: '#f3f4f6', text: '#6b7280' };
    default:
      return { bg: '#f3f4f6', text: '#6b7280' };
  }
}

export default function PropertiesScreen() {
  const router = useRouter();
  const { data: properties, isLoading, refetch } = useProperties();

  if (isLoading && !properties) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={properties ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No properties found</Text>
        }
        renderItem={({ item }: { item: Property }) => {
          const statusStyle = getStatusStyle(item.listingStatus);
          const displayPrice = item.priceGuide ?? (item.listPrice ? `$${item.listPrice.toLocaleString()}` : 'Price TBC');

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/property/${item.id}`)}
            >
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imageIcon}>🏠</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.address}>{formatAddress(item.address)}</Text>
                <Text style={styles.type}>{item.propertyType}</Text>
                <View style={styles.features}>
                  <Text style={styles.feature}>{item.bedrooms} bed</Text>
                  <Text style={styles.feature}>{item.bathrooms} bath</Text>
                  <Text style={styles.feature}>{item.carSpaces} car</Text>
                </View>
                <View style={styles.footer}>
                  <Text style={styles.price}>{displayPrice}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {item.listingStatus}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  list: { padding: 16 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: 40 },
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
  imageIcon: { fontSize: 40 },
  cardContent: { padding: 14 },
  address: { fontSize: 15, fontWeight: '600', color: '#111827' },
  type: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  features: { flexDirection: 'row', gap: 12, marginTop: 8 },
  feature: { fontSize: 12, color: '#6b7280' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  price: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
});
