import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePropertyMatches, useUpdatePropertyMatchStatus } from '../../src/hooks/use-property-matches';
import type { PropertyMatchStatus } from '@realflow/shared';

function getScoreColor(score: number): string {
  if (score >= 75) return '#16a34a';
  if (score >= 50) return '#ca8a04';
  return '#dc2626';
}

function getScoreBgColor(score: number): string {
  if (score >= 75) return '#dcfce7';
  if (score >= 50) return '#fef9c3';
  return '#fee2e2';
}

function getStatusLabel(status: PropertyMatchStatus): string {
  const labels: Record<PropertyMatchStatus, string> = {
    'new': 'New',
    'sent_to_client': 'Sent to Client',
    'client_interested': 'Interested',
    'inspection_booked': 'Inspection Booked',
    'rejected': 'Rejected',
    'under_review': 'Under Review',
  };
  return labels[status];
}

function getStatusColor(status: PropertyMatchStatus): string {
  const colors: Record<PropertyMatchStatus, string> = {
    'new': '#2563eb',
    'sent_to_client': '#8b5cf6',
    'client_interested': '#16a34a',
    'inspection_booked': '#0891b2',
    'rejected': '#6b7280',
    'under_review': '#ca8a04',
  };
  return colors[status];
}

function MatchQuickActions({ matchId, status }: { matchId: string; status: PropertyMatchStatus }) {
  const updateStatus = useUpdatePropertyMatchStatus(matchId);

  function handleAction(action: 'interested' | 'rejected') {
    const newStatus: PropertyMatchStatus = action === 'interested' ? 'client_interested' : 'rejected';
    updateStatus.mutate(
      { status: newStatus },
      {
        onSuccess: () => {
          Alert.alert(
            action === 'interested' ? 'Marked Interested' : 'Rejected',
            `Match updated.`
          );
        },
      },
    );
  }

  if (status === 'rejected' || status === 'client_interested') {
    return null;
  }

  return (
    <View style={styles.quickActions}>
      <TouchableOpacity
        style={styles.quickActionInterested}
        onPress={() => handleAction('interested')}
        activeOpacity={0.7}
      >
        <Text style={styles.quickActionText}>✓</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.quickActionReject}
        onPress={() => handleAction('rejected')}
        activeOpacity={0.7}
      >
        <Text style={styles.quickActionText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MatchesListScreen() {
  const router = useRouter();
  const { data: matches, isLoading, refetch } = usePropertyMatches();

  if (isLoading && !matches) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={matches ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No property matches found</Text>
        }
        renderItem={({ item }) => {
          const scoreColor = getScoreColor(item.overallScore);
          const scoreBgColor = getScoreBgColor(item.overallScore);
          const statusColor = getStatusColor(item.status);

          // Build address from property relation
          const property = item.property;
          const address = property?.address
            ? `${(property.address as Record<string, string>).streetNumber ?? ''} ${(property.address as Record<string, string>).streetName ?? ''}, ${(property.address as Record<string, string>).suburb ?? ''}`
            : 'Unknown address';
          const price = property?.price_guide ?? (property?.list_price ? `$${property.list_price.toLocaleString()}` : '');

          return (
            <TouchableOpacity
              style={styles.matchRow}
              onPress={() => router.push(`/matches/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.matchContent}>
                <View style={styles.matchTop}>
                  <Text style={styles.matchAddress} numberOfLines={1}>{address}</Text>
                  <View style={[styles.scoreBadge, { backgroundColor: scoreBgColor }]}>
                    <Text style={[styles.scoreText, { color: scoreColor }]}>
                      {item.overallScore}%
                    </Text>
                  </View>
                </View>

                {price ? <Text style={styles.matchPrice}>{price}</Text> : null}

                <View style={styles.matchMeta}>
                  {property && (
                    <Text style={styles.matchSpecs}>
                      {property.bedrooms} bed {'\u00B7'} {property.bathrooms} bath {'\u00B7'} {property.car_spaces} car
                    </Text>
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
              </View>

              <MatchQuickActions matchId={item.id} status={item.status} />
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

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  matchContent: { flex: 1 },
  matchTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchAddress: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  scoreBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreText: { fontSize: 13, fontWeight: '700' },
  matchPrice: { fontSize: 14, fontWeight: '600', color: '#2563eb', marginBottom: 6 },
  matchMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  matchSpecs: { fontSize: 12, color: '#6b7280' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },

  quickActions: { flexDirection: 'column', gap: 6, marginLeft: 10 },
  quickActionInterested: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionReject: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: { fontSize: 16, fontWeight: '700', color: '#111827' },
});
