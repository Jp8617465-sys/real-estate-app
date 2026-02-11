import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInspection } from '../../src/hooks/use-inspections';
import type { InspectionImpression, ClientSuitability } from '@realflow/shared';

function getImpressionDisplay(impression: InspectionImpression): { emoji: string; label: string; color: string; bgColor: string } {
  switch (impression) {
    case 'positive':
      return { emoji: '👍', label: 'Positive', color: '#16a34a', bgColor: '#dcfce7' };
    case 'neutral':
      return { emoji: '🤔', label: 'Neutral', color: '#ca8a04', bgColor: '#fef9c3' };
    case 'negative':
      return { emoji: '👎', label: 'Negative', color: '#dc2626', bgColor: '#fee2e2' };
  }
}

function getSuitabilityDisplay(suitability: ClientSuitability): { label: string; color: string; bgColor: string } {
  switch (suitability) {
    case 'match':
      return { label: 'Match', color: '#16a34a', bgColor: '#dcfce7' };
    case 'maybe':
      return { label: 'Maybe', color: '#ca8a04', bgColor: '#fef9c3' };
    case 'no':
      return { label: 'No', color: '#dc2626', bgColor: '#fee2e2' };
  }
}

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: inspection, isLoading, error } = useInspection(id ?? '');

  if (isLoading || !inspection) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load inspection</Text>
      </View>
    );
  }

  const impressionDisplay = getImpressionDisplay(inspection.overallImpression);

  const dateObj = new Date(inspection.inspectionDate);
  const formattedDate = dateObj.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.dateTime}>{formattedDate} at {formattedTime}</Text>
      </View>

      {/* Impression & Suitability */}
      <View style={styles.badgesRow}>
        <View style={[styles.badge, { backgroundColor: impressionDisplay.bgColor }]}>
          <Text style={styles.badgeEmoji}>{impressionDisplay.emoji}</Text>
          <Text style={[styles.badgeText, { color: impressionDisplay.color }]}>
            {impressionDisplay.label}
          </Text>
        </View>
        {inspection.clientSuitability && (
          <View style={[styles.badge, { backgroundColor: getSuitabilityDisplay(inspection.clientSuitability).bgColor }]}>
            <Text style={[styles.badgeText, { color: getSuitabilityDisplay(inspection.clientSuitability).color }]}>
              Client: {getSuitabilityDisplay(inspection.clientSuitability).label}
            </Text>
          </View>
        )}
        {inspection.timeSpentMinutes && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{inspection.timeSpentMinutes} min</Text>
          </View>
        )}
      </View>

      {/* Condition Notes */}
      {inspection.conditionNotes && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Condition Notes</Text>
          <Text style={styles.cardBody}>{inspection.conditionNotes}</Text>
        </View>
      )}

      {/* Agent Notes */}
      {inspection.agentNotes ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Agent Notes</Text>
          <Text style={styles.cardBody}>{inspection.agentNotes}</Text>
        </View>
      ) : null}

      {/* Photos Grid */}
      {inspection.photos && inspection.photos.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Photos ({inspection.photos.length})</Text>
          <View style={styles.photosGrid}>
            {inspection.photos.map((photo) => (
              <View key={photo.id} style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>📷</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Voice Note Placeholder */}
      {inspection.voiceNoteUrl && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Voice Note</Text>
          <TouchableOpacity style={styles.voiceNotePlayer} activeOpacity={0.7}>
            <Text style={styles.voiceNoteIcon}>▶️</Text>
            <View style={styles.voiceNoteBar}>
              <View style={styles.voiceNoteProgress} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit Button */}
      <TouchableOpacity style={styles.editButton} activeOpacity={0.8}>
        <Text style={styles.editButtonText}>Edit Inspection</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  errorText: { fontSize: 16, color: '#dc2626' },

  header: { marginBottom: 16 },
  dateTime: { fontSize: 14, color: '#6b7280' },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  badgeEmoji: { fontSize: 16, marginRight: 4 },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },

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
    marginBottom: 8,
  },
  cardBody: { fontSize: 15, color: '#111827', lineHeight: 22 },

  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoPlaceholderText: { fontSize: 24 },

  voiceNotePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
  },
  voiceNoteIcon: { fontSize: 20, marginRight: 10 },
  voiceNoteBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginRight: 10,
  },
  voiceNoteProgress: {
    width: '30%',
    height: 4,
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },

  editButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  editButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  bottomSpacer: { height: 40 },
});
