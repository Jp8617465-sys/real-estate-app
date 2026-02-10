import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { PropertyMatchStatus, MatchScoreBreakdown } from '@realflow/shared';

interface MockMatchDetail {
  id: string;
  address: string;
  propertyType: string;
  beds: number;
  baths: number;
  cars: number;
  landSize: string;
  price: string;
  overallScore: number;
  scoreBreakdown: MatchScoreBreakdown;
  status: PropertyMatchStatus;
  flags: string[];
  agentNotes: string;
  listingAgent: string;
  listingAgency: string;
  clientName: string;
}

const mockMatch: MockMatchDetail = {
  id: 'm1',
  address: '42 Ocean St, Bondi NSW 2026',
  propertyType: 'Apartment',
  beds: 3,
  baths: 2,
  cars: 1,
  landSize: '120 sqm',
  price: '$1,150,000',
  overallScore: 92,
  scoreBreakdown: {
    priceMatch: 88,
    locationMatch: 95,
    sizeMatch: 90,
    featureMatch: 85,
  },
  status: 'new',
  flags: ['Ocean views', 'Walking distance to beach', 'Updated kitchen'],
  agentNotes: '',
  listingAgent: 'Jane Thompson',
  listingAgency: 'Ray White Bondi',
  clientName: 'Michael Johnson',
};

const ALL_STATUSES: PropertyMatchStatus[] = [
  'new',
  'sent_to_client',
  'client_interested',
  'inspection_booked',
  'rejected',
  'under_review',
];

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

function getScoreColor(score: number): string {
  if (score >= 75) return '#16a34a';
  if (score >= 50) return '#ca8a04';
  return '#dc2626';
}

function getScoreBarBgColor(score: number): string {
  if (score >= 75) return '#dcfce7';
  if (score >= 50) return '#fef9c3';
  return '#fee2e2';
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = getScoreColor(score);
  const bgColor = getScoreBarBgColor(score);
  return (
    <View style={styles.scoreBarContainer}>
      <View style={styles.scoreBarHeader}>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <Text style={[styles.scoreBarValue, { color }]}>{score}%</Text>
      </View>
      <View style={[styles.scoreBarTrack, { backgroundColor: bgColor }]}>
        <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // TODO: Fetch from API using id
  const match = mockMatch;

  const [selectedStatus, setSelectedStatus] = useState<PropertyMatchStatus>(match.status);
  const [agentNotes, setAgentNotes] = useState(match.agentNotes);

  const overallColor = getScoreColor(match.overallScore);
  const overallBgColor = getScoreBarBgColor(match.overallScore);

  function handleSendToClient() {
    Alert.alert('Send to Client', `This will send ${match.address} to ${match.clientName}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => setSelectedStatus('sent_to_client') },
    ]);
  }

  function handleBookInspection() {
    Alert.alert('Book Inspection', 'Inspection booking flow coming soon.');
  }

  function handleReject() {
    Alert.alert('Reject Match', 'Are you sure you want to reject this match?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => setSelectedStatus('rejected') },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Property Header */}
      <View style={styles.header}>
        <Text style={styles.address}>{match.address}</Text>
        <Text style={styles.propertyType}>{match.propertyType}</Text>
        <Text style={styles.price}>{match.price}</Text>
      </View>

      {/* Overall Score */}
      <View style={[styles.overallScoreCard, { borderColor: overallColor }]}>
        <Text style={styles.overallScoreLabel}>Overall Match</Text>
        <Text style={[styles.overallScoreValue, { color: overallColor }]}>
          {match.overallScore}%
        </Text>
        <Text style={styles.overallScoreClient}>for {match.clientName}</Text>
      </View>

      {/* Property Specs */}
      <View style={styles.specsRow}>
        <View style={styles.specItem}>
          <Text style={styles.specValue}>{match.beds}</Text>
          <Text style={styles.specLabel}>Beds</Text>
        </View>
        <View style={styles.specItem}>
          <Text style={styles.specValue}>{match.baths}</Text>
          <Text style={styles.specLabel}>Baths</Text>
        </View>
        <View style={styles.specItem}>
          <Text style={styles.specValue}>{match.cars}</Text>
          <Text style={styles.specLabel}>Cars</Text>
        </View>
        <View style={styles.specItem}>
          <Text style={styles.specValue}>{match.landSize}</Text>
          <Text style={styles.specLabel}>Size</Text>
        </View>
      </View>

      {/* Score Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Score Breakdown</Text>
        <ScoreBar label="Price" score={match.scoreBreakdown.priceMatch} />
        <ScoreBar label="Location" score={match.scoreBreakdown.locationMatch} />
        <ScoreBar label="Size" score={match.scoreBreakdown.sizeMatch} />
        <ScoreBar label="Features" score={match.scoreBreakdown.featureMatch} />
      </View>

      {/* Flags */}
      {match.flags.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Highlights</Text>
          <View style={styles.flagsWrap}>
            {match.flags.map((flag, i) => (
              <View key={i} style={styles.flagChip}>
                <Text style={styles.flagText}>{flag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Listing Agent */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Listing Agent</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Agent</Text>
          <Text style={styles.infoValue}>{match.listingAgent}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Agency</Text>
          <Text style={styles.infoValue}>{match.listingAgency}</Text>
        </View>
      </View>

      {/* Status Selector */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
          {ALL_STATUSES.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusChip,
                selectedStatus === status && styles.statusChipActive,
              ]}
              onPress={() => setSelectedStatus(status)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.statusChipText,
                  selectedStatus === status && styles.statusChipTextActive,
                ]}
              >
                {getStatusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Agent Notes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Agent Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add your notes about this match..."
          placeholderTextColor="#9ca3af"
          value={agentNotes}
          onChangeText={setAgentNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsColumn}>
        <TouchableOpacity
          style={styles.actionPrimary}
          onPress={handleSendToClient}
          activeOpacity={0.8}
        >
          <Text style={styles.actionPrimaryText}>Send to Client</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionSecondary}
          onPress={handleBookInspection}
          activeOpacity={0.8}
        >
          <Text style={styles.actionSecondaryText}>Book Inspection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionDanger}
          onPress={handleReject}
          activeOpacity={0.8}
        >
          <Text style={styles.actionDangerText}>Reject</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },

  header: { marginBottom: 16 },
  address: { fontSize: 20, fontWeight: '700', color: '#111827' },
  propertyType: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  price: { fontSize: 18, fontWeight: '700', color: '#2563eb', marginTop: 6 },

  overallScoreCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  overallScoreLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  overallScoreValue: { fontSize: 48, fontWeight: '800', marginVertical: 4 },
  overallScoreClient: { fontSize: 13, color: '#6b7280' },

  specsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'space-around',
  },
  specItem: { alignItems: 'center' },
  specValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  specLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Score bars
  scoreBarContainer: { marginBottom: 12 },
  scoreBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  scoreBarLabel: { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  scoreBarValue: { fontSize: 13, fontWeight: '700' },
  scoreBarTrack: { height: 8, borderRadius: 4 },
  scoreBarFill: { height: 8, borderRadius: 4 },

  // Flags
  flagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flagChip: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  flagText: { fontSize: 12, fontWeight: '500', color: '#2563eb' },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '500' },

  // Status selector
  statusRow: { gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    minHeight: 36,
    justifyContent: 'center',
  },
  statusChipActive: { backgroundColor: '#2563eb' },
  statusChipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  statusChipTextActive: { color: '#fff' },

  // Notes
  notesInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 80,
  },

  // Action buttons
  actionsColumn: { gap: 10, marginTop: 8 },
  actionPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  actionPrimaryText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  actionSecondary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
    minHeight: 52,
    justifyContent: 'center',
  },
  actionSecondaryText: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  actionDanger: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dc2626',
    minHeight: 52,
    justifyContent: 'center',
  },
  actionDangerText: { fontSize: 16, fontWeight: '700', color: '#dc2626' },

  bottomSpacer: { height: 40 },
});
