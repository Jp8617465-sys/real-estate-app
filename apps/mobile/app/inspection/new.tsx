import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateInspection } from '../../src/hooks/use-inspections';
import type { InspectionImpression, ClientSuitability } from '@realflow/shared';

const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90];

export default function NewInspectionScreen() {
  const router = useRouter();
  const createInspection = useCreateInspection();

  const [address, setAddress] = useState('');
  const [impression, setImpression] = useState<InspectionImpression | null>(null);
  const [notes, setNotes] = useState('');
  const [suitability, setSuitability] = useState<ClientSuitability | null>(null);
  const [sellingAgent, setSellingAgent] = useState('');
  const [timeSpent, setTimeSpent] = useState<number | null>(null);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  function handleSubmit() {
    if (!address.trim()) {
      Alert.alert('Required', 'Please enter the property address.');
      return;
    }
    if (!impression) {
      Alert.alert('Required', 'Please select an overall impression.');
      return;
    }

    createInspection.mutate(
      {
        propertyId: '', // Will be linked to actual property
        inspectionDate: new Date().toISOString(),
        overallImpression: impression,
        conditionNotes: notes || undefined,
        clientSuitability: suitability ?? undefined,
        timeSpentMinutes: timeSpent ?? undefined,
        agentNotes: undefined,
        areaFeelNotes: undefined,
        photos: [],
        createdBy: '', // Will be filled from auth context
      },
      {
        onSuccess: () => {
          Alert.alert('Saved', 'Inspection logged successfully.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (err) => {
          Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save inspection.');
        },
      },
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Property Address */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Property Address *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. 42 Ocean St, Bondi NSW 2026"
          placeholderTextColor="#9ca3af"
          value={address}
          onChangeText={setAddress}
          autoFocus
        />
      </View>

      {/* Date / Time */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Date & Time</Text>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeBadge}>
            <Text style={styles.dateTimeText}>{dateLabel}</Text>
          </View>
          <View style={styles.dateTimeBadge}>
            <Text style={styles.dateTimeText}>{timeLabel}</Text>
          </View>
        </View>
      </View>

      {/* Overall Impression */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Overall Impression *</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.impressionButton,
              styles.impressionPositive,
              impression === 'positive' && styles.impressionPositiveActive,
            ]}
            onPress={() => setImpression('positive')}
            activeOpacity={0.7}
          >
            <Text style={styles.impressionEmoji}>👍</Text>
            <Text
              style={[
                styles.impressionLabel,
                impression === 'positive' && styles.impressionLabelActive,
              ]}
            >
              Positive
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.impressionButton,
              styles.impressionNeutral,
              impression === 'neutral' && styles.impressionNeutralActive,
            ]}
            onPress={() => setImpression('neutral')}
            activeOpacity={0.7}
          >
            <Text style={styles.impressionEmoji}>🤔</Text>
            <Text
              style={[
                styles.impressionLabel,
                impression === 'neutral' && styles.impressionLabelActive,
              ]}
            >
              Neutral
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.impressionButton,
              styles.impressionNegative,
              impression === 'negative' && styles.impressionNegativeActive,
            ]}
            onPress={() => setImpression('negative')}
            activeOpacity={0.7}
          >
            <Text style={styles.impressionEmoji}>👎</Text>
            <Text
              style={[
                styles.impressionLabel,
                impression === 'negative' && styles.impressionLabelActive,
              ]}
            >
              Negative
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Quick Notes</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Key observations, condition, standout features..."
          placeholderTextColor="#9ca3af"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Client Suitability */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Client Suitability</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.suitabilityButton,
              suitability === 'match' && styles.suitabilityMatchActive,
            ]}
            onPress={() => setSuitability('match')}
            activeOpacity={0.7}
          >
            <Text style={styles.suitabilityEmoji}>✅</Text>
            <Text
              style={[
                styles.suitabilityLabel,
                suitability === 'match' && styles.suitabilityLabelMatch,
              ]}
            >
              Match
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.suitabilityButton,
              suitability === 'maybe' && styles.suitabilityMaybeActive,
            ]}
            onPress={() => setSuitability('maybe')}
            activeOpacity={0.7}
          >
            <Text style={styles.suitabilityEmoji}>🤷</Text>
            <Text
              style={[
                styles.suitabilityLabel,
                suitability === 'maybe' && styles.suitabilityLabelMaybe,
              ]}
            >
              Maybe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.suitabilityButton,
              suitability === 'no' && styles.suitabilityNoActive,
            ]}
            onPress={() => setSuitability('no')}
            activeOpacity={0.7}
          >
            <Text style={styles.suitabilityEmoji}>❌</Text>
            <Text
              style={[
                styles.suitabilityLabel,
                suitability === 'no' && styles.suitabilityLabelNo,
              ]}
            >
              No
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Selling Agent */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Selling Agent</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Agent name"
          placeholderTextColor="#9ca3af"
          value={sellingAgent}
          onChangeText={setSellingAgent}
        />
      </View>

      {/* Time Spent */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Time Spent (minutes)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeRow}
        >
          {TIME_OPTIONS.map((mins) => (
            <TouchableOpacity
              key={mins}
              style={[
                styles.timeChip,
                timeSpent === mins && styles.timeChipActive,
              ]}
              onPress={() => setTimeSpent(mins)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.timeChipText,
                  timeSpent === mins && styles.timeChipTextActive,
                ]}
              >
                {mins}m
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Photos</Text>
        <TouchableOpacity style={styles.mediaButton} activeOpacity={0.7}>
          <Text style={styles.mediaButtonEmoji}>📷</Text>
          <Text style={styles.mediaButtonText}>Add Photos</Text>
        </TouchableOpacity>
      </View>

      {/* Voice Note */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Voice Note</Text>
        <TouchableOpacity style={styles.mediaButton} activeOpacity={0.7}>
          <Text style={styles.mediaButtonEmoji}>🎤</Text>
          <Text style={styles.mediaButtonText}>Record Note</Text>
        </TouchableOpacity>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, createInspection.isPending && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        activeOpacity={0.8}
        disabled={createInspection.isPending}
      >
        <Text style={styles.submitButtonText}>
          {createInspection.isPending ? 'Saving...' : 'Save Inspection'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },

  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 48,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },

  dateTimeRow: { flexDirection: 'row', gap: 12 },
  dateTimeBadge: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 48,
    justifyContent: 'center',
  },
  dateTimeText: { fontSize: 15, fontWeight: '500', color: '#111827' },

  buttonRow: { flexDirection: 'row', gap: 10 },

  // Impression buttons
  impressionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minHeight: 80,
  },
  impressionEmoji: { fontSize: 28, marginBottom: 6 },
  impressionLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  impressionLabelActive: { color: '#fff' },

  impressionPositive: {},
  impressionPositiveActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  impressionNeutral: {},
  impressionNeutralActive: { backgroundColor: '#ca8a04', borderColor: '#ca8a04' },
  impressionNegative: {},
  impressionNegativeActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },

  // Suitability buttons
  suitabilityButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minHeight: 64,
  },
  suitabilityEmoji: { fontSize: 22, marginBottom: 4 },
  suitabilityLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  suitabilityMatchActive: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  suitabilityMaybeActive: { backgroundColor: '#fef9c3', borderColor: '#ca8a04' },
  suitabilityNoActive: { backgroundColor: '#fee2e2', borderColor: '#dc2626' },
  suitabilityLabelMatch: { color: '#16a34a' },
  suitabilityLabelMaybe: { color: '#ca8a04' },
  suitabilityLabelNo: { color: '#dc2626' },

  // Time chips
  timeRow: { gap: 8 },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 48,
    justifyContent: 'center',
  },
  timeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  timeChipText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  timeChipTextActive: { color: '#fff' },

  // Media buttons
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    minHeight: 56,
  },
  mediaButtonEmoji: { fontSize: 20, marginRight: 8 },
  mediaButtonText: { fontSize: 15, fontWeight: '500', color: '#2563eb' },

  // Submit
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 56,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  bottomSpacer: { height: 40 },
});
