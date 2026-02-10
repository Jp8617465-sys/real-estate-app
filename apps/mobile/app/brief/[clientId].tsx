import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { PurchaseType, Urgency, UpdateFrequency, BriefContactMethod } from '@realflow/shared';

interface MockBrief {
  clientName: string;
  purchaseType: PurchaseType;

  // Budget
  budgetMin: number;
  budgetMax: number;
  absoluteMax: number;
  stampDutyBudgeted: boolean;

  // Finance
  preApproved: boolean;
  preApprovalAmount: number;
  preApprovalExpiry: string;
  lender: string;
  brokerName: string;
  brokerPhone: string;
  depositAvailable: number;
  firstHomeBuyer: boolean;

  // Requirements
  propertyTypes: string[];
  bedsMin: number;
  bedsIdeal: number;
  bathsMin: number;
  carsMin: number;
  suburbs: string[];
  mustHaves: string[];
  niceToHaves: string[];
  dealBreakers: string[];

  // Timeline
  urgency: Urgency;
  idealSettlement: string;

  // Communication
  preferredMethod: BriefContactMethod;
  updateFrequency: UpdateFrequency;
  bestTimeToCall: string;
  partnerName: string;
  partnerPhone: string;

  // Solicitor
  solicitorFirm: string;
  solicitorContact: string;
  solicitorPhone: string;
  solicitorEmail: string;
}

const mockBrief: MockBrief = {
  clientName: 'Michael Johnson',
  purchaseType: 'owner_occupier',

  budgetMin: 800000,
  budgetMax: 1200000,
  absoluteMax: 1300000,
  stampDutyBudgeted: true,

  preApproved: true,
  preApprovalAmount: 1100000,
  preApprovalExpiry: '2026-05-15',
  lender: 'CBA',
  brokerName: 'Andrew Miles',
  brokerPhone: '0412 345 678',
  depositAvailable: 240000,
  firstHomeBuyer: false,

  propertyTypes: ['House', 'Apartment'],
  bedsMin: 3,
  bedsIdeal: 4,
  bathsMin: 2,
  carsMin: 1,
  suburbs: ['Bondi', 'Coogee', 'Randwick', 'Bronte'],
  mustHaves: ['Natural light', 'Outdoor space', 'Close to beach'],
  niceToHaves: ['Ocean views', 'Updated kitchen', 'Off-street parking'],
  dealBreakers: ['Main road', 'No natural light', 'Flood zone'],

  urgency: '1_3_months',
  idealSettlement: '60 days',

  preferredMethod: 'phone',
  updateFrequency: 'twice_weekly',
  bestTimeToCall: 'After 5pm weekdays',
  partnerName: 'Sarah Johnson',
  partnerPhone: '0413 222 333',

  solicitorFirm: 'Henderson & Co Solicitors',
  solicitorContact: 'Kate Henderson',
  solicitorPhone: '02 9876 5432',
  solicitorEmail: 'kate@hendersonco.com.au',
};

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

  // TODO: Fetch from API using clientId
  const brief = mockBrief;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Client Header */}
      <View style={styles.header}>
        <Text style={styles.clientName}>{brief.clientName}</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{getPurchaseTypeLabel(brief.purchaseType)}</Text>
        </View>
      </View>

      {/* Budget Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budget</Text>
        <InfoRow label="Range" value={`${formatCurrency(brief.budgetMin)} - ${formatCurrency(brief.budgetMax)}`} />
        <InfoRow label="Absolute Max" value={formatCurrency(brief.absoluteMax)} />
        <InfoRow label="Stamp Duty Budgeted" value={brief.stampDutyBudgeted ? 'Yes' : 'No'} />

        <View style={styles.divider} />
        <Text style={styles.subTitle}>Finance</Text>
        <InfoRow label="Pre-Approved" value={brief.preApproved ? 'Yes' : 'No'} />
        <InfoRow label="Pre-Approval" value={formatCurrency(brief.preApprovalAmount)} />
        <InfoRow label="Expiry" value={new Date(brief.preApprovalExpiry).toLocaleDateString('en-AU')} />
        <InfoRow label="Lender" value={brief.lender} />
        <InfoRow label="Broker" value={`${brief.brokerName} (${brief.brokerPhone})`} />
        <InfoRow label="Deposit Available" value={formatCurrency(brief.depositAvailable)} />
        <InfoRow label="First Home Buyer" value={brief.firstHomeBuyer ? 'Yes' : 'No'} />
      </View>

      {/* Requirements Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Requirements</Text>
        <InfoRow label="Property Types" value={brief.propertyTypes.join(', ')} />
        <InfoRow label="Bedrooms" value={`${brief.bedsMin}+ (ideal: ${brief.bedsIdeal})`} />
        <InfoRow label="Bathrooms" value={`${brief.bathsMin}+`} />
        <InfoRow label="Cars" value={`${brief.carsMin}+`} />

        <View style={styles.divider} />
        <Text style={styles.subTitle}>Preferred Suburbs</Text>
        <TagList items={brief.suburbs} color="#2563eb" />

        <View style={styles.divider} />
        <Text style={styles.subTitle}>Must-Haves</Text>
        <TagList items={brief.mustHaves} color="#16a34a" />

        <View style={styles.divider} />
        <Text style={styles.subTitle}>Nice-to-Haves</Text>
        <TagList items={brief.niceToHaves} color="#ca8a04" />

        <View style={styles.divider} />
        <Text style={styles.subTitle}>Deal Breakers</Text>
        <TagList items={brief.dealBreakers} color="#dc2626" />
      </View>

      {/* Timeline Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Timeline</Text>
        <InfoRow label="Urgency" value={getUrgencyLabel(brief.urgency)} />
        <InfoRow label="Ideal Settlement" value={brief.idealSettlement} />
      </View>

      {/* Communication Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Communication</Text>
        <InfoRow label="Preferred" value={brief.preferredMethod.charAt(0).toUpperCase() + brief.preferredMethod.slice(1)} />
        <InfoRow label="Update Frequency" value={getFrequencyLabel(brief.updateFrequency)} />
        <InfoRow label="Best Time to Call" value={brief.bestTimeToCall} />
        {brief.partnerName ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.subTitle}>Partner / Spouse</Text>
            <InfoRow label="Name" value={brief.partnerName} />
            <InfoRow label="Phone" value={brief.partnerPhone} />
          </>
        ) : null}
      </View>

      {/* Solicitor Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Solicitor</Text>
        <InfoRow label="Firm" value={brief.solicitorFirm} />
        <InfoRow label="Contact" value={brief.solicitorContact} />
        <InfoRow label="Phone" value={brief.solicitorPhone} />
        <InfoRow label="Email" value={brief.solicitorEmail} />
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },

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
