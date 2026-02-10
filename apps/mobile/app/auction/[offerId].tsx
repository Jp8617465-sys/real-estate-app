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
import { useLocalSearchParams } from 'expo-router';
import type { AuctionResult } from '@realflow/shared';

interface BidEntry {
  id: string;
  amount: number;
  isOurBid: boolean;
  timestamp: string;
}

interface MockAuctionData {
  offerId: string;
  address: string;
  clientName: string;
  clientMaxPrice: number;
  walkAwayPrice: number;
  biddingStrategy: string;
  registrationNumber: string;
}

const mockAuction: MockAuctionData = {
  offerId: 'o1',
  address: '42 Ocean St, Bondi NSW 2026',
  clientName: 'Michael Johnson',
  clientMaxPrice: 1200000,
  walkAwayPrice: 1100000,
  biddingStrategy:
    'Start with $1M opening bid. Bid in $25K increments up to $1.1M, then slow to $10K. Never exceed $1.2M. Be confident, bid quickly.',
  registrationNumber: 'Bidder #7',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AuctionDayScreen() {
  const { offerId } = useLocalSearchParams<{ offerId: string }>();

  // TODO: Fetch from API using offerId
  const auction = mockAuction;

  const [bids, setBids] = useState<BidEntry[]>([]);
  const [newBidAmount, setNewBidAmount] = useState('');
  const [showBidInput, setShowBidInput] = useState(false);
  const [numberOfBidders, setNumberOfBidders] = useState('');
  const [result, setResult] = useState<AuctionResult | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const lastBid = bids.length > 0 ? bids[bids.length - 1] : null;
  const isNearMax = lastBid !== null && lastBid.amount >= auction.walkAwayPrice;
  const isOverMax = lastBid !== null && lastBid.amount >= auction.clientMaxPrice;

  function addBid(isOurs: boolean) {
    const amount = parseInt(newBidAmount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid bid amount.');
      return;
    }

    if (isOurs && amount > auction.clientMaxPrice) {
      Alert.alert(
        'Over Client Max',
        `This bid exceeds the client maximum of ${formatCurrency(auction.clientMaxPrice)}. Are you sure?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Bid Anyway',
            style: 'destructive',
            onPress: () => {
              confirmBid(amount, isOurs);
            },
          },
        ]
      );
      return;
    }

    confirmBid(amount, isOurs);
  }

  function confirmBid(amount: number, isOurs: boolean) {
    const bid: BidEntry = {
      id: `bid-${Date.now()}`,
      amount,
      isOurBid: isOurs,
      timestamp: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setBids((prev) => [...prev, bid]);
    setNewBidAmount('');
    setShowBidInput(false);
  }

  function handleResult(selectedResult: AuctionResult) {
    const labels: Record<AuctionResult, string> = {
      won: 'Won',
      passed_in: 'Passed In',
      outbid: 'Outbid',
    };
    Alert.alert(
      `Mark as ${labels[selectedResult]}?`,
      'This will record the auction result.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => setResult(selectedResult) },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Property Address */}
      <View style={styles.headerCard}>
        <Text style={styles.headerAddress}>{auction.address}</Text>
        <Text style={styles.headerClient}>{auction.clientName}</Text>
        <Text style={styles.headerRego}>{auction.registrationNumber}</Text>
      </View>

      {/* Price Limits -- Most Prominent */}
      <View style={styles.limitsRow}>
        <View style={[styles.limitCard, styles.limitCardMax]}>
          <Text style={styles.limitLabel}>CLIENT MAX</Text>
          <Text style={styles.limitAmount}>{formatCurrency(auction.clientMaxPrice)}</Text>
        </View>
        <View style={[styles.limitCard, styles.limitCardWalk]}>
          <Text style={styles.limitLabel}>WALK-AWAY</Text>
          <Text style={styles.limitAmountWalk}>{formatCurrency(auction.walkAwayPrice)}</Text>
        </View>
      </View>

      {/* Warning Banner */}
      {isOverMax && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>BIDDING HAS EXCEEDED CLIENT MAXIMUM</Text>
        </View>
      )}
      {isNearMax && !isOverMax && (
        <View style={styles.cautionBanner}>
          <Text style={styles.cautionText}>APPROACHING WALK-AWAY PRICE</Text>
        </View>
      )}

      {/* Strategy Notes */}
      <View style={styles.strategyCard}>
        <Text style={styles.strategyTitle}>Bidding Strategy</Text>
        <Text style={styles.strategyText}>{auction.biddingStrategy}</Text>
      </View>

      {/* Bid Log */}
      <View style={styles.card}>
        <View style={styles.bidLogHeader}>
          <Text style={styles.cardTitle}>Bid Log</Text>
          <Text style={styles.bidCount}>{bids.length} bids</Text>
        </View>

        {bids.length === 0 && (
          <Text style={styles.emptyText}>No bids recorded yet</Text>
        )}

        {bids.map((bid) => (
          <View
            key={bid.id}
            style={[
              styles.bidRow,
              bid.isOurBid && styles.bidRowOurs,
              bid.amount >= auction.clientMaxPrice && styles.bidRowDanger,
            ]}
          >
            <View style={styles.bidInfo}>
              <Text style={[styles.bidAmount, bid.isOurBid && styles.bidAmountOurs]}>
                {formatCurrency(bid.amount)}
              </Text>
              <Text style={styles.bidMeta}>
                {bid.isOurBid ? 'Our Bid' : 'Other'} {'\u00B7'} {bid.timestamp}
              </Text>
            </View>
            {bid.isOurBid && (
              <View style={styles.ourBidIndicator}>
                <Text style={styles.ourBidText}>US</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Add Bid */}
      {!result && (
        <>
          {showBidInput ? (
            <View style={styles.bidInputCard}>
              <Text style={styles.bidInputLabel}>Bid Amount ($)</Text>
              <TextInput
                style={styles.bidInputField}
                placeholder="e.g. 1050000"
                placeholderTextColor="#9ca3af"
                value={newBidAmount}
                onChangeText={setNewBidAmount}
                keyboardType="numeric"
                autoFocus
              />
              <View style={styles.bidInputActions}>
                <TouchableOpacity
                  style={styles.bidButtonOurs}
                  onPress={() => addBid(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bidButtonText}>Our Bid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bidButtonOther}
                  onPress={() => addBid(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bidButtonOtherText}>Other Bid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bidButtonCancel}
                  onPress={() => {
                    setShowBidInput(false);
                    setNewBidAmount('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bidButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addBidButton}
              onPress={() => setShowBidInput(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addBidButtonText}>+ Add Bid</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Number of Bidders */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Number of Bidders</Text>
        <TextInput
          style={styles.biddersInput}
          placeholder="e.g. 5"
          placeholderTextColor="#9ca3af"
          value={numberOfBidders}
          onChangeText={setNumberOfBidders}
          keyboardType="numeric"
        />
      </View>

      {/* Result Buttons */}
      {!result ? (
        <View style={styles.resultSection}>
          <Text style={styles.resultSectionTitle}>Auction Result</Text>
          <View style={styles.resultButtonsRow}>
            <TouchableOpacity
              style={styles.resultWon}
              onPress={() => handleResult('won')}
              activeOpacity={0.8}
            >
              <Text style={styles.resultWonText}>Won</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resultPassedIn}
              onPress={() => handleResult('passed_in')}
              activeOpacity={0.8}
            >
              <Text style={styles.resultPassedInText}>Passed In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resultOutbid}
              onPress={() => handleResult('outbid')}
              activeOpacity={0.8}
            >
              <Text style={styles.resultOutbidText}>Outbid</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.resultDisplay}>
          <Text style={styles.resultDisplayLabel}>RESULT</Text>
          <Text
            style={[
              styles.resultDisplayValue,
              result === 'won' && { color: '#16a34a' },
              result === 'passed_in' && { color: '#ca8a04' },
              result === 'outbid' && { color: '#dc2626' },
            ]}
          >
            {result === 'won' ? 'WON' : result === 'passed_in' ? 'PASSED IN' : 'OUTBID'}
          </Text>
          {lastBid && (
            <Text style={styles.resultFinalPrice}>
              Final: {formatCurrency(lastBid.amount)}
            </Text>
          )}
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16 },

  // Header
  headerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  headerAddress: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  headerClient: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  headerRego: { fontSize: 14, fontWeight: '600', color: '#60a5fa', marginTop: 4 },

  // Limits
  limitsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  limitCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  limitCardMax: { backgroundColor: '#dc2626' },
  limitCardWalk: { backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#ca8a04' },
  limitLabel: { fontSize: 11, fontWeight: '700', color: '#fff', opacity: 0.8, letterSpacing: 1 },
  limitAmount: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 4 },
  limitAmountWalk: { fontSize: 24, fontWeight: '800', color: '#ca8a04', marginTop: 4 },

  // Warning banners
  warningBanner: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  warningText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  cautionBanner: {
    backgroundColor: '#854d0e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  cautionText: { fontSize: 14, fontWeight: '800', color: '#fef08a', letterSpacing: 0.5 },

  // Strategy
  strategyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  strategyTitle: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  strategyText: { fontSize: 15, color: '#e2e8f0', lineHeight: 22 },

  // Bid Log
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  bidLogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bidCount: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#475569', fontSize: 13, padding: 16 },

  bidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#334155',
    minHeight: 48,
  },
  bidRowOurs: { borderLeftColor: '#2563eb', backgroundColor: '#172554' },
  bidRowDanger: { borderLeftColor: '#dc2626' },
  bidInfo: { flex: 1 },
  bidAmount: { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
  bidAmountOurs: { color: '#60a5fa' },
  bidMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  ourBidIndicator: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ourBidText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // Bid Input
  bidInputCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  bidInputLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  bidInputField: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 56,
    marginBottom: 12,
  },
  bidInputActions: { flexDirection: 'row', gap: 8 },
  bidButtonOurs: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  bidButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  bidButtonOther: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  bidButtonOtherText: { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  bidButtonCancel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bidButtonCancelText: { fontSize: 14, fontWeight: '600', color: '#64748b' },

  // Add Bid
  addBidButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 56,
    justifyContent: 'center',
  },
  addBidButtonText: { fontSize: 18, fontWeight: '800', color: '#fff' },

  // Bidders count
  biddersInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 48,
  },

  // Result section
  resultSection: { marginTop: 8, marginBottom: 12 },
  resultSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  resultButtonsRow: { flexDirection: 'row', gap: 10 },
  resultWon: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  resultWonText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  resultPassedIn: {
    flex: 1,
    backgroundColor: '#854d0e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  resultPassedInText: { fontSize: 16, fontWeight: '800', color: '#fef08a' },
  resultOutbid: {
    flex: 1,
    backgroundColor: '#991b1b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  resultOutbidText: { fontSize: 16, fontWeight: '800', color: '#fecaca' },

  // Result display
  resultDisplay: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#334155',
  },
  resultDisplayLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 1 },
  resultDisplayValue: { fontSize: 36, fontWeight: '900', marginVertical: 8 },
  resultFinalPrice: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },

  bottomSpacer: { height: 40 },
});
