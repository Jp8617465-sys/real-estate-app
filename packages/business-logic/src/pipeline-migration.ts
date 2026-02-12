import type {
  BuyerStage,
  BuyersAgentStage,
  BuyerProfile,
  PropertyType,
} from '@realflow/shared';
import type { ClientBriefDbRow } from './client-brief-transformer';

// ─── Migration Context ──────────────────────────────────────────────

/**
 * Complete context about a buyer pipeline transaction needed for migration decisions.
 * Aggregates data from transactions, contacts, briefs, properties, and contracts.
 */
export interface MigrationContext {
  transactionId: string;
  contactId: string;
  currentStage: BuyerStage;

  // Related data - client brief
  hasClientBrief: boolean;
  clientBriefId?: string;
  briefIsSigned: boolean;

  // Related data - property
  hasProperty: boolean;
  propertyId?: string;

  // Related data - offer
  hasOffer: boolean;
  offerStatus?: 'preparing' | 'submitted' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';

  // Related data - contract
  hasContract: boolean;
  contractPrice?: number;
  exchangeDate?: string;
  settlementDate?: string;
  isSettled: boolean;

  // Related data - retainer payment
  hasRetainerPaid: boolean;
  retainerPaidDate?: string;

  // Buyer profile from contacts.buyer_profile JSONB
  buyerProfile?: BuyerProfile;
}

// ─── Migration Decision ─────────────────────────────────────────────

/**
 * Decision output from the migration engine indicating target stage and required actions.
 */
export interface MigrationDecision {
  targetStage: BuyersAgentStage;
  requiresBriefCreation: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

// ─── Pipeline Migration Engine ──────────────────────────────────────

/**
 * Business logic engine for migrating buyer pipeline transactions to buyers-agent pipeline.
 * Implements the complete stage mapping and brief generation logic.
 */
export class PipelineMigrationEngine {
  /**
   * Determine the appropriate target stage in buyers-agent pipeline based on transaction context.
   *
   * This implements the complete stage mapping logic:
   * - settled → settled-nurture (terminal)
   * - under-contract → under-contract
   * - Accepted offer → under-contract
   * - Active offer OR property selected → offer-negotiate (with brief creation)
   * - Signed brief → active-search
   * - Unsigned brief → strategy-brief
   * - Retainer paid → engaged
   * - qualified-lead + buyer_profile → consult-qualify
   * - Default → enquiry
   *
   * @param context Complete migration context with all related data
   * @returns Migration decision with target stage, warnings, and confidence
   */
  static determineTargetStage(context: MigrationContext): MigrationDecision {
    const warnings: string[] = [];
    let requiresBriefCreation = false;

    // ──────────────────────────────────────────────────────────────────
    // RULE 1: Terminal stage - settled
    // ──────────────────────────────────────────────────────────────────
    if (context.currentStage === 'settled' || context.isSettled) {
      return {
        targetStage: 'settled-nurture',
        requiresBriefCreation: false,
        reason: 'Transaction is complete (settled). Moved to post-settlement nurture stage.',
        confidence: 'high',
        warnings: [],
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 2: Under contract stage
    // ──────────────────────────────────────────────────────────────────
    if (context.currentStage === 'under-contract') {
      if (!context.hasContract) {
        warnings.push('Stage is under-contract but no contract record found. Verify contract details.');
      }
      if (!context.exchangeDate) {
        warnings.push('Missing exchange date. Add contract details to track key dates.');
      }
      if (!context.settlementDate) {
        warnings.push('Missing settlement date. Add contract details to track key dates.');
      }

      return {
        targetStage: 'under-contract',
        requiresBriefCreation: false,
        reason: 'Contracts exchanged. Between exchange and settlement.',
        confidence: context.hasContract ? 'high' : 'medium',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 3: Accepted offer (but not yet under contract) → under-contract
    // ──────────────────────────────────────────────────────────────────
    if (context.hasOffer && context.offerStatus === 'accepted') {
      warnings.push('Offer accepted but not yet under contract. Follow up on contract exchange.');

      return {
        targetStage: 'under-contract',
        requiresBriefCreation: false,
        reason: 'Offer has been accepted. Awaiting contract exchange.',
        confidence: 'high',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 4: Offer made/rejected → revert to appropriate stage (check before property selected rule)
    // ──────────────────────────────────────────────────────────────────
    if (context.currentStage === 'offer-made') {
      if (context.offerStatus === 'rejected' || context.offerStatus === 'withdrawn') {
        warnings.push('Previous offer rejected/withdrawn. Returning to active search.');

        return {
          targetStage: 'active-search',
          requiresBriefCreation: !context.hasClientBrief,
          reason: 'Offer unsuccessful. Back to searching.',
          confidence: 'high',
          warnings,
        };
      }

      // Active offer statuses
      if (context.offerStatus && ['preparing', 'submitted', 'countered'].includes(context.offerStatus)) {
        return {
          targetStage: 'offer-negotiate',
          requiresBriefCreation: !context.hasClientBrief,
          reason: `Offer ${context.offerStatus}. Negotiating terms.`,
          confidence: 'high',
          warnings,
        };
      }

      // Offer status unclear
      warnings.push('Offer made but status unclear. Defaulting to offer-negotiate stage.');

      return {
        targetStage: 'offer-negotiate',
        requiresBriefCreation: !context.hasClientBrief,
        reason: 'Offer has been made. Negotiating terms.',
        confidence: 'low',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 5: Active offer OR property selected → offer-negotiate
    // ──────────────────────────────────────────────────────────────────
    if (
      context.hasProperty ||
      context.currentStage === 'property-shortlisted' ||
      context.currentStage === 'due-diligence' ||
      (context.hasOffer && ['preparing', 'submitted', 'countered'].includes(context.offerStatus ?? ''))
    ) {
      // Check if brief exists - if not, flag for creation
      if (!context.hasClientBrief) {
        requiresBriefCreation = true;
        warnings.push('No client brief found. One will be auto-generated from buyer profile.');
      }

      if (context.hasOffer) {
        return {
          targetStage: 'offer-negotiate',
          requiresBriefCreation,
          reason: `Active offer (${context.offerStatus}). Negotiating with vendor or agent.`,
          confidence: 'high',
          warnings,
        };
      }

      return {
        targetStage: 'offer-negotiate',
        requiresBriefCreation,
        reason: 'Property identified or shortlisted. Ready to make offer.',
        confidence: 'medium',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 6: Signed brief → active-search
    // ──────────────────────────────────────────────────────────────────
    if (context.hasClientBrief && context.briefIsSigned) {
      return {
        targetStage: 'active-search',
        requiresBriefCreation: false,
        reason: 'Client brief signed off. Actively searching for properties.',
        confidence: 'high',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 7: Unsigned brief → strategy-brief
    // ──────────────────────────────────────────────────────────────────
    if (context.hasClientBrief && !context.briefIsSigned) {
      return {
        targetStage: 'strategy-brief',
        requiresBriefCreation: false,
        reason: 'Client brief exists but not signed off. Finalizing strategy and brief.',
        confidence: 'high',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 8: Retainer paid → engaged
    // ──────────────────────────────────────────────────────────────────
    if (context.hasRetainerPaid) {
      warnings.push('Retainer paid but no client brief found. Create brief to progress pipeline.');

      return {
        targetStage: 'engaged',
        requiresBriefCreation: false,
        reason: 'Retainer paid. Engagement agreement in place.',
        confidence: 'high',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 9: Active search with no brief
    // ──────────────────────────────────────────────────────────────────
    if (context.currentStage === 'active-search') {
      // This is an edge case - they're searching without proper onboarding
      if (!context.hasClientBrief) {
        requiresBriefCreation = true;
        warnings.push('In active search but no brief found. Brief will be auto-generated to formalize requirements.');
      }

      return {
        targetStage: 'active-search',
        requiresBriefCreation,
        reason: 'Currently searching for properties. Brief may need completion.',
        confidence: 'medium',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // RULE 10: Qualified lead with buyer profile → consult-qualify
    // ──────────────────────────────────────────────────────────────────
    if (context.currentStage === 'qualified-lead' && context.buyerProfile) {
      const profileWarnings = this.validateBuyerProfile(context.buyerProfile);
      warnings.push(...profileWarnings);

      return {
        targetStage: 'consult-qualify',
        requiresBriefCreation: false,
        reason: 'Lead is qualified with buyer profile. Ready for consultation.',
        confidence: profileWarnings.length === 0 ? 'high' : 'medium',
        warnings,
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // DEFAULT: Early stage enquiry
    // ──────────────────────────────────────────────────────────────────
    warnings.push('Minimal data available. Defaulting to enquiry stage. Review and progress manually if needed.');

    return {
      targetStage: 'enquiry',
      requiresBriefCreation: false,
      reason: 'New or unqualified enquiry. Initial contact stage.',
      confidence: 'low',
      warnings,
    };
  }

  /**
   * Validate buyer profile completeness and quality.
   * Returns array of warnings if profile is incomplete or has issues.
   *
   * @param profile Buyer profile from contacts.buyer_profile JSONB
   * @returns Array of warning messages
   */
  private static validateBuyerProfile(profile: BuyerProfile): string[] {
    const warnings: string[] = [];

    if (!profile.budgetMin || !profile.budgetMax) {
      warnings.push('Buyer profile missing budget range. Complete budget to improve confidence.');
    }

    if (profile.budgetMin > profile.budgetMax) {
      warnings.push('Buyer profile has invalid budget range (min > max). Correct budget values.');
    }

    if (!profile.suburbs || profile.suburbs.length === 0) {
      warnings.push('Buyer profile missing preferred suburbs. Add location preferences.');
    }

    if (!profile.propertyTypes || profile.propertyTypes.length === 0) {
      warnings.push('Buyer profile missing property types. Specify property preferences.');
    }

    if (profile.bedrooms.min === undefined && profile.bedrooms.max === undefined) {
      warnings.push('Buyer profile missing bedroom requirements. Add property size preferences.');
    }

    return warnings;
  }

  /**
   * Generate a client brief from buyer profile JSONB data.
   * Transforms the lightweight buyer profile into a comprehensive client brief.
   *
   * @param contactId UUID of the contact
   * @param transactionId UUID of the transaction
   * @param buyerProfile Buyer profile JSONB from contacts table
   * @param createdBy UUID of user creating the brief
   * @returns Partial client brief database row ready for insertion
   */
  static generateBriefFromBuyerProfile(
    contactId: string,
    transactionId: string,
    buyerProfile: BuyerProfile,
    createdBy: string,
  ): Partial<ClientBriefDbRow> {
    // Transform suburbs array from buyer profile into full SuburbPreference format
    const suburbs =
      buyerProfile.suburbs?.map((suburb, index) => ({
        suburb,
        state: '', // Unknown - will need manual completion
        postcode: '', // Unknown - will need manual completion
        rank: index + 1,
        notes: undefined,
      })) ?? [];

    // Transform property types from buyer profile
    const propertyTypes: PropertyType[] = buyerProfile.propertyTypes ?? [];

    // Extract bedroom/bathroom/car space requirements
    const bedroomsMin = buyerProfile.bedrooms?.min ?? 0;
    const bathroomsMin = buyerProfile.bathrooms?.min ?? 0;
    const carSpacesMin = buyerProfile.carSpaces?.min ?? 0;

    // Build the brief object with database schema structure
    const brief: Partial<ClientBriefDbRow> = {
      // Identity
      contact_id: contactId,
      transaction_id: transactionId,

      // Purchase context - defaults
      purchase_type: 'owner_occupier', // Default assumption
      enquiry_type: 'home_buyer', // Default assumption

      // Budget (required fields)
      budget_min: buyerProfile.budgetMin ?? 0,
      budget_max: buyerProfile.budgetMax ?? 0,
      budget_absolute_max: null,
      stamp_duty_budgeted: false,

      // Finance (extract from buyer profile if available)
      pre_approved: buyerProfile.preApproved ?? false,
      pre_approval_amount: buyerProfile.preApprovalAmount ?? null,
      pre_approval_expiry: buyerProfile.preApprovalExpiry ?? null,
      lender: null,
      broker_name: null,
      broker_phone: null,
      broker_email: null,
      deposit_available: null,
      first_home_buyer: false, // Unknown - will need manual input

      // Requirements - Property details
      property_types: propertyTypes,
      bedrooms_min: bedroomsMin,
      bedrooms_ideal: buyerProfile.bedrooms?.max ?? null,
      bathrooms_min: bathroomsMin,
      bathrooms_ideal: buyerProfile.bathrooms?.max ?? null,
      car_spaces_min: carSpacesMin,
      car_spaces_ideal: buyerProfile.carSpaces?.max ?? null,
      land_size_min: null,
      land_size_max: null,
      building_age_min: null,
      building_age_max: null,

      // Requirements - Location
      suburbs: suburbs,
      max_commute: null,
      school_zones: null,

      // Requirements - Preferences
      must_haves: buyerProfile.mustHaves ?? [],
      nice_to_haves: [],
      deal_breakers: buyerProfile.dealBreakers ?? [],

      // Requirements - Investor criteria (not applicable for auto-generated briefs)
      investor_criteria: null,

      // Timeline - defaults
      urgency: '3_6_months', // Default assumption
      must_settle_before: null,
      ideal_settlement: null,

      // Communication - all null (to be filled in)
      preferred_contact_method: null,
      update_frequency: null,
      best_time_to_call: null,
      partner_name: null,
      partner_phone: null,
      partner_email: null,

      // Solicitor - all null (to be filled in)
      solicitor_firm: null,
      solicitor_contact: null,
      solicitor_phone: null,
      solicitor_email: null,

      // Metadata
      brief_version: 1,
      client_signed_off: false, // Auto-generated briefs are not signed off
      signed_off_at: null,

      // Audit
      created_by: createdBy,
      // Note: created_at, updated_at will be set by database defaults

      // Soft delete
      is_deleted: false,
      deleted_at: null,
    };

    return brief;
  }

  /**
   * Generate warnings/notes about auto-generated brief quality.
   * These should be displayed to the user to highlight fields needing review.
   *
   * @param buyerProfile Source buyer profile
   * @returns Array of warning/review messages
   */
  static generateBriefCompletionWarnings(buyerProfile: BuyerProfile): string[] {
    const warnings: string[] = [
      'Auto-generated brief from buyer profile. Review and complete missing details.',
    ];

    // Check for missing critical data
    if (!buyerProfile.suburbs || buyerProfile.suburbs.length === 0) {
      warnings.push('Suburb preferences are missing. Add specific suburbs with state and postcode.');
    } else {
      warnings.push('Suburb data needs state and postcode completion.');
    }

    if (!buyerProfile.propertyTypes || buyerProfile.propertyTypes.length === 0) {
      warnings.push('Property type preferences are missing. Specify house/unit/townhouse preferences.');
    }

    if (!buyerProfile.preApproved) {
      warnings.push('Finance pre-approval status unknown. Verify finance position with client.');
    }

    warnings.push('Communication preferences need to be set (preferred method, update frequency).');
    warnings.push('Solicitor details need to be added for contract preparation.');
    warnings.push('Purchase type (owner occupier/investor) needs verification.');
    warnings.push('Timeline urgency needs confirmation with client.');

    return warnings;
  }
}
