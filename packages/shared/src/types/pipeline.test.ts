import { describe, it, expect } from 'vitest';
import {
  PipelineTypeSchema,
  BuyerStageSchema,
  SellerStageSchema,
  BUYER_STAGE_ORDER,
  SELLER_STAGE_ORDER,
  BUYER_STAGE_LABELS,
  SELLER_STAGE_LABELS,
  TransactionSchema,
  StageTransitionSchema,
  CreateTransactionSchema,
} from './pipeline';

const uuid = () => '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();

// ─── PipelineTypeSchema ────────────────────────────────────────────

describe('PipelineTypeSchema', () => {
  it('accepts buying and selling', () => {
    expect(PipelineTypeSchema.parse('buying')).toBe('buying');
    expect(PipelineTypeSchema.parse('selling')).toBe('selling');
  });

  it('rejects invalid types', () => {
    expect(() => PipelineTypeSchema.parse('renting')).toThrow();
  });
});

// ─── BuyerStageSchema ──────────────────────────────────────────────

describe('BuyerStageSchema', () => {
  const buyerStages = [
    'new-enquiry', 'qualified-lead', 'active-search',
    'property-shortlisted', 'due-diligence', 'offer-made',
    'under-contract', 'settled',
  ];

  it('accepts all buyer stages', () => {
    for (const stage of buyerStages) {
      expect(BuyerStageSchema.parse(stage)).toBe(stage);
    }
  });

  it('rejects invalid stage', () => {
    expect(() => BuyerStageSchema.parse('negotiation')).toThrow();
  });
});

// ─── SellerStageSchema ─────────────────────────────────────────────

describe('SellerStageSchema', () => {
  const sellerStages = [
    'appraisal-request', 'listing-preparation', 'on-market',
    'offers-negotiation', 'under-contract', 'settled',
  ];

  it('accepts all seller stages', () => {
    for (const stage of sellerStages) {
      expect(SellerStageSchema.parse(stage)).toBe(stage);
    }
  });

  it('rejects invalid stage', () => {
    expect(() => SellerStageSchema.parse('closed')).toThrow();
  });
});

// ─── Stage Order Maps ──────────────────────────────────────────────

describe('BUYER_STAGE_ORDER', () => {
  it('has correct ordering (ascending from 1-8)', () => {
    expect(BUYER_STAGE_ORDER['new-enquiry']).toBe(1);
    expect(BUYER_STAGE_ORDER['settled']).toBe(8);
  });

  it('has sequential ordering', () => {
    const values = Object.values(BUYER_STAGE_ORDER);
    const sorted = [...values].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('SELLER_STAGE_ORDER', () => {
  it('has correct ordering (ascending from 1-6)', () => {
    expect(SELLER_STAGE_ORDER['appraisal-request']).toBe(1);
    expect(SELLER_STAGE_ORDER['settled']).toBe(6);
  });

  it('has sequential ordering', () => {
    const values = Object.values(SELLER_STAGE_ORDER);
    const sorted = [...values].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ─── Stage Labels ──────────────────────────────────────────────────

describe('Stage Labels', () => {
  it('has a label for every buyer stage', () => {
    const stages = BuyerStageSchema.options;
    for (const stage of stages) {
      expect(BUYER_STAGE_LABELS[stage]).toBeDefined();
      expect(typeof BUYER_STAGE_LABELS[stage]).toBe('string');
      expect(BUYER_STAGE_LABELS[stage].length).toBeGreaterThan(0);
    }
  });

  it('has a label for every seller stage', () => {
    const stages = SellerStageSchema.options;
    for (const stage of stages) {
      expect(SELLER_STAGE_LABELS[stage]).toBeDefined();
      expect(typeof SELLER_STAGE_LABELS[stage]).toBe('string');
      expect(SELLER_STAGE_LABELS[stage].length).toBeGreaterThan(0);
    }
  });
});

// ─── TransactionSchema ─────────────────────────────────────────────

describe('TransactionSchema', () => {
  const validTransaction = {
    id: uuid(),
    contactId: uuid(),
    pipelineType: 'buying' as const,
    currentStage: 'new-enquiry',
    assignedAgentId: uuid(),
    createdAt: now(),
    updatedAt: now(),
  };

  it('accepts a minimal valid transaction', () => {
    const result = TransactionSchema.parse(validTransaction);
    expect(result.pipelineType).toBe('buying');
    expect(result.currentStage).toBe('new-enquiry');
  });

  it('accepts optional offer details', () => {
    const result = TransactionSchema.parse({
      ...validTransaction,
      offerAmount: 750000,
      offerConditions: 'Subject to finance',
      offerStatus: 'pending',
    });
    expect(result.offerAmount).toBe(750000);
    expect(result.offerStatus).toBe('pending');
  });

  it('accepts optional contract details', () => {
    const result = TransactionSchema.parse({
      ...validTransaction,
      contractPrice: 800000,
      exchangeDate: now(),
      settlementDate: now(),
      depositAmount: 80000,
      depositPaid: true,
    });
    expect(result.contractPrice).toBe(800000);
    expect(result.depositPaid).toBe(true);
  });

  it('accepts commission fields for selling', () => {
    const result = TransactionSchema.parse({
      ...validTransaction,
      pipelineType: 'selling',
      commissionRate: 2.5,
      commissionAmount: 20000,
    });
    expect(result.commissionRate).toBe(2.5);
  });

  it('rejects invalid offer status', () => {
    expect(() =>
      TransactionSchema.parse({
        ...validTransaction,
        offerStatus: 'invalid',
      }),
    ).toThrow();
  });

  it('rejects commission rate outside 0-100', () => {
    expect(() =>
      TransactionSchema.parse({
        ...validTransaction,
        commissionRate: 101,
      }),
    ).toThrow();
  });
});

// ─── StageTransitionSchema ─────────────────────────────────────────

describe('StageTransitionSchema', () => {
  it('accepts a valid stage transition', () => {
    const result = StageTransitionSchema.parse({
      id: uuid(),
      transactionId: uuid(),
      fromStage: 'new-enquiry',
      toStage: 'qualified-lead',
      triggeredBy: uuid(),
      createdAt: now(),
    });
    expect(result.fromStage).toBe('new-enquiry');
    expect(result.toStage).toBe('qualified-lead');
  });

  it('accepts optional reason', () => {
    const result = StageTransitionSchema.parse({
      id: uuid(),
      transactionId: uuid(),
      fromStage: 'new-enquiry',
      toStage: 'qualified-lead',
      triggeredBy: uuid(),
      reason: 'Budget confirmed',
      createdAt: now(),
    });
    expect(result.reason).toBe('Budget confirmed');
  });
});

// ─── CreateTransactionSchema ───────────────────────────────────────

describe('CreateTransactionSchema', () => {
  it('omits id, createdAt, updatedAt', () => {
    const result = CreateTransactionSchema.parse({
      contactId: uuid(),
      pipelineType: 'buying',
      currentStage: 'new-enquiry',
      assignedAgentId: uuid(),
    });
    expect(result.contactId).toBeDefined();
    expect((result as Record<string, unknown>).id).toBeUndefined();
  });
});
