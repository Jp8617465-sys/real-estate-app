import { z } from 'zod';

// ─── Product Type ────────────────────────────────────────────────────
export const ProductTypeSchema = z.enum(['buyers_agent', 'selling_agent', 'both']);
export type ProductType = z.infer<typeof ProductTypeSchema>;

// ─── Feature Lists ───────────────────────────────────────────────────
export const BA_FEATURES = [
  'client_briefs',
  'property_matching',
  'off_market',
  'due_diligence',
  'selling_agents',
  'ba_compliance',
] as const;

export const SELLING_FEATURES = [
  'listings',
  'domain_sync',
  'social_publishing',
  'open_homes',
  'appraisals',
  'seller_marketing',
] as const;

export const SHARED_FEATURES = [
  'contacts',
  'pipeline',
  'inbox',
  'tasks',
  'notifications',
  'workflows',
  'compliance',
  'team',
  'settings',
  'analytics',
  'daily_actions',
  'alerts',
] as const;

// ─── Feature Types ───────────────────────────────────────────────────
export type BAFeature = (typeof BA_FEATURES)[number];
export type SellingFeature = (typeof SELLING_FEATURES)[number];
export type SharedFeature = (typeof SHARED_FEATURES)[number];
export type ProductFeature = BAFeature | SellingFeature | SharedFeature;

// ─── Feature Guard ───────────────────────────────────────────────────
export function isFeatureAvailable(
  feature: ProductFeature,
  productAccess: ProductType
): boolean {
  if (productAccess === 'both') return true;
  if ((SHARED_FEATURES as readonly string[]).includes(feature)) return true;
  if (productAccess === 'buyers_agent') {
    return (BA_FEATURES as readonly string[]).includes(feature);
  }
  if (productAccess === 'selling_agent') {
    return (SELLING_FEATURES as readonly string[]).includes(feature);
  }
  return false;
}

// ─── Route-to-Feature Mapping ────────────────────────────────────────
export const ROUTE_FEATURE_MAP: Record<string, ProductFeature> = {
  '/buyers-agent/briefs': 'client_briefs',
  '/buyers-agent/matches': 'property_matching',
  '/buyers-agent/off-market': 'off_market',
  '/buyers-agent/due-diligence': 'due_diligence',
  '/buyers-agent/selling-agents': 'selling_agents',
  '/buyers-agent/compliance': 'ba_compliance',
  '/properties': 'listings',
  '/social': 'social_publishing',
  '/market': 'listings',
};
