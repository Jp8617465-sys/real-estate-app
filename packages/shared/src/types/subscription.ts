import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────
export const SubscriptionTierSchema = z.enum(['free', 'professional', 'enterprise']);
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const SubscriptionStatusSchema = z.enum([
  'active',
  'trialing',
  'past_due',
  'canceled',
  'inactive',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// ─── Subscription Model ────────────────────────────────────────────────
export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  stripePriceId: z.string().nullable(),
  tier: SubscriptionTierSchema,
  status: SubscriptionStatusSchema,
  productScope: z.enum(['buyers_agent', 'selling_agent', 'both']),
  seatCount: z.number().int().min(1),
  currentPeriodStart: z.string().datetime().nullable(),
  currentPeriodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

// ─── API Input Schemas ──────────────────────────────────────────────────
export const CreateCheckoutSessionInputSchema = z.object({
  officeId: z.string().uuid(),
});
export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionInputSchema>;

// ─── API Response ───────────────────────────────────────────────────────
export interface SubscriptionResponse {
  subscription: Subscription | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isActive: boolean;
}

// ─── Tier Limits ────────────────────────────────────────────────────────
export interface TierLimits {
  maxUsers: number;
  maxContacts: number;
  maxDeals: number;
  aiQueriesPerMonth: number;
  hasApiAccess: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxUsers: 2,
    maxContacts: 100,
    maxDeals: 20,
    aiQueriesPerMonth: 10,
    hasApiAccess: false,
  },
  professional: {
    maxUsers: 10,
    maxContacts: 5000,
    maxDeals: 500,
    aiQueriesPerMonth: 500,
    hasApiAccess: true,
  },
  enterprise: {
    maxUsers: 50,
    maxContacts: 50000,
    maxDeals: 5000,
    aiQueriesPerMonth: 5000,
    hasApiAccess: true,
  },
};

// ─── Helper Functions ───────────────────────────────────────────────────
export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier]!;
}

export function isWithinTierLimit(
  tier: SubscriptionTier,
  resource: keyof TierLimits,
  currentCount: number
): boolean {
  const limits = TIER_LIMITS[tier]!;
  const limit = limits[resource];
  if (typeof limit === 'boolean') return limit;
  return currentCount < limit;
}
