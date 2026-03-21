import { z } from 'zod';

// ─── Australian Address (Domain format) ─────────────────────────────────────

export const DomainAddressSchema = z.object({
  streetNumber: z.string().optional(),
  street: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postCode: z.string().optional(),
  displayableAddress: z.string().optional(),
  unitNumber: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type DomainAddress = z.infer<typeof DomainAddressSchema>;

// ─── Domain Listing Photo ───────────────────────────────────────────────────

export const DomainPhotoSchema = z.object({
  imageUrl: z.string(),
  fullUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  category: z.string().optional(),
  rank: z.number().int().optional(),
  dateCreated: z.string().optional(),
});
export type DomainPhoto = z.infer<typeof DomainPhotoSchema>;

// ─── Domain Floorplan ───────────────────────────────────────────────────────

export const DomainFloorplanSchema = z.object({
  imageUrl: z.string(),
  thumbnailUrl: z.string().optional(),
  dateCreated: z.string().optional(),
});
export type DomainFloorplan = z.infer<typeof DomainFloorplanSchema>;

// ─── Domain Price Details ───────────────────────────────────────────────────

export const DomainPriceDetailsSchema = z.object({
  price: z.number().optional(),
  priceFrom: z.number().optional(),
  priceTo: z.number().optional(),
  displayPrice: z.string().optional(),
  canDisplayPrice: z.boolean().optional(),
});
export type DomainPriceDetails = z.infer<typeof DomainPriceDetailsSchema>;

// ─── Domain Inspection Schedule ─────────────────────────────────────────────

export const DomainInspectionScheduleSchema = z.object({
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  recurrence: z.string().optional(),
});
export type DomainInspectionSchedule = z.infer<typeof DomainInspectionScheduleSchema>;

// ─── Domain Auction Schedule ────────────────────────────────────────────────

export const DomainAuctionScheduleSchema = z.object({
  time: z.string().optional(),
  auctionLocation: z.string().optional(),
});
export type DomainAuctionSchedule = z.infer<typeof DomainAuctionScheduleSchema>;

// ─── Domain Agent ───────────────────────────────────────────────────────────

export const DomainListingAgentSchema = z.object({
  agentId: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  photo: z.string().optional(),
  agencyName: z.string().optional(),
  agencyId: z.union([z.string(), z.number()]).optional(),
  agencyLogo: z.string().optional(),
});
export type DomainListingAgent = z.infer<typeof DomainListingAgentSchema>;

// ─── Domain Listing ─────────────────────────────────────────────────────────

export const DomainListingSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  listingId: z.union([z.string(), z.number()]).optional(),
  addressParts: DomainAddressSchema.optional(),
  priceDetails: DomainPriceDetailsSchema.optional(),
  propertyTypes: z.array(z.string()).optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  carspaces: z.number().optional(),
  landAreaSqm: z.number().optional(),
  buildingAreaSqm: z.number().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  listingType: z.string().optional(),
  saleMode: z.string().optional(),
  status: z.string().optional(),
  auctionSchedule: DomainAuctionScheduleSchema.optional(),
  inspectionSchedule: z.array(DomainInspectionScheduleSchema).optional(),
  media: z.array(DomainPhotoSchema).optional(),
  floorplans: z.array(DomainFloorplanSchema).optional(),
  virtualTourUrl: z.string().optional(),
  agents: z.array(DomainListingAgentSchema).optional(),
  dateAvailable: z.string().optional(),
  dateListed: z.string().optional(),
  dateUpdated: z.string().optional(),
  features: z.array(z.string()).optional(),
  yearBuilt: z.number().optional(),
});
export type DomainListing = z.infer<typeof DomainListingSchema>;

// ─── Domain Search Response ─────────────────────────────────────────────────

export const DomainSearchResponseSchema = z.object({
  listings: z.array(DomainListingSchema).optional(),
  totalResults: z.number().optional(),
  returnedResults: z.number().optional(),
});
export type DomainSearchResponse = z.infer<typeof DomainSearchResponseSchema>;

// ─── Domain Search Parameters ───────────────────────────────────────────────

export const DomainSearchParamsSchema = z.object({
  suburb: z.string(),
  state: z.string(),
  postcode: z.string(),
  listingType: z.enum(['Sale', 'Rent', 'Share', 'Sold', 'NewHomes']).default('Sale'),
  propertyTypes: z.array(z.string()).optional(),
  minBedrooms: z.number().int().nonnegative().optional(),
  maxBedrooms: z.number().int().nonnegative().optional(),
  minBathrooms: z.number().int().nonnegative().optional(),
  maxBathrooms: z.number().int().nonnegative().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  minLandArea: z.number().nonnegative().optional(),
  maxLandArea: z.number().nonnegative().optional(),
  pageSize: z.number().int().positive().max(200).default(20),
  pageNumber: z.number().int().positive().default(1),
  sortBy: z.enum(['default', 'price-asc', 'price-desc', 'date-new', 'date-old']).optional(),
});
export type DomainSearchParams = z.infer<typeof DomainSearchParamsSchema>;

// ─── Domain Agent Profile ───────────────────────────────────────────────────

export const DomainAgentProfileSchema = z.object({
  agentId: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  photo: z.string().optional(),
  biography: z.string().optional(),
  profileUrl: z.string().optional(),
  agencyId: z.union([z.string(), z.number()]).optional(),
  agencyName: z.string().optional(),
  agencyAddress: z.string().optional(),
  agencyLogo: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  salesCount: z.number().optional(),
  rentalCount: z.number().optional(),
  averageSalePrice: z.number().optional(),
  medianSalePrice: z.number().optional(),
});
export type DomainAgentProfile = z.infer<typeof DomainAgentProfileSchema>;

// ─── Domain Property History Entry ──────────────────────────────────────────

export const DomainPropertyHistoryEntrySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  date: z.string().optional(),
  type: z.enum(['sold', 'listed', 'rented', 'withdrawn']).optional(),
  price: z.number().optional(),
  agency: z.string().optional(),
  agentName: z.string().optional(),
  documentUrl: z.string().optional(),
});
export type DomainPropertyHistoryEntry = z.infer<typeof DomainPropertyHistoryEntrySchema>;

// ─── Domain Property History ────────────────────────────────────────────────

export const DomainPropertyHistorySchema = z.object({
  propertyId: z.union([z.string(), z.number()]),
  address: DomainAddressSchema.optional(),
  propertyType: z.string().optional(),
  history: z.array(DomainPropertyHistoryEntrySchema),
});
export type DomainPropertyHistory = z.infer<typeof DomainPropertyHistorySchema>;

// ─── Domain Sales Result (from auction/sales endpoint) ──────────────────────

export const DomainSalesResultSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  domainListingId: z.union([z.string(), z.number()]).optional(),
  suburb: z.string().optional(),
  postcode: z.string().optional(),
  state: z.string().optional(),
  auctionDate: z.string().optional(),
  result: z.string().optional(),
  soldPrice: z.number().optional(),
  reservePrice: z.number().optional(),
  registeredBidders: z.number().optional(),
  agentName: z.string().optional(),
  agencyName: z.string().optional(),
  propertyType: z.string().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  carspaces: z.number().optional(),
  landAreaSqm: z.number().optional(),
  address: z.string().optional(),
});
export type DomainSalesResult = z.infer<typeof DomainSalesResultSchema>;

// ─── Domain Sales Response ──────────────────────────────────────────────────

export const DomainSalesResponseSchema = z.object({
  salesResults: z.array(DomainSalesResultSchema).optional(),
  results: z.array(DomainSalesResultSchema).optional(),
});
export type DomainSalesResponse = z.infer<typeof DomainSalesResponseSchema>;

// ─── Domain Alert Subscription ──────────────────────────────────────────────

export const DomainAlertCriteriaSchema = z.object({
  suburbs: z.array(
    z.object({
      suburb: z.string(),
      state: z.string(),
      postCode: z.string().optional(),
    }),
  ),
  propertyTypes: z.array(z.string()).optional(),
  minBedrooms: z.number().int().nonnegative().optional(),
  maxBedrooms: z.number().int().nonnegative().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  minLandArea: z.number().nonnegative().optional(),
  listingType: z.enum(['Sale', 'Rent']).default('Sale'),
});
export type DomainAlertCriteria = z.infer<typeof DomainAlertCriteriaSchema>;

export const DomainAlertSubscriptionSchema = z.object({
  id: z.string(),
  criteria: DomainAlertCriteriaSchema,
  webhookUrl: z.string().url(),
  active: z.boolean(),
  createdAt: z.string().optional(),
});
export type DomainAlertSubscription = z.infer<typeof DomainAlertSubscriptionSchema>;

// ─── Domain Webhook Event ───────────────────────────────────────────────────

export const DomainWebhookEventSchema = z.object({
  type: z.enum([
    'listing.created',
    'listing.updated',
    'listing.priceUpdated',
    'listing.statusChanged',
    'listing.deleted',
    'alert.newListing',
  ]),
  listingId: z.string().optional(),
  listing: DomainListingSchema.optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  previousPrice: z.number().optional(),
  newPrice: z.number().optional(),
  timestamp: z.string().optional(),
  subscriptionId: z.string().optional(),
});
export type DomainWebhookEvent = z.infer<typeof DomainWebhookEventSchema>;

// ─── Domain Auction Results Filter ──────────────────────────────────────────

export const DomainAuctionResultsFilterSchema = z.object({
  suburb: z.string(),
  state: z.string().default('NSW'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
export type DomainAuctionResultsFilter = z.infer<typeof DomainAuctionResultsFilterSchema>;

// ─── Listing Status Mapping ─────────────────────────────────────────────────

export const DOMAIN_LISTING_STATUS_MAP: Record<string, string> = {
  live: 'active',
  underOffer: 'under-offer',
  sold: 'sold',
  withdrawn: 'withdrawn',
  leased: 'leased',
  deposit: 'under-offer',
  newDevelopment: 'active',
} as const;

// ─── Property Type Mapping ──────────────────────────────────────────────────

export const DOMAIN_PROPERTY_TYPE_MAP: Record<string, string> = {
  House: 'house',
  Townhouse: 'townhouse',
  Apartment: 'apartment',
  ApartmentUnitFlat: 'apartment',
  Unit: 'unit',
  Villa: 'villa',
  Land: 'land',
  VacantLand: 'land',
  Rural: 'rural',
  'Semi-Detached': 'duplex',
  SemiDetached: 'duplex',
  Terrace: 'house',
  Studio: 'studio',
  Duplex: 'duplex',
  Acreage: 'acreage',
  BlockOfUnits: 'apartment',
  RetirementLiving: 'retirement',
} as const;

// ─── Rate Limit Configuration ───────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000, // 1 minute
};

// ─── Cache Configuration ────────────────────────────────────────────────────

export interface CacheConfig {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Default TTL in milliseconds */
  defaultTtlMs: number;
  /** TTL overrides per endpoint pattern */
  ttlOverrides: Record<string, number>;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  defaultTtlMs: 5 * 60_000, // 5 minutes
  ttlOverrides: {
    'listings/_search': 2 * 60_000, // 2 minutes for search (data changes frequently)
    'listings/': 5 * 60_000, // 5 minutes for individual listings
    'agents/': 30 * 60_000, // 30 minutes for agent profiles
    'properties/': 15 * 60_000, // 15 minutes for property history
    'salesResults/': 60 * 60_000, // 1 hour for sales results (historical data)
    suburbPerformance: 60 * 60_000, // 1 hour for suburb stats
  },
};
