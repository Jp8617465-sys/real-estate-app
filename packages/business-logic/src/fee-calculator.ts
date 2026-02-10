import type { FeeStructure } from '@realflow/shared';

export interface FeeCalculation {
  retainerFee: number;
  successFee: number;
  totalFee: number;
  gstAmount: number;
  totalWithGst: number;
}

export class FeeCalculator {
  /**
   * Calculate the success fee based on purchase price and fee structure.
   */
  static calculateSuccessFee(
    purchasePrice: number,
    feeType: 'flat' | 'percentage' | 'tiered',
    options: {
      flatAmount?: number;
      percentage?: number;
      tiers?: Array<{ upTo: number; fee: number }>;
    }
  ): number {
    switch (feeType) {
      case 'flat':
        return options.flatAmount ?? 0;

      case 'percentage':
        return Math.round((purchasePrice * (options.percentage ?? 0)) / 100);

      case 'tiered': {
        if (!options.tiers || options.tiers.length === 0) return 0;
        // Tiers define: "if purchase price up to X, fee is Y"
        // Sort tiers by upTo ascending
        const sorted = [...options.tiers].sort((a, b) => a.upTo - b.upTo);
        for (const tier of sorted) {
          if (purchasePrice <= tier.upTo) {
            return tier.fee;
          }
        }
        // If price exceeds all tiers, use the last tier's fee
        return sorted[sorted.length - 1]?.fee ?? 0;
      }
    }
  }

  /**
   * Calculate GST amount (10% in Australia).
   */
  static calculateGst(amount: number, gstIncluded: boolean): number {
    if (gstIncluded) {
      // Amount already includes GST, extract it
      return Math.round(amount / 11);
    }
    // Amount is GST-exclusive, calculate GST to add
    return Math.round(amount * 0.1);
  }

  /**
   * Calculate total fees for a complete engagement.
   */
  static calculateTotalFees(
    purchasePrice: number,
    feeStructure: {
      retainerFee: number;
      successFeeType: 'flat' | 'percentage' | 'tiered';
      successFeeFlatAmount?: number;
      successFeePercentage?: number;
      successFeeTiers?: Array<{ upTo: number; fee: number }>;
      gstIncluded: boolean;
    }
  ): FeeCalculation {
    const successFee = this.calculateSuccessFee(
      purchasePrice,
      feeStructure.successFeeType,
      {
        flatAmount: feeStructure.successFeeFlatAmount,
        percentage: feeStructure.successFeePercentage,
        tiers: feeStructure.successFeeTiers,
      }
    );

    const totalFee = feeStructure.retainerFee + successFee;
    const gstAmount = this.calculateGst(totalFee, feeStructure.gstIncluded);
    const totalWithGst = feeStructure.gstIncluded ? totalFee : totalFee + gstAmount;

    return {
      retainerFee: feeStructure.retainerFee,
      successFee,
      totalFee,
      gstAmount,
      totalWithGst,
    };
  }

  /**
   * Calculate pipeline value (sum of estimated success fees for active clients).
   */
  static calculatePipelineValue(
    activeClients: Array<{
      estimatedPurchasePrice: number;
      feeType: 'flat' | 'percentage' | 'tiered';
      flatAmount?: number;
      percentage?: number;
      tiers?: Array<{ upTo: number; fee: number }>;
    }>
  ): number {
    return activeClients.reduce((total, client) => {
      return total + this.calculateSuccessFee(
        client.estimatedPurchasePrice,
        client.feeType,
        {
          flatAmount: client.flatAmount,
          percentage: client.percentage,
          tiers: client.tiers,
        }
      );
    }, 0);
  }

  /**
   * Calculate stamp duty for a given state and purchase price.
   * Simplified calculation — actual stamp duty has many conditions.
   */
  static estimateStampDuty(
    purchasePrice: number,
    state: string,
    firstHomeBuyer: boolean = false
  ): number {
    // Simplified QLD stamp duty brackets (2024)
    if (state === 'QLD') {
      if (firstHomeBuyer && purchasePrice <= 500000) return 0;
      if (firstHomeBuyer && purchasePrice <= 550000) {
        return Math.round((purchasePrice - 500000) * 0.0375);
      }
      if (purchasePrice <= 5000) return 0;
      if (purchasePrice <= 75000) return Math.round(purchasePrice * 0.015);
      if (purchasePrice <= 540000) return Math.round(1050 + (purchasePrice - 75000) * 0.035);
      if (purchasePrice <= 1000000) return Math.round(17325 + (purchasePrice - 540000) * 0.045);
      return Math.round(38025 + (purchasePrice - 1000000) * 0.0575);
    }

    // Simplified NSW stamp duty brackets
    if (state === 'NSW') {
      if (firstHomeBuyer && purchasePrice <= 800000) return 0;
      if (purchasePrice <= 16000) return Math.round(purchasePrice * 0.0125);
      if (purchasePrice <= 35000) return Math.round(200 + (purchasePrice - 16000) * 0.015);
      if (purchasePrice <= 93000) return Math.round(485 + (purchasePrice - 35000) * 0.0175);
      if (purchasePrice <= 351000) return Math.round(1500 + (purchasePrice - 93000) * 0.035);
      if (purchasePrice <= 1168000) return Math.round(10530 + (purchasePrice - 351000) * 0.045);
      return Math.round(47295 + (purchasePrice - 1168000) * 0.055);
    }

    // Simplified VIC stamp duty brackets
    if (state === 'VIC') {
      if (firstHomeBuyer && purchasePrice <= 600000) return 0;
      if (purchasePrice <= 25000) return Math.round(purchasePrice * 0.014);
      if (purchasePrice <= 130000) return Math.round(350 + (purchasePrice - 25000) * 0.024);
      if (purchasePrice <= 960000) return Math.round(2870 + (purchasePrice - 130000) * 0.06);
      return Math.round(purchasePrice * 0.055);
    }

    // Default: 4% rough estimate for other states
    return Math.round(purchasePrice * 0.04);
  }
}
