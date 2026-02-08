import { z } from 'zod';

// ─── Pipeline Types ─────────────────────────────────────────────────
export const PipelineTypeSchema = z.enum(['buying', 'selling']);
export type PipelineType = z.infer<typeof PipelineTypeSchema>;

// ─── Buyer Pipeline Stages ──────────────────────────────────────────
export const BuyerStageSchema = z.enum([
  'new-enquiry',
  'qualified-lead',
  'active-search',
  'property-shortlisted',
  'due-diligence',
  'offer-made',
  'under-contract',
  'settled',
]);
export type BuyerStage = z.infer<typeof BuyerStageSchema>;

export const BUYER_STAGE_ORDER: Record<BuyerStage, number> = {
  'new-enquiry': 1,
  'qualified-lead': 2,
  'active-search': 3,
  'property-shortlisted': 4,
  'due-diligence': 5,
  'offer-made': 6,
  'under-contract': 7,
  'settled': 8,
};

export const BUYER_STAGE_LABELS: Record<BuyerStage, string> = {
  'new-enquiry': 'New Enquiry',
  'qualified-lead': 'Qualified Lead',
  'active-search': 'Active Search',
  'property-shortlisted': 'Property Shortlisted',
  'due-diligence': 'Due Diligence',
  'offer-made': 'Offer Made',
  'under-contract': 'Under Contract',
  'settled': 'Settled / Complete',
};

// ─── Seller Pipeline Stages ─────────────────────────────────────────
export const SellerStageSchema = z.enum([
  'appraisal-request',
  'listing-preparation',
  'on-market',
  'offers-negotiation',
  'under-contract',
  'settled',
]);
export type SellerStage = z.infer<typeof SellerStageSchema>;

export const SELLER_STAGE_ORDER: Record<SellerStage, number> = {
  'appraisal-request': 1,
  'listing-preparation': 2,
  'on-market': 3,
  'offers-negotiation': 4,
  'under-contract': 5,
  'settled': 6,
};

export const SELLER_STAGE_LABELS: Record<SellerStage, string> = {
  'appraisal-request': 'Appraisal Request',
  'listing-preparation': 'Listing Preparation',
  'on-market': 'On Market',
  'offers-negotiation': 'Offers / Negotiation',
  'under-contract': 'Under Contract',
  'settled': 'Settled / Complete',
};

// ─── Transaction (links contact + property + pipeline) ──────────────
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  pipelineType: PipelineTypeSchema,
  currentStage: z.string(), // BuyerStage or SellerStage
  assignedAgentId: z.string().uuid(),

  // Offer details (when applicable)
  offerAmount: z.number().positive().optional(),
  offerConditions: z.string().optional(),
  offerStatus: z.enum(['pending', 'countered', 'accepted', 'rejected', 'withdrawn']).optional(),

  // Contract details (when applicable)
  contractPrice: z.number().positive().optional(),
  exchangeDate: z.string().datetime().optional(),
  coolingOffExpiry: z.string().datetime().optional(),
  financeApprovalDate: z.string().datetime().optional(),
  settlementDate: z.string().datetime().optional(),
  depositAmount: z.number().positive().optional(),
  depositPaid: z.boolean().optional(),

  // Commission (selling side)
  commissionRate: z.number().min(0).max(100).optional(),
  commissionAmount: z.number().positive().optional(),

  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// ─── Stage Transition ───────────────────────────────────────────────
export const StageTransitionSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  fromStage: z.string(),
  toStage: z.string(),
  triggeredBy: z.string().uuid(), // user ID
  reason: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type StageTransition = z.infer<typeof StageTransitionSchema>;

// ─── Create Transaction ─────────────────────────────────────────────
export const CreateTransactionSchema = TransactionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
