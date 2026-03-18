import { z } from 'zod';

// ─── Domain Sync Job ──────────────────────────────────────────────────────────

export const DomainSyncJobSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  syncType: z.enum(['manual', 'scheduled', 'webhook']),
  listingsFound: z.number().int().min(0),
  listingsImported: z.number().int().min(0),
  matchesTriggered: z.number().int().min(0),
  errorMessage: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const CreateDomainSyncJobSchema = z.object({
  syncType: z.enum(['manual', 'scheduled', 'webhook']).default('manual'),
});

// ─── Price Change ─────────────────────────────────────────────────────────────

export const PriceChangeSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  domainListingId: z.string(),
  previousPrice: z.number().nullable(),
  newPrice: z.number(),
  changePercent: z.number(),
  changeType: z.enum(['reduction', 'increase', 'price_guide_set']),
  notifiedAgentIds: z.array(z.string().uuid()),
  detectedAt: z.string().datetime(),
});

// ─── Auction Result ───────────────────────────────────────────────────────────

export const DomainAuctionResultSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  domainListingId: z.string().nullable(),
  suburb: z.string(),
  postcode: z.string().nullable(),
  state: z.string().nullable(),
  auctionDate: z.string().date(),
  result: z.enum(['sold', 'passed_in', 'withdrawn', 'sold_prior']),
  soldPrice: z.number().nullable(),
  reservePrice: z.number().nullable(),
  registeredBidders: z.number().int().nullable(),
  agentName: z.string().nullable(),
  agencyName: z.string().nullable(),
  createdAt: z.string().datetime(),
});

// ─── Status ───────────────────────────────────────────────────────────────────

export const DomainSyncStatusSchema = z.object({
  connected: z.boolean(),
  lastSync: z.string().datetime().nullable(),
  listingsSynced: z.number().int(),
  priceChanges24h: z.number().int(),
  auctionResults7d: z.number().int(),
  nextScheduledSync: z.string().datetime().nullable(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type DomainSyncJob = z.infer<typeof DomainSyncJobSchema>;
export type CreateDomainSyncJob = z.infer<typeof CreateDomainSyncJobSchema>;
export type PriceChange = z.infer<typeof PriceChangeSchema>;
export type DomainAuctionResult = z.infer<typeof DomainAuctionResultSchema>;
export type DomainSyncStatus = z.infer<typeof DomainSyncStatusSchema>;
