import { z } from 'zod';

// ─── Success Fee Type ──────────────────────────────────────────────
export const SuccessFeeTypeSchema = z.enum(['flat', 'percentage', 'tiered']);
export type SuccessFeeType = z.infer<typeof SuccessFeeTypeSchema>;

// ─── Invoice Type ──────────────────────────────────────────────────
export const InvoiceTypeSchema = z.enum(['retainer', 'success_fee', 'referral_fee']);
export type InvoiceType = z.infer<typeof InvoiceTypeSchema>;

// ─── Invoice Status ────────────────────────────────────────────────
export const InvoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

// ─── Referral Fee Type ─────────────────────────────────────────────
export const ReferralFeeTypeSchema = z.enum(['flat', 'percentage_of_success']);
export type ReferralFeeType = z.infer<typeof ReferralFeeTypeSchema>;

// ─── Success Fee Tier ──────────────────────────────────────────────
export const SuccessFeeTierSchema = z.object({
  upTo: z.number().positive(),
  fee: z.number().nonnegative(),
});
export type SuccessFeeTier = z.infer<typeof SuccessFeeTierSchema>;

// ─── Referral Fee ──────────────────────────────────────────────────
export const ReferralFeeSchema = z.object({
  id: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  referrerName: z.string(),
  referrerContactId: z.string().uuid().optional(),
  amount: z.number().nonnegative(),
  type: ReferralFeeTypeSchema,
  paid: z.boolean().default(false),
  paidDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReferralFee = z.infer<typeof ReferralFeeSchema>;

// ─── Create Referral Fee ───────────────────────────────────────────
export const CreateReferralFeeSchema = ReferralFeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidDate: true,
});
export type CreateReferralFee = z.infer<typeof CreateReferralFeeSchema>;

// ─── Invoice ───────────────────────────────────────────────────────
export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  clientId: z.string().uuid(),
  type: InvoiceTypeSchema,
  amount: z.number().nonnegative(),
  gstAmount: z.number().nonnegative().default(0),
  status: InvoiceStatusSchema.default('draft'),
  dueDate: z.string().datetime().optional(),
  paidDate: z.string().datetime().optional(),
  stripeInvoiceId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

// ─── Create Invoice ────────────────────────────────────────────────
export const CreateInvoiceSchema = InvoiceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidDate: true,
});
export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;

// ─── Update Invoice ────────────────────────────────────────────────
export const UpdateInvoiceSchema = z.object({
  status: InvoiceStatusSchema.optional(),
  paidDate: z.string().datetime().optional(),
  stripeInvoiceId: z.string().optional(),
});
export type UpdateInvoice = z.infer<typeof UpdateInvoiceSchema>;

// ─── Fee Structure ─────────────────────────────────────────────────
export const FeeStructureSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  transactionId: z.string().uuid().optional(),

  retainerFee: z.number().nonnegative().default(0),
  retainerPaidDate: z.string().datetime().optional(),

  successFeeType: SuccessFeeTypeSchema,
  successFeeFlatAmount: z.number().nonnegative().optional(),
  successFeePercentage: z.number().min(0).max(100).optional(),
  successFeeTiers: z.array(SuccessFeeTierSchema).optional(),
  successFeeDueDate: z.string().datetime().optional(),
  successFeePaid: z.boolean().default(false),
  successFeeAmount: z.number().nonnegative().optional(), // calculated

  gstIncluded: z.boolean().default(true),

  // Nested (for API responses)
  invoices: z.array(InvoiceSchema).optional(),
  referralFees: z.array(ReferralFeeSchema).optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FeeStructure = z.infer<typeof FeeStructureSchema>;

// ─── Create Fee Structure ──────────────────────────────────────────
export const CreateFeeStructureSchema = FeeStructureSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  successFeeAmount: true,
  invoices: true,
  referralFees: true,
});
export type CreateFeeStructure = z.infer<typeof CreateFeeStructureSchema>;

// ─── Update Fee Structure ──────────────────────────────────────────
export const UpdateFeeStructureSchema = CreateFeeStructureSchema.partial();
export type UpdateFeeStructure = z.infer<typeof UpdateFeeStructureSchema>;
