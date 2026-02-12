import { describe, it, expect } from 'vitest';
import { PipelineMigrationEngine } from './pipeline-migration';
import type { MigrationContext, MigrationDecision } from './pipeline-migration';
import type { BuyerProfile } from '@realflow/shared';

describe('PipelineMigrationEngine', () => {
  describe('determineTargetStage', () => {
    it('should map settled stage to settled-nurture', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'settled',
        isSettled: true,
        hasClientBrief: false,
        briefIsSigned: false,
        hasProperty: false,
        hasOffer: false,
        hasContract: false,
        hasRetainerPaid: false,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('settled-nurture');
      expect(decision.confidence).toBe('high');
      expect(decision.requiresBriefCreation).toBe(false);
      expect(decision.reason).toContain('settled');
    });

    it('should map under-contract with contract details to under-contract', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'under-contract',
        isSettled: false,
        hasClientBrief: true,
        briefIsSigned: true,
        hasProperty: true,
        propertyId: 'prop-1',
        hasOffer: true,
        offerStatus: 'accepted',
        hasContract: true,
        contractPrice: 850000,
        exchangeDate: '2024-01-15T00:00:00Z',
        settlementDate: '2024-02-15T00:00:00Z',
        hasRetainerPaid: true,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('under-contract');
      expect(decision.confidence).toBe('high');
      expect(decision.warnings).toHaveLength(0);
    });

    it('should warn when under-contract but missing contract details', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'under-contract',
        isSettled: false,
        hasClientBrief: true,
        briefIsSigned: true,
        hasProperty: true,
        hasOffer: false,
        hasContract: false, // Missing contract
        hasRetainerPaid: true,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('under-contract');
      expect(decision.confidence).toBe('medium');
      expect(decision.warnings.length).toBeGreaterThan(0);
      expect(decision.warnings.some((w) => w.includes('no contract record'))).toBe(true);
    });

    it('should map accepted offer to under-contract', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'offer-made',
        isSettled: false,
        hasClientBrief: true,
        briefIsSigned: true,
        hasProperty: true,
        propertyId: 'prop-1',
        hasOffer: true,
        offerStatus: 'accepted',
        hasContract: false,
        hasRetainerPaid: true,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('under-contract');
      expect(decision.confidence).toBe('high');
      expect(decision.warnings.some((w) => w.includes('not yet under contract'))).toBe(true);
    });

    it('should map active offer to offer-negotiate', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'offer-made',
        isSettled: false,
        hasClientBrief: true,
        briefIsSigned: true,
        hasProperty: true,
        propertyId: 'prop-1',
        hasOffer: true,
        offerStatus: 'submitted',
        hasContract: false,
        hasRetainerPaid: true,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('offer-negotiate');
      expect(decision.confidence).toBe('high');
      expect(decision.reason).toContain('submitted');
    });

    it('should map property selected to offer-negotiate and require brief creation if missing', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'property-shortlisted',
        isSettled: false,
        hasClientBrief: false, // No brief
        briefIsSigned: false,
        hasProperty: true,
        propertyId: 'prop-1',
        hasOffer: false,
        hasContract: false,
        hasRetainerPaid: false,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('offer-negotiate');
      expect(decision.requiresBriefCreation).toBe(true);
      expect(decision.warnings.some((w) => w.includes('No client brief'))).toBe(true);
    });

    it('should map signed brief to active-search', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'active-search',
        isSettled: false,
        hasClientBrief: true,
        clientBriefId: 'brief-1',
        briefIsSigned: true,
        hasProperty: false,
        hasOffer: false,
        hasContract: false,
        hasRetainerPaid: true,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('active-search');
      expect(decision.confidence).toBe('high');
      expect(decision.requiresBriefCreation).toBe(false);
    });

    it('should map unsigned brief to strategy-brief', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'qualified-lead',
        isSettled: false,
        hasClientBrief: true,
        clientBriefId: 'brief-1',
        briefIsSigned: false,
        hasProperty: false,
        hasOffer: false,
        hasContract: false,
        hasRetainerPaid: true,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('strategy-brief');
      expect(decision.confidence).toBe('high');
      expect(decision.reason).toContain('not signed off');
    });

    it('should map retainer paid to engaged', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'qualified-lead',
        isSettled: false,
        hasClientBrief: false,
        briefIsSigned: false,
        hasProperty: false,
        hasOffer: false,
        hasContract: false,
        hasRetainerPaid: true,
        retainerPaidDate: '2024-01-10T00:00:00Z',
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('engaged');
      expect(decision.confidence).toBe('high');
      expect(decision.warnings.some((w) => w.includes('no client brief'))).toBe(true);
    });

    it('should map qualified-lead with buyer profile to consult-qualify', () => {
      const buyerProfile: BuyerProfile = {
        budgetMin: 600000,
        budgetMax: 800000,
        preApproved: true,
        preApprovalAmount: 750000,
        propertyTypes: ['house', 'townhouse'],
        bedrooms: { min: 3, max: 4 },
        bathrooms: { min: 2 },
        carSpaces: { min: 2 },
        suburbs: ['Balmain', 'Rozelle'],
        mustHaves: ['modern kitchen', 'outdoor space'],
        dealBreakers: ['on main road', 'no natural light'],
      };

      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'qualified-lead',
        isSettled: false,
        hasClientBrief: false,
        briefIsSigned: false,
        hasProperty: false,
        hasOffer: false,
        hasContract: false,
        hasRetainerPaid: false,
        buyerProfile,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('consult-qualify');
      expect(decision.confidence).toBe('high');
      expect(decision.reason).toContain('buyer profile');
    });

    it('should warn about incomplete buyer profile', () => {
      const buyerProfile: BuyerProfile = {
        budgetMin: 600000,
        budgetMax: 800000,
        preApproved: false,
        propertyTypes: [], // Missing
        bedrooms: { min: 0 },
        bathrooms: { min: 0 },
        carSpaces: { min: 0 },
        suburbs: [], // Missing
        mustHaves: [],
        dealBreakers: [],
      };

      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'qualified-lead',
        isSettled: false,
        hasClientBrief: false,
        briefIsSigned: false,
        hasProperty: false,
        hasOffer: false,
        hasContract: false,
        hasRetainerPaid: false,
        buyerProfile,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('consult-qualify');
      expect(decision.confidence).toBe('medium');
      expect(decision.warnings.length).toBeGreaterThan(0);
    });

    it('should map rejected offer back to active-search', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'offer-made',
        isSettled: false,
        hasClientBrief: true,
        briefIsSigned: true,
        hasProperty: true,
        hasOffer: true,
        offerStatus: 'rejected',
        hasContract: false,
        hasRetainerPaid: true,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('active-search');
      expect(decision.warnings.some((w) => w.includes('rejected'))).toBe(true);
    });

    it('should default to enquiry for minimal data', () => {
      const context: MigrationContext = {
        transactionId: '123',
        contactId: '456',
        currentStage: 'new-enquiry',
        isSettled: false,
        hasClientBrief: false,
        briefIsSigned: false,
        hasProperty: false,
        hasOffer: false,
        hasContract: false,
        hasRetainerPaid: false,
      };

      const decision = PipelineMigrationEngine.determineTargetStage(context);

      expect(decision.targetStage).toBe('enquiry');
      expect(decision.confidence).toBe('low');
      expect(decision.warnings.some((w) => w.includes('Minimal data'))).toBe(true);
    });
  });

  describe('generateBriefFromBuyerProfile', () => {
    it('should generate a valid brief from complete buyer profile', () => {
      const buyerProfile: BuyerProfile = {
        budgetMin: 600000,
        budgetMax: 800000,
        preApproved: true,
        preApprovalAmount: 750000,
        preApprovalExpiry: '2024-06-30T00:00:00Z',
        propertyTypes: ['house', 'townhouse'],
        bedrooms: { min: 3, max: 4 },
        bathrooms: { min: 2, max: 3 },
        carSpaces: { min: 2, max: 3 },
        suburbs: ['Balmain', 'Rozelle', 'Leichhardt'],
        mustHaves: ['modern kitchen', 'outdoor space', 'natural light'],
        dealBreakers: ['on main road', 'no natural light', 'north facing'],
      };

      const brief = PipelineMigrationEngine.generateBriefFromBuyerProfile(
        'contact-123',
        'transaction-456',
        buyerProfile,
        'user-789',
      );

      // Identity
      expect(brief.contact_id).toBe('contact-123');
      expect(brief.transaction_id).toBe('transaction-456');
      expect(brief.created_by).toBe('user-789');

      // Purchase context defaults
      expect(brief.purchase_type).toBe('owner_occupier');
      expect(brief.enquiry_type).toBe('home_buyer');

      // Budget
      expect(brief.budget_min).toBe(600000);
      expect(brief.budget_max).toBe(800000);
      expect(brief.stamp_duty_budgeted).toBe(false);

      // Finance
      expect(brief.pre_approved).toBe(true);
      expect(brief.pre_approval_amount).toBe(750000);
      expect(brief.pre_approval_expiry).toBe('2024-06-30T00:00:00Z');

      // Property requirements
      expect(brief.property_types).toEqual(['house', 'townhouse']);
      expect(brief.bedrooms_min).toBe(3);
      expect(brief.bedrooms_ideal).toBe(4);
      expect(brief.bathrooms_min).toBe(2);
      expect(brief.bathrooms_ideal).toBe(3);
      expect(brief.car_spaces_min).toBe(2);
      expect(brief.car_spaces_ideal).toBe(3);

      // Suburbs
      expect(brief.suburbs).toHaveLength(3);
      expect(brief.suburbs?.[0]).toMatchObject({
        suburb: 'Balmain',
        rank: 1,
      });

      // Preferences
      expect(brief.must_haves).toEqual(['modern kitchen', 'outdoor space', 'natural light']);
      expect(brief.deal_breakers).toEqual(['on main road', 'no natural light', 'north facing']);

      // Metadata
      expect(brief.brief_version).toBe(1);
      expect(brief.client_signed_off).toBe(false);
      expect(brief.is_deleted).toBe(false);

      // Timeline default
      expect(brief.urgency).toBe('3_6_months');
    });

    it('should handle minimal buyer profile with defaults', () => {
      const buyerProfile: BuyerProfile = {
        budgetMin: 500000,
        budgetMax: 700000,
        preApproved: false,
        propertyTypes: ['apartment'],
        bedrooms: { min: 2 },
        bathrooms: { min: 1 },
        carSpaces: { min: 1 },
        suburbs: [],
        mustHaves: [],
        dealBreakers: [],
      };

      const brief = PipelineMigrationEngine.generateBriefFromBuyerProfile(
        'contact-123',
        'transaction-456',
        buyerProfile,
        'user-789',
      );

      expect(brief.budget_min).toBe(500000);
      expect(brief.budget_max).toBe(700000);
      expect(brief.pre_approved).toBe(false);
      expect(brief.pre_approval_amount).toBe(null);
      expect(brief.suburbs).toEqual([]);
      expect(brief.must_haves).toEqual([]);
      expect(brief.deal_breakers).toEqual([]);
      expect(brief.bedrooms_ideal).toBe(null);
      expect(brief.bathrooms_ideal).toBe(null);
    });

    it('should rank suburbs in order', () => {
      const buyerProfile: BuyerProfile = {
        budgetMin: 600000,
        budgetMax: 800000,
        preApproved: false,
        propertyTypes: ['house'],
        bedrooms: { min: 3 },
        bathrooms: { min: 2 },
        carSpaces: { min: 2 },
        suburbs: ['First Suburb', 'Second Suburb', 'Third Suburb'],
        mustHaves: [],
        dealBreakers: [],
      };

      const brief = PipelineMigrationEngine.generateBriefFromBuyerProfile(
        'contact-123',
        'transaction-456',
        buyerProfile,
        'user-789',
      );

      expect(brief.suburbs?.[0].rank).toBe(1);
      expect(brief.suburbs?.[1].rank).toBe(2);
      expect(brief.suburbs?.[2].rank).toBe(3);
    });
  });

  describe('generateBriefCompletionWarnings', () => {
    it('should generate warnings for incomplete profile', () => {
      const buyerProfile: BuyerProfile = {
        budgetMin: 600000,
        budgetMax: 800000,
        preApproved: false,
        propertyTypes: [],
        bedrooms: { min: 0 },
        bathrooms: { min: 0 },
        carSpaces: { min: 0 },
        suburbs: [],
        mustHaves: [],
        dealBreakers: [],
      };

      const warnings = PipelineMigrationEngine.generateBriefCompletionWarnings(buyerProfile);

      expect(warnings.length).toBeGreaterThan(5);
      expect(warnings.some((w) => w.includes('Auto-generated brief'))).toBe(true);
      expect(warnings.some((w) => w.includes('Suburb preferences are missing'))).toBe(true);
      expect(warnings.some((w) => w.includes('Property type preferences are missing'))).toBe(true);
      expect(warnings.some((w) => w.includes('Finance pre-approval'))).toBe(true);
    });

    it('should still generate base warnings for complete profile', () => {
      const buyerProfile: BuyerProfile = {
        budgetMin: 600000,
        budgetMax: 800000,
        preApproved: true,
        preApprovalAmount: 750000,
        propertyTypes: ['house'],
        bedrooms: { min: 3 },
        bathrooms: { min: 2 },
        carSpaces: { min: 2 },
        suburbs: ['Balmain'],
        mustHaves: ['modern kitchen'],
        dealBreakers: [],
      };

      const warnings = PipelineMigrationEngine.generateBriefCompletionWarnings(buyerProfile);

      // Should still warn about needing to complete suburb data (state/postcode)
      expect(warnings.some((w) => w.includes('state and postcode'))).toBe(true);
      // Should warn about communication preferences
      expect(warnings.some((w) => w.includes('Communication preferences'))).toBe(true);
      // Should warn about solicitor
      expect(warnings.some((w) => w.includes('Solicitor details'))).toBe(true);
    });
  });
});
