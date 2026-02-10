import { z } from 'zod';
import { PropertyTypeSchema } from './common';

// ─── Suburb Preference ─────────────────────────────────────────────
export const SuburbPreferenceSchema = z.object({
  suburb: z.string(),
  state: z.string(),
  postcode: z.string(),
  rank: z.number().int().positive().optional(),
  notes: z.string().optional(),
});
export type SuburbPreference = z.infer<typeof SuburbPreferenceSchema>;

// ─── Max Commute ───────────────────────────────────────────────────
export const MaxCommuteSchema = z.object({
  destination: z.string(),
  maxMinutes: z.number().int().positive(),
  mode: z.enum(['driving', 'transit', 'walking']),
});
export type MaxCommute = z.infer<typeof MaxCommuteSchema>;

// ─── Investor Criteria ─────────────────────────────────────────────
export const InvestorCriteriaSchema = z.object({
  targetYield: z.number().min(0).max(100),
  growthPriority: z.enum(['yield', 'growth', 'balanced']),
  acceptTenanted: z.boolean(),
  newBuildPreference: z.boolean(),
});
export type InvestorCriteria = z.infer<typeof InvestorCriteriaSchema>;

// ─── Finance Details ───────────────────────────────────────────────
export const FinanceDetailsSchema = z.object({
  preApproved: z.boolean(),
  preApprovalAmount: z.number().nonnegative().optional(),
  preApprovalExpiry: z.string().datetime().optional(),
  lender: z.string().optional(),
  brokerName: z.string().optional(),
  brokerPhone: z.string().optional(),
  brokerEmail: z.string().email().optional(),
  depositAvailable: z.number().nonnegative().optional(),
  firstHomeBuyer: z.boolean().default(false),
});
export type FinanceDetails = z.infer<typeof FinanceDetailsSchema>;

// ─── Solicitor ─────────────────────────────────────────────────────
export const SolicitorSchema = z.object({
  firmName: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string().email(),
});
export type Solicitor = z.infer<typeof SolicitorSchema>;

// ─── Purchase Type ─────────────────────────────────────────────────
export const PurchaseTypeSchema = z.enum(['owner_occupier', 'investor', 'development', 'smsf']);
export type PurchaseType = z.infer<typeof PurchaseTypeSchema>;

// ─── Enquiry Type ──────────────────────────────────────────────────
export const EnquiryTypeSchema = z.enum(['home_buyer', 'investor', 'both', 'unsure']);
export type EnquiryType = z.infer<typeof EnquiryTypeSchema>;

// ─── Urgency ───────────────────────────────────────────────────────
export const UrgencySchema = z.enum(['asap', '1_3_months', '3_6_months', '6_12_months', 'no_rush']);
export type Urgency = z.infer<typeof UrgencySchema>;

// ─── Update Frequency ──────────────────────────────────────────────
export const UpdateFrequencySchema = z.enum(['daily', 'twice_weekly', 'weekly']);
export type UpdateFrequency = z.infer<typeof UpdateFrequencySchema>;

// ─── Brief Contact Method ──────────────────────────────────────────
export const BriefContactMethodSchema = z.enum(['phone', 'email', 'sms', 'whatsapp']);
export type BriefContactMethod = z.infer<typeof BriefContactMethodSchema>;

// ─── Client Brief ──────────────────────────────────────────────────
export const ClientBriefSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  transactionId: z.string().uuid().optional(),

  // Purchase context
  purchaseType: PurchaseTypeSchema,
  enquiryType: EnquiryTypeSchema,

  // Budget
  budget: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    absoluteMax: z.number().nonnegative().optional(),
    stampDutyBudgeted: z.boolean().default(false),
  }),

  // Finance
  finance: FinanceDetailsSchema,

  // Requirements
  requirements: z.object({
    propertyTypes: z.array(PropertyTypeSchema),
    bedrooms: z.object({
      min: z.number().int().nonnegative(),
      ideal: z.number().int().nonnegative().optional(),
    }),
    bathrooms: z.object({
      min: z.number().int().nonnegative(),
      ideal: z.number().int().nonnegative().optional(),
    }),
    carSpaces: z.object({
      min: z.number().int().nonnegative(),
      ideal: z.number().int().nonnegative().optional(),
    }),
    landSize: z.object({
      min: z.number().nonnegative().optional(),
      max: z.number().nonnegative().optional(),
    }).optional(),
    buildingAge: z.object({
      min: z.number().int().optional(),
      max: z.number().int().optional(),
    }).optional(),

    // Location
    suburbs: z.array(SuburbPreferenceSchema),
    maxCommute: MaxCommuteSchema.optional(),
    schoolZones: z.array(z.string()).optional(),

    // Preferences
    mustHaves: z.array(z.string()),
    niceToHaves: z.array(z.string()),
    dealBreakers: z.array(z.string()),

    // Investor-specific
    investorCriteria: InvestorCriteriaSchema.optional(),
  }),

  // Timeline
  timeline: z.object({
    urgency: UrgencySchema,
    mustSettleBefore: z.string().datetime().optional(),
    idealSettlement: z.string().optional(),
  }),

  // Communication
  communication: z.object({
    preferredMethod: BriefContactMethodSchema.optional(),
    updateFrequency: UpdateFrequencySchema.optional(),
    bestTimeToCall: z.string().optional(),
    partnerName: z.string().optional(),
    partnerPhone: z.string().optional(),
    partnerEmail: z.string().email().optional(),
  }),

  // Legal team
  solicitor: SolicitorSchema.optional(),

  // Metadata
  briefVersion: z.number().int().positive().default(1),
  clientSignedOff: z.boolean().default(false),
  signedOffAt: z.string().datetime().optional(),

  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ClientBrief = z.infer<typeof ClientBriefSchema>;

// ─── Create Client Brief ───────────────────────────────────────────
export const CreateClientBriefSchema = ClientBriefSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  briefVersion: true,
  signedOffAt: true,
});
export type CreateClientBrief = z.infer<typeof CreateClientBriefSchema>;

// ─── Update Client Brief ───────────────────────────────────────────
export const UpdateClientBriefSchema = CreateClientBriefSchema.partial();
export type UpdateClientBrief = z.infer<typeof UpdateClientBriefSchema>;
