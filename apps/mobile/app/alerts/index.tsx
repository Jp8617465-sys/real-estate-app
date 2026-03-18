import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { PropertyAlertEvent, PropertyAlertSubscription, AlertChannel } from '@realflow/shared';
import {
  useAlertEvents,
  useAlertSubscriptions,
  useSendMatchToClient,
} from '../../src/hooks/use-alerts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getAlertTypeLabel(alertType: PropertyAlertEvent['alertType']): string {
  const map: Record<PropertyAlertEvent['alertType'], string> = {
    new_match: 'New Match',
    price_drop: 'Price Drop',
    auction_date: 'Auction Date',
    status_change: 'Status Update',
  };
  return map[alertType];
}

function getScoreBadgeStyle(score: number): {
  container: { backgroundColor: string };
  text: { color: string };
} {
  if (score >= 85) {
    return {
      container: { backgroundColor: '#dcfce7' },
      text: { color: '#166534' },
    };
  }
  if (score >= 70) {
    return {
      container: { backgroundColor: '#fef9c3' },
      text: { color: '#854d0e' },
    };
  }
  return {
    container: { backgroundColor: '#f3f4f6' },
    text: { color: '#374151' },
  };
}

function getChannelLabel(channel: AlertChannel): string {
  const map: Record<AlertChannel, string> = {
    push: 'push',
    email: 'email',
    sms: 'sms',
  };
  return map[channel];
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonBlock, styles.skeletonBadge]} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
        <View style={[styles.skeletonBlock, styles.skeletonSubtitle]} />
        <View style={[styles.skeletonBlock, styles.skeletonTime]} />
      </View>
    </View>
  );
}

// ─── Alert Event Card ─────────────────────────────────────────────────────────

function AlertEventCard({ item }: { item: PropertyAlertEvent }) {
  const sendToClient = useSendMatchToClient();
  const isActioned = item.actionedAt !== null;
  const scoreBadge = getScoreBadgeStyle(item.matchScore);

  const handleSend = () => {
    if (item.propertyMatchId) {
      sendToClient.mutate(item.propertyMatchId);
    }
  };

  // TODO: wire up dismiss endpoint when available on mobile
  const handleDismiss = () => undefined;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.scoreBadge, scoreBadge.container]}>
          <Text style={[styles.scoreBadgeText, scoreBadge.text]}>{item.matchScore}</Text>
        </View>
        <Text style={styles.alertTypeLabel}>{getAlertTypeLabel(item.alertType)}</Text>
        <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
      </View>

      {item.propertyMatchId && (
        <Text style={styles.matchId} numberOfLines={1}>
          Match: {item.propertyMatchId}
        </Text>
      )}

      {isActioned ? (
        <View style={styles.actionedRow}>
          <Text style={styles.actionedText}>
            {item.action === 'sent_to_client'
              ? '✓ Sent to client'
              : `✓ ${item.action ?? 'actioned'}`}
            {item.actionedAt !== null ? ` — ${formatTimeAgo(item.actionedAt)}` : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={handleSend}
            disabled={sendToClient.isPending || item.propertyMatchId === null}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnPrimaryText}>
              {sendToClient.isPending ? 'Sending…' : 'Send to Client'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnSecondaryText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Subscription Card ────────────────────────────────────────────────────────

function SubscriptionCard({ item }: { item: PropertyAlertSubscription }) {
  return (
    <View style={styles.card}>
      <Text style={styles.subscriptionBriefId} numberOfLines={1}>
        Brief ID: {item.briefId}
      </Text>
      <View style={styles.subscriptionMeta}>
        <Text style={styles.subscriptionThreshold}>Threshold: ≥ {item.scoreThreshold}/100</Text>
        <View style={styles.channelChips}>
          {item.channels.map((ch) => (
            <View key={ch} style={styles.channelChip}>
              <Text style={styles.channelChipText}>{getChannelLabel(ch)}</Text>
            </View>
          ))}
        </View>
      </View>
      {item.digestMode && <Text style={styles.digestText}>Digest: {item.digestTime} AEST</Text>}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const { data: events = [], isLoading: eventsLoading } = useAlertEvents();
  const { data: subscriptions = [], isLoading: subsLoading } = useAlertSubscriptions();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* ── Section 1: Recent Alerts ── */}
      <Text style={styles.sectionTitle}>Recent Alerts</Text>

      {eventsLoading && events.length === 0 ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>
          No alerts yet. New property matches above your threshold will appear here.
        </Text>
      ) : (
        <FlatList<PropertyAlertEvent>
          data={events}
          keyExtractor={(item: PropertyAlertEvent) => item.id}
          renderItem={({ item }: { item: PropertyAlertEvent }) => <AlertEventCard item={item} />}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* ── Section 2: Alert Subscriptions ── */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Alert Subscriptions</Text>

      {subsLoading && subscriptions.length === 0 ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : subscriptions.length === 0 ? (
        <Text style={styles.emptyText}>
          No alert subscriptions. Set up alerts for a client brief to get notified of new matches.
        </Text>
      ) : (
        <FlatList<PropertyAlertSubscription>
          data={subscriptions}
          keyExtractor={(item: PropertyAlertSubscription) => item.id}
          renderItem={({ item }: { item: PropertyAlertSubscription }) => (
            <SubscriptionCard item={item} />
          )}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Bottom padding so last card clears the tab bar */}
      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { padding: 16 },

  // Section headings
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionTitleSpaced: { marginTop: 24 },

  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },

  separator: { height: 8 },
  bottomPad: { height: 24 },

  // ── Shared card shell ──────────────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    gap: 8,
  },

  // ── Alert event card ───────────────────────────────────────────────────────
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: 'center',
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  alertTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  timeAgo: {
    fontSize: 11,
    color: '#9ca3af',
  },
  matchId: {
    fontSize: 11,
    color: '#9ca3af',
  },

  // ── Action buttons ─────────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  actionBtnPrimary: {
    backgroundColor: '#2563eb',
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionBtnSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },

  // ── Actioned state ─────────────────────────────────────────────────────────
  actionedRow: {
    marginTop: 4,
  },
  actionedText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '500',
  },

  // ── Subscription card ──────────────────────────────────────────────────────
  subscriptionBriefId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  subscriptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  subscriptionThreshold: {
    fontSize: 12,
    color: '#374151',
  },
  channelChips: {
    flexDirection: 'row',
    gap: 4,
  },
  channelChip: {
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  channelChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  digestText: {
    fontSize: 12,
    color: '#6b7280',
  },

  // ── Skeleton ───────────────────────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  skeletonBlock: {
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  skeletonBadge: {
    width: 36,
    height: 24,
  },
  skeletonContent: {
    flex: 1,
    gap: 6,
  },
  skeletonTitle: {
    height: 14,
    width: '60%',
  },
  skeletonSubtitle: {
    height: 12,
    width: '80%',
  },
  skeletonTime: {
    height: 11,
    width: '30%',
  },
});
