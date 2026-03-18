import { z } from 'zod';

// ─── Subscription Plan ──────────────────────────────────────────────

export const SubscriptionPlanIdSchema = z.enum([
  'starter',
  'professional',
  'team',
  'enterprise',
]);
export type SubscriptionPlanId = z.infer<typeof SubscriptionPlanIdSchema>;

export const SubscriptionPlanSchema = z.object({
  id: SubscriptionPlanIdSchema,
  name: z.string(),
  priceMonthlyAud: z.number().nonnegative(),
  priceYearlyAud: z.number().nonnegative(),
  maxSeats: z.number().int().positive(),
  features: z.array(z.string()),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdYearly: z.string().optional(),
});
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

// ─── Subscription Status ────────────────────────────────────────────

export const SubscriptionStatusSchema = z.enum([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// ─── Billing Interval ───────────────────────────────────────────────

export const BillingIntervalSchema = z.enum(['monthly', 'yearly']);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

// ─── Subscription ───────────────────────────────────────────────────

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  planId: SubscriptionPlanIdSchema,
  status: SubscriptionStatusSchema,
  billingInterval: BillingIntervalSchema,
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  cancelAtPeriodEnd: z.boolean().default(false),
  trialEndsAt: z.string().datetime().optional(),
  seatCount: z.number().int().positive().default(1),
  stripeCustomerId: z.string(),
  stripeSubscriptionId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

// ─── Create Subscription ────────────────────────────────────────────

export const CreateSubscriptionSchema = z.object({
  planId: SubscriptionPlanIdSchema,
  billingInterval: BillingIntervalSchema,
  seatCount: z.number().int().positive().default(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
export type CreateSubscription = z.infer<typeof CreateSubscriptionSchema>;

// ─── Update Subscription ────────────────────────────────────────────

export const UpdateSubscriptionSchema = z.object({
  planId: SubscriptionPlanIdSchema.optional(),
  seatCount: z.number().int().positive().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});
export type UpdateSubscription = z.infer<typeof UpdateSubscriptionSchema>;

// ─── Payment History ────────────────────────────────────────────────

export const PaymentStatusSchema = z.enum(['succeeded', 'failed', 'pending', 'refunded']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentHistorySchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  amountAud: z.number().nonnegative(),
  gstAmountAud: z.number().nonnegative(),
  status: PaymentStatusSchema,
  stripePaymentIntentId: z.string(),
  stripeInvoiceId: z.string().optional(),
  description: z.string().optional(),
  paidAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type PaymentHistory = z.infer<typeof PaymentHistorySchema>;

// ─── Billing Portal Request ─────────────────────────────────────────

export const BillingPortalRequestSchema = z.object({
  returnUrl: z.string().url(),
});
export type BillingPortalRequest = z.infer<typeof BillingPortalRequestSchema>;

// ─── Predefined Plans ───────────────────────────────────────────────

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthlyAud: 49,
    priceYearlyAud: 470,
    maxSeats: 1,
    features: [
      'CRM & Pipeline',
      'Client Briefs',
      'Property Matching',
      'Due Diligence Checklists',
      'Mobile App',
      'Email/SMS Inbox',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    priceMonthlyAud: 99,
    priceYearlyAud: 950,
    maxSeats: 3,
    features: [
      'Everything in Starter',
      'AI Property Matching',
      'AI Lead Scoring',
      'Workflow Automation',
      'Domain Portal Sync',
      'Client Portal Access',
      'Fee Tracking & Invoicing',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    priceMonthlyAud: 199,
    priceYearlyAud: 1910,
    maxSeats: 10,
    features: [
      'Everything in Professional',
      'Team Performance Analytics',
      'Custom Reports & Dashboards',
      'Round-Robin Lead Assignment',
      'AML/KYC Compliance',
      'Social Media Integration',
      'Priority Support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthlyAud: 0,
    priceYearlyAud: 0,
    maxSeats: 999,
    features: [
      'Everything in Team',
      'Unlimited Seats',
      'Multi-Office Support',
      'White-Label Portal',
      'API Access',
      'Dedicated Account Manager',
      'Custom Integrations',
      'SLA Guarantee',
    ],
  },
];
