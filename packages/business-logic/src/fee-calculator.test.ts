import { describe, it, expect } from 'vitest';
import { FeeCalculator } from './fee-calculator';

// ─── calculateSuccessFee ─────────────────────────────────────────

describe('FeeCalculator.calculateSuccessFee', () => {
  it('flat fee: returns exact amount regardless of price', () => {
    expect(FeeCalculator.calculateSuccessFee(500000, 'flat', { flatAmount: 15000 })).toBe(15000);
    expect(FeeCalculator.calculateSuccessFee(2000000, 'flat', { flatAmount: 15000 })).toBe(15000);
  });

  it('percentage: 2% of $1,000,000 = $20,000', () => {
    expect(FeeCalculator.calculateSuccessFee(1000000, 'percentage', { percentage: 2 })).toBe(20000);
  });

  it('tiered: $800k falls into tier 1, $1.2M falls into tier 2', () => {
    const tiers = [
      { upTo: 1000000, fee: 15000 },
      { upTo: 1500000, fee: 20000 },
      { upTo: 2000000, fee: 25000 },
    ];
    expect(FeeCalculator.calculateSuccessFee(800000, 'tiered', { tiers })).toBe(15000);
    expect(FeeCalculator.calculateSuccessFee(1200000, 'tiered', { tiers })).toBe(20000);
  });

  it('tiered: price exceeds all tiers uses last tier fee', () => {
    const tiers = [
      { upTo: 1000000, fee: 15000 },
      { upTo: 1500000, fee: 20000 },
    ];
    expect(FeeCalculator.calculateSuccessFee(3000000, 'tiered', { tiers })).toBe(20000);
  });

  it('tiered: empty tiers returns 0', () => {
    expect(FeeCalculator.calculateSuccessFee(800000, 'tiered', { tiers: [] })).toBe(0);
  });
});

// ─── calculateGst ────────────────────────────────────────────────

describe('FeeCalculator.calculateGst', () => {
  it('GST included: $110 → GST is $10', () => {
    expect(FeeCalculator.calculateGst(110, true)).toBe(10);
  });

  it('GST exclusive: $100 → GST is $10', () => {
    expect(FeeCalculator.calculateGst(100, false)).toBe(10);
  });

  it('$0 → $0 for both modes', () => {
    expect(FeeCalculator.calculateGst(0, true)).toBe(0);
    expect(FeeCalculator.calculateGst(0, false)).toBe(0);
  });
});

// ─── calculateTotalFees ──────────────────────────────────────────

describe('FeeCalculator.calculateTotalFees', () => {
  it('retainer $3,000 + 2% success fee on $1M, GST inclusive', () => {
    const result = FeeCalculator.calculateTotalFees(1000000, {
      retainerFee: 3000,
      successFeeType: 'percentage',
      successFeePercentage: 2,
      gstIncluded: true,
    });
    // successFee = 20000, totalFee = 23000
    // GST included: 23000 / 11 = 2091 (rounded)
    // totalWithGst = 23000 (already includes GST)
    expect(result.retainerFee).toBe(3000);
    expect(result.successFee).toBe(20000);
    expect(result.totalFee).toBe(23000);
    expect(result.gstAmount).toBe(2091);
    expect(result.totalWithGst).toBe(23000);
  });

  it('retainer $5,000 + flat $15,000, GST exclusive (adds 10%)', () => {
    const result = FeeCalculator.calculateTotalFees(1000000, {
      retainerFee: 5000,
      successFeeType: 'flat',
      successFeeFlatAmount: 15000,
      gstIncluded: false,
    });
    // successFee = 15000, totalFee = 20000
    // GST exclusive: 20000 * 0.1 = 2000
    // totalWithGst = 20000 + 2000 = 22000
    expect(result.retainerFee).toBe(5000);
    expect(result.successFee).toBe(15000);
    expect(result.totalFee).toBe(20000);
    expect(result.gstAmount).toBe(2000);
    expect(result.totalWithGst).toBe(22000);
  });
});

// ─── calculatePipelineValue ──────────────────────────────────────

describe('FeeCalculator.calculatePipelineValue', () => {
  it('sums success fees for multiple clients', () => {
    const clients = [
      { estimatedPurchasePrice: 1000000, feeType: 'percentage' as const, percentage: 2 },
      { estimatedPurchasePrice: 800000, feeType: 'flat' as const, flatAmount: 15000 },
      { estimatedPurchasePrice: 1500000, feeType: 'percentage' as const, percentage: 1.5 },
    ];
    // 20000 + 15000 + 22500 = 57500
    expect(FeeCalculator.calculatePipelineValue(clients)).toBe(57500);
  });
});

// ─── estimateStampDuty ───────────────────────────────────────────

describe('FeeCalculator.estimateStampDuty', () => {
  it('QLD first home buyer under $500k = 0', () => {
    expect(FeeCalculator.estimateStampDuty(450000, 'QLD', true)).toBe(0);
  });

  it('QLD $800k = correct bracket', () => {
    // 17325 + (800000 - 540000) * 0.045 = 17325 + 11700 = 29025
    expect(FeeCalculator.estimateStampDuty(800000, 'QLD')).toBe(29025);
  });

  it('NSW first home buyer under $800k = 0', () => {
    expect(FeeCalculator.estimateStampDuty(750000, 'NSW', true)).toBe(0);
  });

  it('VIC $500k = correct bracket', () => {
    // 2870 + (500000 - 130000) * 0.06 = 2870 + 22200 = 25070
    expect(FeeCalculator.estimateStampDuty(500000, 'VIC')).toBe(25070);
  });

  it('unknown state = 4% estimate', () => {
    expect(FeeCalculator.estimateStampDuty(1000000, 'XX')).toBe(40000);
  });
});
