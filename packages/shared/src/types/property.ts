import { z } from 'zod';
import { AddressSchema, ListingStatusSchema, PropertyTypeSchema, SaleTypeSchema } from './common';

// ─── Property Photo ─────────────────────────────────────────────────
export const PropertyPhotoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  caption: z.string().optional(),
  sortOrder: z.number().int().nonnegative(),
  isPrimary: z.boolean().default(false),
});
export type PropertyPhoto = z.infer<typeof PropertyPhotoSchema>;

// ─── Comparable Sale ────────────────────────────────────────────────
export const ComparableSaleSchema = z.object({
  address: z.string(),
  salePrice: z.number().positive(),
  saleDate: z.string().datetime(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  carSpaces: z.number().int().nonnegative(),
  landSize: z.number().nonnegative().optional(),
  propertyType: PropertyTypeSchema,
  source: z.string().optional(),
});
export type ComparableSale = z.infer<typeof ComparableSaleSchema>;

// ─── Property ───────────────────────────────────────────────────────
export const PropertySchema = z.object({
  id: z.string().uuid(),
  address: AddressSchema,
  propertyType: PropertyTypeSchema,
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  carSpaces: z.number().int().nonnegative(),
  landSize: z.number().nonnegative().optional(),
  buildingSize: z.number().nonnegative().optional(),
  yearBuilt: z.number().int().optional(),

  // Listing details
  listingStatus: ListingStatusSchema.default('pre-market'),
  listPrice: z.number().positive().optional(),
  priceGuide: z.string().optional(),
  saleType: SaleTypeSchema,
  auctionDate: z.string().datetime().optional(),

  // Portal integration
  domainListingId: z.string().optional(),
  reaListingId: z.string().optional(),

  // Media
  photos: z.array(PropertyPhotoSchema),
  floorPlans: z.array(z.string().url()),
  virtualTourUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),

  // Relationships
  vendorId: z.string().uuid().optional(),
  interestedBuyerIds: z.array(z.string().uuid()),
  assignedAgentId: z.string().uuid(),

  // Analytics
  portalViews: z.number().int().nonnegative().default(0),
  enquiryCount: z.number().int().nonnegative().default(0),
  inspectionCount: z.number().int().nonnegative().default(0),

  // Comparable sales
  comparables: z.array(ComparableSaleSchema),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Property = z.infer<typeof PropertySchema>;

// ─── Create Property ────────────────────────────────────────────────
export const CreatePropertySchema = PropertySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  portalViews: true,
  enquiryCount: true,
  inspectionCount: true,
}).partial({
  photos: true,
  floorPlans: true,
  interestedBuyerIds: true,
  comparables: true,
});
export type CreateProperty = z.infer<typeof CreatePropertySchema>;

// ─── Update Property ────────────────────────────────────────────────
export const UpdatePropertySchema = CreatePropertySchema.partial();
export type UpdateProperty = z.infer<typeof UpdatePropertySchema>;
