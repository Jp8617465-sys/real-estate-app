import { z } from 'zod';
import {
  AddressSchema,
  CommunicationPreferenceSchema,
  LeadSourceSchema,
  PropertyTypeSchema,
} from './common';

// ─── Contact Types ──────────────────────────────────────────────────
export const ContactTypeSchema = z.enum([
  'buyer',
  'seller',
  'investor',
  'landlord',
  'tenant',
  'referral-source',
  'past-client',
]);
export type ContactType = z.infer<typeof ContactTypeSchema>;

// ─── Buyer Profile ──────────────────────────────────────────────────
export const BuyerProfileSchema = z.object({
  budgetMin: z.number().nonnegative(),
  budgetMax: z.number().nonnegative(),
  preApproved: z.boolean().default(false),
  preApprovalAmount: z.number().nonnegative().optional(),
  preApprovalExpiry: z.string().datetime().optional(),
  propertyTypes: z.array(PropertyTypeSchema),
  bedrooms: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative().optional(),
  }),
  bathrooms: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative().optional(),
  }),
  carSpaces: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative().optional(),
  }),
  suburbs: z.array(z.string()),
  mustHaves: z.array(z.string()),
  dealBreakers: z.array(z.string()),
});
export type BuyerProfile = z.infer<typeof BuyerProfileSchema>;

// ─── Seller Profile ─────────────────────────────────────────────────
export const SellerProfileSchema = z.object({
  propertyIds: z.array(z.string().uuid()),
  motivationLevel: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  timeframe: z.string(),
  reason: z.string().optional(),
});
export type SellerProfile = z.infer<typeof SellerProfileSchema>;

// ─── Social Profiles ────────────────────────────────────────────────
export const SocialProfilesSchema = z.object({
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  linkedin: z.string().optional(),
});
export type SocialProfiles = z.infer<typeof SocialProfilesSchema>;

// ─── Contact ────────────────────────────────────────────────────────
export const ContactSchema = z.object({
  id: z.string().uuid(),
  types: z.array(ContactTypeSchema).min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(8).max(20),
  secondaryPhone: z.string().min(8).max(20).optional(),
  address: AddressSchema.optional(),

  // Source tracking
  source: LeadSourceSchema,
  sourceDetail: z.string().optional(),
  assignedAgentId: z.string().uuid(),

  // Profiles
  buyerProfile: BuyerProfileSchema.optional(),
  sellerProfile: SellerProfileSchema.optional(),

  // Engagement
  tags: z.array(z.string()),
  lastContactDate: z.string().datetime().optional(),
  nextFollowUp: z.string().datetime().optional(),
  communicationPreference: CommunicationPreferenceSchema.default('any'),

  // Social
  socialProfiles: SocialProfilesSchema.optional(),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Contact = z.infer<typeof ContactSchema>;

// ─── Create Contact ─────────────────────────────────────────────────
export const CreateContactSchema = ContactSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastContactDate: true,
}).partial({
  tags: true,
  socialProfiles: true,
});
export type CreateContact = z.infer<typeof CreateContactSchema>;

// ─── Update Contact ─────────────────────────────────────────────────
export const UpdateContactSchema = CreateContactSchema.partial();
export type UpdateContact = z.infer<typeof UpdateContactSchema>;

// ─── Contact Search ─────────────────────────────────────────────────
export const ContactSearchSchema = z.object({
  query: z.string().optional(),
  types: z.array(ContactTypeSchema).optional(),
  sources: z.array(LeadSourceSchema).optional(),
  tags: z.array(z.string()).optional(),
  assignedAgentId: z.string().uuid().optional(),
  hasFollowUpBefore: z.string().datetime().optional(),
  suburbs: z.array(z.string()).optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
});
export type ContactSearch = z.infer<typeof ContactSearchSchema>;
