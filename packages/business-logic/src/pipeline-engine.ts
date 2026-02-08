import {
  BuyerStage,
  SellerStage,
  PipelineType,
  BUYER_STAGE_ORDER,
  SELLER_STAGE_ORDER,
  type Transaction,
  type StageTransition,
} from '@realflow/shared';

// ─── Valid Transitions ──────────────────────────────────────────────

const VALID_BUYER_TRANSITIONS: Record<BuyerStage, BuyerStage[]> = {
  'new-enquiry': ['qualified-lead'],
  'qualified-lead': ['active-search', 'new-enquiry'],
  'active-search': ['property-shortlisted', 'qualified-lead'],
  'property-shortlisted': ['due-diligence', 'active-search'],
  'due-diligence': ['offer-made', 'property-shortlisted', 'active-search'],
  'offer-made': ['under-contract', 'active-search', 'property-shortlisted'],
  'under-contract': ['settled', 'offer-made'],
  'settled': [],
};

const VALID_SELLER_TRANSITIONS: Record<SellerStage, SellerStage[]> = {
  'appraisal-request': ['listing-preparation'],
  'listing-preparation': ['on-market', 'appraisal-request'],
  'on-market': ['offers-negotiation', 'listing-preparation'],
  'offers-negotiation': ['under-contract', 'on-market'],
  'under-contract': ['settled', 'offers-negotiation'],
  'settled': [],
};

// ─── Stage Requirements ─────────────────────────────────────────────

export interface StageRequirement {
  field: string;
  label: string;
  required: boolean;
}

const BUYER_STAGE_REQUIREMENTS: Partial<Record<BuyerStage, StageRequirement[]>> = {
  'qualified-lead': [
    { field: 'buyerProfile.budgetMin', label: 'Minimum budget set', required: true },
    { field: 'buyerProfile.budgetMax', label: 'Maximum budget set', required: true },
    { field: 'buyerProfile.suburbs', label: 'Preferred suburbs added', required: true },
  ],
  'offer-made': [
    { field: 'offerAmount', label: 'Offer amount specified', required: true },
    { field: 'propertyId', label: 'Property selected', required: true },
  ],
  'under-contract': [
    { field: 'contractPrice', label: 'Contract price recorded', required: true },
    { field: 'exchangeDate', label: 'Exchange date set', required: true },
    { field: 'settlementDate', label: 'Settlement date set', required: true },
  ],
};

const SELLER_STAGE_REQUIREMENTS: Partial<Record<SellerStage, StageRequirement[]>> = {
  'listing-preparation': [
    { field: 'propertyId', label: 'Property linked', required: true },
  ],
  'on-market': [
    { field: 'listPrice', label: 'List price or guide set', required: true },
  ],
  'under-contract': [
    { field: 'contractPrice', label: 'Contract price recorded', required: true },
    { field: 'exchangeDate', label: 'Exchange date set', required: true },
    { field: 'settlementDate', label: 'Settlement date set', required: true },
  ],
};

// ─── Pipeline Engine ────────────────────────────────────────────────

export class PipelineEngine {
  /**
   * Check if a stage transition is valid.
   */
  static isValidTransition(
    pipelineType: PipelineType,
    fromStage: string,
    toStage: string,
  ): boolean {
    if (pipelineType === 'buying') {
      const validTargets = VALID_BUYER_TRANSITIONS[fromStage as BuyerStage];
      return validTargets?.includes(toStage as BuyerStage) ?? false;
    }

    const validTargets = VALID_SELLER_TRANSITIONS[fromStage as SellerStage];
    return validTargets?.includes(toStage as SellerStage) ?? false;
  }

  /**
   * Get valid next stages from the current stage.
   */
  static getValidNextStages(pipelineType: PipelineType, currentStage: string): string[] {
    if (pipelineType === 'buying') {
      return VALID_BUYER_TRANSITIONS[currentStage as BuyerStage] ?? [];
    }
    return VALID_SELLER_TRANSITIONS[currentStage as SellerStage] ?? [];
  }

  /**
   * Get requirements for entering a stage.
   */
  static getStageRequirements(
    pipelineType: PipelineType,
    stage: string,
  ): StageRequirement[] {
    if (pipelineType === 'buying') {
      return BUYER_STAGE_REQUIREMENTS[stage as BuyerStage] ?? [];
    }
    return SELLER_STAGE_REQUIREMENTS[stage as SellerStage] ?? [];
  }

  /**
   * Get the numeric order of a stage (for sorting/display).
   */
  static getStageOrder(pipelineType: PipelineType, stage: string): number {
    if (pipelineType === 'buying') {
      return BUYER_STAGE_ORDER[stage as BuyerStage] ?? 0;
    }
    return SELLER_STAGE_ORDER[stage as SellerStage] ?? 0;
  }

  /**
   * Check if a stage is a terminal stage (no forward transitions).
   */
  static isTerminalStage(pipelineType: PipelineType, stage: string): boolean {
    return this.getValidNextStages(pipelineType, stage).length === 0;
  }

  /**
   * Determine the initial stage for a pipeline type.
   */
  static getInitialStage(pipelineType: PipelineType): string {
    return pipelineType === 'buying' ? 'new-enquiry' : 'appraisal-request';
  }
}
