import { z } from 'zod';

// ─── Sale Method ───────────────────────────────────────────────────
export const SaleMethodSchema = z.enum(['private_treaty', 'auction', 'eoi', 'tender']);
export type SaleMethod = z.infer<typeof SaleMethodSchema>;

// ─── Offer Status ──────────────────────────────────────────────────
export const OfferStatusSchema = z.enum(['preparing', 'submitted', 'countered', 'accepted', 'rejected', 'withdrawn']);
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

// ─── Offer Response ────────────────────────────────────────────────
export const OfferResponseSchema = z.enum(['pending', 'accepted', 'rejected', 'countered']);
export type OfferResponse = z.infer<typeof OfferResponseSchema>;

// ─── Deposit Type ──────────────────────────────────────────────────
export const DepositTypeSchema = z.enum(['cash', 'deposit_bond', 'bank_guarantee']);
export type DepositType = z.infer<typeof DepositTypeSchema>;

// ─── Auction Result ────────────────────────────────────────────────
export const AuctionResultSchema = z.enum(['won', 'passed_in', 'outbid']);
export type AuctionResult = z.infer<typeof AuctionResultSchema>;

// ─── Offer Round ───────────────────────────────────────────────────
export const OfferRoundSchema = z.object({
  id: z.string().uuid(),
  offerId: z.string().uuid(),
  amount: z.number().positive(),
  conditions: z.array(z.string()),
  response: OfferResponseSchema.default('pending'),
  counterAmount: z.number().positive().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type OfferRound = z.infer<typeof OfferRoundSchema>;

export const CreateOfferRoundSchema = OfferRoundSchema.omit({ id: true, createdAt: true });
export type CreateOfferRound = z.infer<typeof CreateOfferRoundSchema>;

// ─── Auction Event ─────────────────────────────────────────────────
export const AuctionEventSchema = z.object({
  id: z.string().uuid(),
  offerId: z.string().uuid(),
  auctionDate: z.string().datetime(),
  registrationNumber: z.string().optional(),
  biddingStrategy: z.string().optional(),
  result: AuctionResultSchema.optional(),
  finalPrice: z.number().positive().optional(),
  numberOfBidders: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AuctionEvent = z.infer<typeof AuctionEventSchema>;

export const CreateAuctionEventSchema = AuctionEventSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreateAuctionEvent = z.infer<typeof CreateAuctionEventSchema>;

// ─── Offer ─────────────────────────────────────────────────────────
export const OfferSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  propertyId: z.string().uuid(),
  clientId: z.string().uuid(),

  saleMethod: SaleMethodSchema,
  status: OfferStatusSchema.default('preparing'),

  strategyNotes: z.string().optional(),
  clientMaxPrice: z.number().positive().optional(),
  recommendedOffer: z.number().positive().optional(),
  walkAwayPrice: z.number().positive().optional(),

  conditions: z.array(z.string()),
  settlementPeriod: z.number().int().positive().optional(), // days
  depositAmount: z.number().nonnegative().optional(),
  depositType: DepositTypeSchema.optional(),

  // Nested (for API responses)
  rounds: z.array(OfferRoundSchema).optional(),
  auctionEvent: AuctionEventSchema.optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Offer = z.infer<typeof OfferSchema>;

// ─── Create Offer ──────────────────────────────────────────────────
export const CreateOfferSchema = OfferSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  rounds: true,
  auctionEvent: true,
});
export type CreateOffer = z.infer<typeof CreateOfferSchema>;

// ─── Update Offer ──────────────────────────────────────────────────
export const UpdateOfferSchema = CreateOfferSchema.partial();
export type UpdateOffer = z.infer<typeof UpdateOfferSchema>;
