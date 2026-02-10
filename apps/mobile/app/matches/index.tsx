import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { PropertyMatchStatus } from '@realflow/shared';

interface MockMatch {
  id: string;
  address: string;
  overallScore: number;
  status: PropertyMatchStatus;
  price: string;
  beds: number;
  baths: number;
  cars: number;
  clientName: string;
}

const mockMatches: MockMatch[] = [
  {
    id: 'm1',
    address: '42 Ocean St, Bondi NSW 2026',
    overallScore: 92,
    status: 'new',
    price: '$1,150,000',
    beds: 3,
    baths: 2,
    cars: 1,
    clientName: 'Michael Johnson',
  },
  {
    id: 'm2',
    address: '18 Carr St, Coogee NSW 2034',
    overallScore: 85,
    status: 'sent_to_client',
    price: '$980,000',
    beds: 2,
    baths: 2,
    cars: 1,
    clientName: 'Michael Johnson',
  },
  {
    id: 'm3',
    address: '7/120 Arden St, Coogee NSW 2034',
    overallScore: 78,
    status: 'client_interested',
    price: '$1,050,000',
    beds: 3,
    baths: 1,
    cars: 1,
    clientName: 'Priya Patel',
  },
  {
    id: 'm4',
    address: '5 Alison Rd, Randwick NSW 2031',
    overallScore: 65,
    status: 'inspection_booked',
    price: '$1,200,000',
    beds: 4,
    baths: 2,
    cars: 2,
    clientName: 'Priya Patel',
  },
  {
    id: 'm5',
    address: '3/22 Beach Rd, Bondi NSW 2026',
    overallScore: 45,
    status: 'under_review',
    price: '$870,000',
    beds: 2,
    baths: 1,
    cars: 0,
    clientName: 'Lisa Nguyen',
  },
  {
    id: 'm6',
    address: '91 Brook St, Coogee NSW 2034',
    overallScore: 32,
    status: 'rejected',
    price: '$1,400,000',
    beds: 3,
    baths: 2,
    cars: 1,
    clientName: 'Michael Johnson',
  },
];

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

export default function MatchesListScreen() {
  const router = useRouter();

  function handleSwipeAction(matchId: string, action: 'interested' | 'rejected') {
    // TODO: Connect to API
    Alert.alert(
      action === 'interested' ? 'Marked Interested' : 'Rejected',
      `Match ${matchId} updated.`
    );
  }

  function renderItem({ item }: { item: MockMatch }) {
    const scoreColor = getScoreColor(item.overallScore);
    const scoreBgColor = getScoreBgColor(item.overallScore);
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={styles.matchRow}
        onPress={() => router.push(`/matches/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.matchContent}>
          <View style={styles.matchTop}>
            <Text style={styles.matchAddress} numberOfLines={1}>{item.address}</Text>
            <View style={[styles.scoreBadge, { backgroundColor: scoreBgColor }]}>
              <Text style={[styles.scoreText, { color: scoreColor }]}>
                {item.overallScore}%
              </Text>
            </View>
          </View>

          <Text style={styles.matchPrice}>{item.price}</Text>

          <View style={styles.matchMeta}>
            <Text style={styles.matchSpecs}>
              {item.beds} bed {'\u00B7'} {item.baths} bath {'\u00B7'} {item.cars} car
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.clientLabel}>For: {item.clientName}</Text>
        </View>

        {/* Swipe Action Hints */}
        {item.status !== 'rejected' && item.status !== 'client_interested' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionInterested}
              onPress={() => handleSwipeAction(item.id, 'interested')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionReject}
              onPress={() => handleSwipeAction(item.id, 'rejected')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={mockMatches}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16 },

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
  clientLabel: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

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
