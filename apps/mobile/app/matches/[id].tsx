import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePropertyMatch, useUpdatePropertyMatchStatus } from '../../src/hooks/use-property-matches';
import type { PropertyMatchStatus } from '@realflow/shared';

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
  const { data: match, isLoading, error } = usePropertyMatch(id ?? '');
  const updateStatus = useUpdatePropertyMatchStatus(id ?? '');

  const [selectedStatus, setSelectedStatus] = useState<PropertyMatchStatus | null>(null);
  const [agentNotes, setAgentNotes] = useState('');

  if (isLoading || !match) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load match</Text>
      </View>
    );
  }

  // Initialize local state from fetched data
  const currentStatus = selectedStatus ?? match.status;
  const currentNotes = agentNotes || (match.agentNotes ?? '');
  const clientBrief = match.client_brief as Record<string, unknown> | undefined;
  const clientContact = clientBrief?.contact as { first_name: string; last_name: string } | undefined;
  const clientName = clientContact ? `${clientContact.first_name} ${clientContact.last_name}` : '';

  const overallColor = getScoreColor(match.overallScore);

  function handleStatusChange(status: PropertyMatchStatus) {
    setSelectedStatus(status);
    updateStatus.mutate({ status, agentNotes: agentNotes || undefined });
  }

  function handleSendToClient() {
    Alert.alert('Send to Client', `This will send this property to ${clientName}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => handleStatusChange('sent_to_client') },
    ]);
  }

  function handleBookInspection() {
    Alert.alert('Book Inspection', 'Inspection booking flow coming soon.');
  }

  function handleReject() {
    Alert.alert('Reject Match', 'Are you sure you want to reject this match?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => handleStatusChange('rejected') },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overall Score */}
      <View style={[styles.overallScoreCard, { borderColor: overallColor }]}>
        <Text style={styles.overallScoreLabel}>Overall Match</Text>
        <Text style={[styles.overallScoreValue, { color: overallColor }]}>
          {match.overallScore}%
        </Text>
        {clientName ? <Text style={styles.overallScoreClient}>for {clientName}</Text> : null}
      </View>

      {/* Score Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Score Breakdown</Text>
        <ScoreBar label="Price" score={match.scoreBreakdown.priceMatch} />
        <ScoreBar label="Location" score={match.scoreBreakdown.locationMatch} />
        <ScoreBar label="Size" score={match.scoreBreakdown.sizeMatch} />
        <ScoreBar label="Features" score={match.scoreBreakdown.featureMatch} />
        {match.scoreBreakdown.investorMatch !== undefined && (
          <ScoreBar label="Investor" score={match.scoreBreakdown.investorMatch} />
        )}
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
                currentStatus === status && styles.statusChipActive,
              ]}
              onPress={() => handleStatusChange(status)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.statusChipText,
                  currentStatus === status && styles.statusChipTextActive,
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
          value={currentNotes}
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  errorText: { fontSize: 16, color: '#dc2626' },

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
