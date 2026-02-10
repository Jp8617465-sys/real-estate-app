import { z } from 'zod';

// ─── Address ────────────────────────────────────────────────────────
export const AddressSchema = z.object({
  streetNumber: z.string(),
  streetName: z.string(),
  unitNumber: z.string().optional(),
  suburb: z.string(),
  state: z.enum(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']),
  postcode: z.string().regex(/^\d{4}$/, 'Must be a 4-digit Australian postcode'),
  country: z.literal('AU').default('AU'),
});

export type Address = z.infer<typeof AddressSchema>;

// ─── Australian States ──────────────────────────────────────────────
export const AustralianState = AddressSchema.shape.state;
export type AustralianState = z.infer<typeof AustralianState>;

// ─── Property Types ─────────────────────────────────────────────────
export const PropertyTypeSchema = z.enum([
  'house',
  'unit',
  'townhouse',
  'villa',
  'land',
  'rural',
  'apartment',
  'duplex',
  'studio',
  'acreage',
  'retirement',
  'commercial',
]);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

// ─── Lead Source ────────────────────────────────────────────────────
export const LeadSourceSchema = z.enum([
  'domain',
  'rea',
  'instagram',
  'facebook',
  'linkedin',
  'referral',
  'walk-in',
  'cold-call',
  'website',
  'open-home',
  'signboard',
  'print',
  'google_ads',
  'other',
]);
export type LeadSource = z.infer<typeof LeadSourceSchema>;

// ─── Communication Preference ───────────────────────────────────────
export const CommunicationPreferenceSchema = z.enum(['email', 'phone', 'sms', 'any']);
export type CommunicationPreference = z.infer<typeof CommunicationPreferenceSchema>;

// ─── Sale Type ──────────────────────────────────────────────────────
export const SaleTypeSchema = z.enum([
  'private-treaty',
  'auction',
  'expression-of-interest',
  'tender',
]);
export type SaleType = z.infer<typeof SaleTypeSchema>;

// ─── Listing Status ─────────────────────────────────────────────────
export const ListingStatusSchema = z.enum([
  'pre-market',
  'active',
  'under-offer',
  'sold',
  'withdrawn',
  'leased',
]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

// ─── Pagination ─────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Sort ───────────────────────────────────────────────────────────
export const SortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirectionSchema>;
