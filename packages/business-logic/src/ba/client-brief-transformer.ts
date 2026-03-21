import type {
  ClientBrief,
  SuburbPreference,
  MaxCommute,
  InvestorCriteria,
  PropertyType,
  PurchaseType,
  EnquiryType,
  Urgency,
  BriefContactMethod,
  UpdateFrequency,
} from '@realflow/shared';

/**
 * Database row interface for client_briefs table.
 * Represents the flat/JSONB schema with exact snake_case column names.
 */
export interface ClientBriefDbRow {
  // Identity
  id: string;
  contact_id: string;
  transaction_id: string | null;

  // Purchase context
  purchase_type: PurchaseType;
  enquiry_type: EnquiryType;

  // Budget (flat columns)
  budget_min: number;
  budget_max: number;
  budget_absolute_max: number | null;
  stamp_duty_budgeted: boolean;

  // Finance (flat columns)
  pre_approved: boolean;
  pre_approval_amount: number | null;
  pre_approval_expiry: string | null; // TIMESTAMPTZ → ISO string
  lender: string | null;
  broker_name: string | null;
  broker_phone: string | null;
  broker_email: string | null;
  deposit_available: number | null;
  first_home_buyer: boolean;

  // Requirements - Property details (flat columns)
  property_types: PropertyType[]; // TEXT[] array
  bedrooms_min: number;
  bedrooms_ideal: number | null;
  bathrooms_min: number;
  bathrooms_ideal: number | null;
  car_spaces_min: number;
  car_spaces_ideal: number | null;
  land_size_min: number | null;
  land_size_max: number | null;
  building_age_min: number | null;
  building_age_max: number | null;

  // Requirements - Location (JSONB + arrays)
  suburbs: SuburbPreference[]; // JSONB
  max_commute: MaxCommute | null; // JSONB
  school_zones: string[] | null; // TEXT[] array

  // Requirements - Preferences (arrays)
  must_haves: string[]; // TEXT[] array
  nice_to_haves: string[]; // TEXT[] array
  deal_breakers: string[]; // TEXT[] array

  // Requirements - Investor criteria (JSONB)
  investor_criteria: InvestorCriteria | null; // JSONB

  // Timeline (flat columns)
  urgency: Urgency;
  must_settle_before: string | null; // TIMESTAMPTZ → ISO string
  ideal_settlement: string | null;

  // Communication (flat columns)
  preferred_contact_method: BriefContactMethod | null;
  update_frequency: UpdateFrequency | null;
  best_time_to_call: string | null;
  partner_name: string | null;
  partner_phone: string | null;
  partner_email: string | null;

  // Solicitor (flat columns)
  solicitor_firm: string | null;
  solicitor_contact: string | null;
  solicitor_phone: string | null;
  solicitor_email: string | null;

  // Metadata
  brief_version: number;
  client_signed_off: boolean;
  signed_off_at: string | null; // TIMESTAMPTZ → ISO string

  // Soft delete
  is_deleted: boolean;
  deleted_at: string | null; // TIMESTAMPTZ → ISO string

  created_by: string;
  created_at: string; // TIMESTAMPTZ → ISO string
  updated_at: string; // TIMESTAMPTZ → ISO string
}

/**
 * Transform nested Zod schema (ClientBrief) to flat database schema (ClientBriefDbRow).
 * Flattens nested objects and converts camelCase to snake_case.
 */
export function toDbSchema(brief: ClientBrief): ClientBriefDbRow {
  return {
    // Identity
    id: brief.id,
    contact_id: brief.contactId,
    transaction_id: brief.transactionId ?? null,

    // Purchase context
    purchase_type: brief.purchaseType,
    enquiry_type: brief.enquiryType,

    // Budget
    budget_min: brief.budget.min,
    budget_max: brief.budget.max,
    budget_absolute_max: brief.budget.absoluteMax ?? null,
    stamp_duty_budgeted: brief.budget.stampDutyBudgeted,

    // Finance
    pre_approved: brief.finance.preApproved,
    pre_approval_amount: brief.finance.preApprovalAmount ?? null,
    pre_approval_expiry: brief.finance.preApprovalExpiry ?? null,
    lender: brief.finance.lender ?? null,
    broker_name: brief.finance.brokerName ?? null,
    broker_phone: brief.finance.brokerPhone ?? null,
    broker_email: brief.finance.brokerEmail ?? null,
    deposit_available: brief.finance.depositAvailable ?? null,
    first_home_buyer: brief.finance.firstHomeBuyer,

    // Requirements - Property details
    property_types: brief.requirements.propertyTypes,
    bedrooms_min: brief.requirements.bedrooms.min,
    bedrooms_ideal: brief.requirements.bedrooms.ideal ?? null,
    bathrooms_min: brief.requirements.bathrooms.min,
    bathrooms_ideal: brief.requirements.bathrooms.ideal ?? null,
    car_spaces_min: brief.requirements.carSpaces.min,
    car_spaces_ideal: brief.requirements.carSpaces.ideal ?? null,
    land_size_min: brief.requirements.landSize?.min ?? null,
    land_size_max: brief.requirements.landSize?.max ?? null,
    building_age_min: brief.requirements.buildingAge?.min ?? null,
    building_age_max: brief.requirements.buildingAge?.max ?? null,

    // Requirements - Location (JSONB preserved)
    suburbs: brief.requirements.suburbs,
    max_commute: brief.requirements.maxCommute ?? null,
    school_zones: brief.requirements.schoolZones ?? null,

    // Requirements - Preferences
    must_haves: brief.requirements.mustHaves,
    nice_to_haves: brief.requirements.niceToHaves,
    deal_breakers: brief.requirements.dealBreakers,

    // Requirements - Investor criteria
    investor_criteria: brief.requirements.investorCriteria ?? null,

    // Timeline
    urgency: brief.timeline.urgency,
    must_settle_before: brief.timeline.mustSettleBefore ?? null,
    ideal_settlement: brief.timeline.idealSettlement ?? null,

    // Communication
    preferred_contact_method: brief.communication.preferredMethod ?? null,
    update_frequency: brief.communication.updateFrequency ?? null,
    best_time_to_call: brief.communication.bestTimeToCall ?? null,
    partner_name: brief.communication.partnerName ?? null,
    partner_phone: brief.communication.partnerPhone ?? null,
    partner_email: brief.communication.partnerEmail ?? null,

    // Solicitor (flatten optional nested object)
    solicitor_firm: brief.solicitor?.firmName ?? null,
    solicitor_contact: brief.solicitor?.contactName ?? null,
    solicitor_phone: brief.solicitor?.phone ?? null,
    solicitor_email: brief.solicitor?.email ?? null,

    // Metadata
    brief_version: brief.briefVersion,
    client_signed_off: brief.clientSignedOff,
    signed_off_at: brief.signedOffAt ?? null,

    // Soft delete (always false/null for writes from application layer)
    is_deleted: false,
    deleted_at: null,

    created_by: brief.createdBy,
    created_at: brief.createdAt,
    updated_at: brief.updatedAt,
  };
}

/**
 * Transform flat database schema (ClientBriefDbRow) to nested Zod schema (ClientBrief).
 * Reconstructs nested objects from flat columns and converts snake_case to camelCase.
 */
export function fromDbSchema(row: ClientBriefDbRow): ClientBrief {
  return {
    // Identity
    id: row.id,
    contactId: row.contact_id,
    transactionId: row.transaction_id ?? undefined,

    // Purchase context
    purchaseType: row.purchase_type,
    enquiryType: row.enquiry_type,

    // Budget (nested object)
    budget: {
      min: row.budget_min,
      max: row.budget_max,
      absoluteMax: row.budget_absolute_max ?? undefined,
      stampDutyBudgeted: row.stamp_duty_budgeted,
    },

    // Finance (nested object)
    finance: {
      preApproved: row.pre_approved,
      preApprovalAmount: row.pre_approval_amount ?? undefined,
      preApprovalExpiry: row.pre_approval_expiry ?? undefined,
      lender: row.lender ?? undefined,
      brokerName: row.broker_name ?? undefined,
      brokerPhone: row.broker_phone ?? undefined,
      brokerEmail: row.broker_email ?? undefined,
      depositAvailable: row.deposit_available ?? undefined,
      firstHomeBuyer: row.first_home_buyer,
    },

    // Requirements (nested object)
    requirements: {
      // Property details
      propertyTypes: row.property_types,
      bedrooms: {
        min: row.bedrooms_min,
        ideal: row.bedrooms_ideal ?? undefined,
      },
      bathrooms: {
        min: row.bathrooms_min,
        ideal: row.bathrooms_ideal ?? undefined,
      },
      carSpaces: {
        min: row.car_spaces_min,
        ideal: row.car_spaces_ideal ?? undefined,
      },
      // Optional nested objects - only include if at least one field has a value
      landSize:
        row.land_size_min !== null || row.land_size_max !== null
          ? {
              min: row.land_size_min ?? undefined,
              max: row.land_size_max ?? undefined,
            }
          : undefined,
      buildingAge:
        row.building_age_min !== null || row.building_age_max !== null
          ? {
              min: row.building_age_min ?? undefined,
              max: row.building_age_max ?? undefined,
            }
          : undefined,
      // Location (JSONB preserved)
      suburbs: row.suburbs,
      maxCommute: row.max_commute ?? undefined,
      schoolZones: row.school_zones ?? undefined,
      // Preferences
      mustHaves: row.must_haves,
      niceToHaves: row.nice_to_haves,
      dealBreakers: row.deal_breakers,
      // Investor criteria
      investorCriteria: row.investor_criteria ?? undefined,
    },

    // Timeline (nested object)
    timeline: {
      urgency: row.urgency,
      mustSettleBefore: row.must_settle_before ?? undefined,
      idealSettlement: row.ideal_settlement ?? undefined,
    },

    // Communication (nested object)
    communication: {
      preferredMethod: row.preferred_contact_method ?? undefined,
      updateFrequency: row.update_frequency ?? undefined,
      bestTimeToCall: row.best_time_to_call ?? undefined,
      partnerName: row.partner_name ?? undefined,
      partnerPhone: row.partner_phone ?? undefined,
      partnerEmail: row.partner_email ?? undefined,
    },

    // Solicitor (optional nested object - only include if at least one field has a value)
    solicitor:
      row.solicitor_firm !== null ||
      row.solicitor_contact !== null ||
      row.solicitor_phone !== null ||
      row.solicitor_email !== null
        ? {
            firmName: row.solicitor_firm ?? '',
            contactName: row.solicitor_contact ?? '',
            phone: row.solicitor_phone ?? '',
            email: row.solicitor_email ?? '',
          }
        : undefined,

    // Metadata
    briefVersion: row.brief_version,
    clientSignedOff: row.client_signed_off,
    signedOffAt: row.signed_off_at ?? undefined,

    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
