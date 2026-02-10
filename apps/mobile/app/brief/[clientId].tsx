import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useClientBrief } from '../../src/hooks/use-client-briefs';
import type { PurchaseType, Urgency, UpdateFrequency } from '@realflow/shared';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getUrgencyLabel(urgency: Urgency): string {
  const labels: Record<Urgency, string> = {
    'asap': 'ASAP',
    '1_3_months': '1-3 months',
    '3_6_months': '3-6 months',
    '6_12_months': '6-12 months',
    'no_rush': 'No rush',
  };
  return labels[urgency];
}

function getFrequencyLabel(freq: UpdateFrequency): string {
  const labels: Record<UpdateFrequency, string> = {
    'daily': 'Daily',
    'twice_weekly': 'Twice weekly',
    'weekly': 'Weekly',
  };
  return labels[freq];
}

function getPurchaseTypeLabel(type: PurchaseType): string {
  const labels: Record<PurchaseType, string> = {
    'owner_occupier': 'Owner Occupier',
    'investor': 'Investor',
    'development': 'Development',
    'smsf': 'SMSF',
  };
  return labels[type];
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function TagList({ items, color }: { items: string[]; color: string }) {
  return (
    <View style={styles.tagList}>
      {items.map((item, i) => (
        <View key={i} style={[styles.tag, { backgroundColor: color + '15' }]}>
          <Text style={[styles.tagText, { color }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ClientBriefScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { data: brief, isLoading, error } = useClientBrief(clientId ?? '');

  if (isLoading || !brief) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load client brief</Text>
      </View>
    );
  }

  const suburbNames = brief.requirements.suburbs.map((s) => s.suburb);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Client Header */}
      <View style={styles.header}>
        <Text style={styles.clientName}>Client Brief</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{getPurchaseTypeLabel(brief.purchaseType)}</Text>
        </View>
      </View>

      {/* Budget Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budget</Text>
        <InfoRow label="Range" value={`${formatCurrency(brief.budget.min)} - ${formatCurrency(brief.budget.max)}`} />
        {brief.budget.absoluteMax && (
          <InfoRow label="Absolute Max" value={formatCurrency(brief.budget.absoluteMax)} />
        )}
        <InfoRow label="Stamp Duty Budgeted" value={brief.budget.stampDutyBudgeted ? 'Yes' : 'No'} />

        <View style={styles.divider} />
        <Text style={styles.subTitle}>Finance</Text>
        <InfoRow label="Pre-Approved" value={brief.finance.preApproved ? 'Yes' : 'No'} />
        {brief.finance.preApprovalAmount && (
          <InfoRow label="Pre-Approval" value={formatCurrency(brief.finance.preApprovalAmount)} />
        )}
        {brief.finance.preApprovalExpiry && (
          <InfoRow label="Expiry" value={new Date(brief.finance.preApprovalExpiry).toLocaleDateString('en-AU')} />
        )}
        {brief.finance.lender && <InfoRow label="Lender" value={brief.finance.lender} />}
        {brief.finance.brokerName && (
          <InfoRow label="Broker" value={`${brief.finance.brokerName}${brief.finance.brokerPhone ? ` (${brief.finance.brokerPhone})` : ''}`} />
        )}
        {brief.finance.depositAvailable !== undefined && (
          <InfoRow label="Deposit Available" value={formatCurrency(brief.finance.depositAvailable)} />
        )}
        <InfoRow label="First Home Buyer" value={brief.finance.firstHomeBuyer ? 'Yes' : 'No'} />
      </View>

      {/* Requirements Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Requirements</Text>
        <InfoRow label="Property Types" value={brief.requirements.propertyTypes.join(', ')} />
        <InfoRow label="Bedrooms" value={`${brief.requirements.bedrooms.min}+${brief.requirements.bedrooms.ideal ? ` (ideal: ${brief.requirements.bedrooms.ideal})` : ''}`} />
        <InfoRow label="Bathrooms" value={`${brief.requirements.bathrooms.min}+`} />
        <InfoRow label="Cars" value={`${brief.requirements.carSpaces.min}+`} />

        {suburbNames.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.subTitle}>Preferred Suburbs</Text>
            <TagList items={suburbNames} color="#2563eb" />
          </>
        )}

        {brief.requirements.mustHaves.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.subTitle}>Must-Haves</Text>
            <TagList items={brief.requirements.mustHaves} color="#16a34a" />
          </>
        )}

        {brief.requirements.niceToHaves.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.subTitle}>Nice-to-Haves</Text>
            <TagList items={brief.requirements.niceToHaves} color="#ca8a04" />
          </>
        )}

        {brief.requirements.dealBreakers.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.subTitle}>Deal Breakers</Text>
            <TagList items={brief.requirements.dealBreakers} color="#dc2626" />
          </>
        )}
      </View>

      {/* Timeline Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Timeline</Text>
        <InfoRow label="Urgency" value={getUrgencyLabel(brief.timeline.urgency)} />
        {brief.timeline.idealSettlement && (
          <InfoRow label="Ideal Settlement" value={brief.timeline.idealSettlement} />
        )}
      </View>

      {/* Communication Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Communication</Text>
        {brief.communication.preferredMethod && (
          <InfoRow label="Preferred" value={brief.communication.preferredMethod.charAt(0).toUpperCase() + brief.communication.preferredMethod.slice(1)} />
        )}
        {brief.communication.updateFrequency && (
          <InfoRow label="Update Frequency" value={getFrequencyLabel(brief.communication.updateFrequency)} />
        )}
        {brief.communication.bestTimeToCall && (
          <InfoRow label="Best Time to Call" value={brief.communication.bestTimeToCall} />
        )}
        {brief.communication.partnerName ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.subTitle}>Partner / Spouse</Text>
            <InfoRow label="Name" value={brief.communication.partnerName} />
            {brief.communication.partnerPhone && (
              <InfoRow label="Phone" value={brief.communication.partnerPhone} />
            )}
          </>
        ) : null}
      </View>

      {/* Solicitor Section */}
      {brief.solicitor && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Solicitor</Text>
          <InfoRow label="Firm" value={brief.solicitor.firmName} />
          <InfoRow label="Contact" value={brief.solicitor.contactName} />
          <InfoRow label="Phone" value={brief.solicitor.phone} />
          <InfoRow label="Email" value={brief.solicitor.email} />
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  errorText: { fontSize: 16, color: '#dc2626' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  clientName: { fontSize: 22, fontWeight: '700', color: '#111827' },
  typeBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },

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
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  infoLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 1, textAlign: 'right' },

  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },

  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontSize: 12, fontWeight: '600' },

  bottomSpacer: { height: 40 },
});
