import { describe, it, expect } from 'vitest';
import { PipelineEngine } from './pipeline-engine';

// ─── isValidTransition (Buyer Pipeline) ────────────────────────────

describe('PipelineEngine.isValidTransition (buying)', () => {
  it('allows new-enquiry → qualified-lead', () => {
    expect(PipelineEngine.isValidTransition('buying', 'new-enquiry', 'qualified-lead')).toBe(true);
  });

  it('allows qualified-lead → active-search', () => {
    expect(PipelineEngine.isValidTransition('buying', 'qualified-lead', 'active-search')).toBe(true);
  });

  it('allows qualified-lead → new-enquiry (backward)', () => {
    expect(PipelineEngine.isValidTransition('buying', 'qualified-lead', 'new-enquiry')).toBe(true);
  });

  it('allows active-search → property-shortlisted', () => {
    expect(PipelineEngine.isValidTransition('buying', 'active-search', 'property-shortlisted')).toBe(true);
  });

  it('allows property-shortlisted → due-diligence', () => {
    expect(PipelineEngine.isValidTransition('buying', 'property-shortlisted', 'due-diligence')).toBe(true);
  });

  it('allows due-diligence → offer-made', () => {
    expect(PipelineEngine.isValidTransition('buying', 'due-diligence', 'offer-made')).toBe(true);
  });

  it('allows offer-made → under-contract', () => {
    expect(PipelineEngine.isValidTransition('buying', 'offer-made', 'under-contract')).toBe(true);
  });

  it('allows under-contract → settled', () => {
    expect(PipelineEngine.isValidTransition('buying', 'under-contract', 'settled')).toBe(true);
  });

  it('allows backward transitions (offer-made → active-search)', () => {
    expect(PipelineEngine.isValidTransition('buying', 'offer-made', 'active-search')).toBe(true);
  });

  it('allows under-contract → offer-made (backward)', () => {
    expect(PipelineEngine.isValidTransition('buying', 'under-contract', 'offer-made')).toBe(true);
  });

  it('rejects skipping stages (new-enquiry → active-search)', () => {
    expect(PipelineEngine.isValidTransition('buying', 'new-enquiry', 'active-search')).toBe(false);
  });

  it('rejects transitions from settled (terminal)', () => {
    expect(PipelineEngine.isValidTransition('buying', 'settled', 'under-contract')).toBe(false);
    expect(PipelineEngine.isValidTransition('buying', 'settled', 'new-enquiry')).toBe(false);
  });

  it('rejects invalid stage names', () => {
    expect(PipelineEngine.isValidTransition('buying', 'invalid', 'qualified-lead')).toBe(false);
    expect(PipelineEngine.isValidTransition('buying', 'new-enquiry', 'invalid')).toBe(false);
  });
});

// ─── isValidTransition (Seller Pipeline) ───────────────────────────

describe('PipelineEngine.isValidTransition (selling)', () => {
  it('allows appraisal-request → listing-preparation', () => {
    expect(PipelineEngine.isValidTransition('selling', 'appraisal-request', 'listing-preparation')).toBe(true);
  });

  it('allows listing-preparation → on-market', () => {
    expect(PipelineEngine.isValidTransition('selling', 'listing-preparation', 'on-market')).toBe(true);
  });

  it('allows on-market → offers-negotiation', () => {
    expect(PipelineEngine.isValidTransition('selling', 'on-market', 'offers-negotiation')).toBe(true);
  });

  it('allows offers-negotiation → under-contract', () => {
    expect(PipelineEngine.isValidTransition('selling', 'offers-negotiation', 'under-contract')).toBe(true);
  });

  it('allows under-contract → settled', () => {
    expect(PipelineEngine.isValidTransition('selling', 'under-contract', 'settled')).toBe(true);
  });

  it('allows backward transitions (on-market → listing-preparation)', () => {
    expect(PipelineEngine.isValidTransition('selling', 'on-market', 'listing-preparation')).toBe(true);
  });

  it('rejects transitions from settled (terminal)', () => {
    expect(PipelineEngine.isValidTransition('selling', 'settled', 'under-contract')).toBe(false);
  });

  it('rejects skipping stages (appraisal-request → on-market)', () => {
    expect(PipelineEngine.isValidTransition('selling', 'appraisal-request', 'on-market')).toBe(false);
  });
});

// ─── getValidNextStages ────────────────────────────────────────────

describe('PipelineEngine.getValidNextStages', () => {
  it('returns correct next stages for buyer new-enquiry', () => {
    expect(PipelineEngine.getValidNextStages('buying', 'new-enquiry')).toEqual(['qualified-lead']);
  });

  it('returns multiple valid targets for due-diligence', () => {
    const stages = PipelineEngine.getValidNextStages('buying', 'due-diligence');
    expect(stages).toContain('offer-made');
    expect(stages).toContain('property-shortlisted');
    expect(stages).toContain('active-search');
    expect(stages).toHaveLength(3);
  });

  it('returns empty for settled (terminal buyer stage)', () => {
    expect(PipelineEngine.getValidNextStages('buying', 'settled')).toEqual([]);
  });

  it('returns correct next stages for seller appraisal-request', () => {
    expect(PipelineEngine.getValidNextStages('selling', 'appraisal-request')).toEqual(['listing-preparation']);
  });

  it('returns empty for settled (terminal seller stage)', () => {
    expect(PipelineEngine.getValidNextStages('selling', 'settled')).toEqual([]);
  });

  it('returns empty for invalid stage', () => {
    expect(PipelineEngine.getValidNextStages('buying', 'nonexistent')).toEqual([]);
  });
});

// ─── getStageRequirements ──────────────────────────────────────────

describe('PipelineEngine.getStageRequirements', () => {
  it('returns requirements for buyer qualified-lead', () => {
    const reqs = PipelineEngine.getStageRequirements('buying', 'qualified-lead');
    expect(reqs.length).toBe(3);
    expect(reqs.map(r => r.field)).toContain('buyerProfile.budgetMin');
    expect(reqs.map(r => r.field)).toContain('buyerProfile.budgetMax');
    expect(reqs.map(r => r.field)).toContain('buyerProfile.suburbs');
  });

  it('returns requirements for buyer offer-made', () => {
    const reqs = PipelineEngine.getStageRequirements('buying', 'offer-made');
    expect(reqs.length).toBe(2);
    expect(reqs.map(r => r.field)).toContain('offerAmount');
    expect(reqs.map(r => r.field)).toContain('propertyId');
  });

  it('returns requirements for buyer under-contract', () => {
    const reqs = PipelineEngine.getStageRequirements('buying', 'under-contract');
    expect(reqs.length).toBe(3);
    expect(reqs.map(r => r.field)).toContain('contractPrice');
    expect(reqs.map(r => r.field)).toContain('exchangeDate');
    expect(reqs.map(r => r.field)).toContain('settlementDate');
  });

  it('returns empty for stages without requirements', () => {
    expect(PipelineEngine.getStageRequirements('buying', 'new-enquiry')).toEqual([]);
    expect(PipelineEngine.getStageRequirements('buying', 'active-search')).toEqual([]);
  });

  it('returns requirements for seller listing-preparation', () => {
    const reqs = PipelineEngine.getStageRequirements('selling', 'listing-preparation');
    expect(reqs.length).toBe(1);
    expect(reqs[0]!.field).toBe('propertyId');
  });

  it('returns requirements for seller on-market', () => {
    const reqs = PipelineEngine.getStageRequirements('selling', 'on-market');
    expect(reqs.length).toBe(1);
    expect(reqs[0]!.field).toBe('listPrice');
  });

  it('returns requirements for seller under-contract', () => {
    const reqs = PipelineEngine.getStageRequirements('selling', 'under-contract');
    expect(reqs.length).toBe(3);
  });

  it('returns empty for invalid stage', () => {
    expect(PipelineEngine.getStageRequirements('buying', 'nonexistent')).toEqual([]);
  });

  it('all requirements have required=true', () => {
    const reqs = PipelineEngine.getStageRequirements('buying', 'qualified-lead');
    for (const req of reqs) {
      expect(req.required).toBe(true);
    }
  });
});

// ─── getStageOrder ─────────────────────────────────────────────────

describe('PipelineEngine.getStageOrder', () => {
  it('returns correct order for buyer stages', () => {
    expect(PipelineEngine.getStageOrder('buying', 'new-enquiry')).toBe(1);
    expect(PipelineEngine.getStageOrder('buying', 'qualified-lead')).toBe(2);
    expect(PipelineEngine.getStageOrder('buying', 'active-search')).toBe(3);
    expect(PipelineEngine.getStageOrder('buying', 'property-shortlisted')).toBe(4);
    expect(PipelineEngine.getStageOrder('buying', 'due-diligence')).toBe(5);
    expect(PipelineEngine.getStageOrder('buying', 'offer-made')).toBe(6);
    expect(PipelineEngine.getStageOrder('buying', 'under-contract')).toBe(7);
    expect(PipelineEngine.getStageOrder('buying', 'settled')).toBe(8);
  });

  it('returns correct order for seller stages', () => {
    expect(PipelineEngine.getStageOrder('selling', 'appraisal-request')).toBe(1);
    expect(PipelineEngine.getStageOrder('selling', 'listing-preparation')).toBe(2);
    expect(PipelineEngine.getStageOrder('selling', 'on-market')).toBe(3);
    expect(PipelineEngine.getStageOrder('selling', 'offers-negotiation')).toBe(4);
    expect(PipelineEngine.getStageOrder('selling', 'under-contract')).toBe(5);
    expect(PipelineEngine.getStageOrder('selling', 'settled')).toBe(6);
  });

  it('returns 0 for unknown stages', () => {
    expect(PipelineEngine.getStageOrder('buying', 'nonexistent')).toBe(0);
    expect(PipelineEngine.getStageOrder('selling', 'nonexistent')).toBe(0);
  });
});

// ─── isTerminalStage ───────────────────────────────────────────────

describe('PipelineEngine.isTerminalStage', () => {
  it('returns true for buyer settled', () => {
    expect(PipelineEngine.isTerminalStage('buying', 'settled')).toBe(true);
  });

  it('returns true for seller settled', () => {
    expect(PipelineEngine.isTerminalStage('selling', 'settled')).toBe(true);
  });

  it('returns false for non-terminal buyer stages', () => {
    const nonTerminal = [
      'new-enquiry', 'qualified-lead', 'active-search',
      'property-shortlisted', 'due-diligence', 'offer-made', 'under-contract',
    ];
    for (const stage of nonTerminal) {
      expect(PipelineEngine.isTerminalStage('buying', stage)).toBe(false);
    }
  });

  it('returns false for non-terminal seller stages', () => {
    const nonTerminal = [
      'appraisal-request', 'listing-preparation', 'on-market',
      'offers-negotiation', 'under-contract',
    ];
    for (const stage of nonTerminal) {
      expect(PipelineEngine.isTerminalStage('selling', stage)).toBe(false);
    }
  });

  it('returns true for unknown stage (no valid transitions)', () => {
    expect(PipelineEngine.isTerminalStage('buying', 'nonexistent')).toBe(true);
  });
});

// ─── getInitialStage ───────────────────────────────────────────────

describe('PipelineEngine.getInitialStage', () => {
  it('returns new-enquiry for buying pipeline', () => {
    expect(PipelineEngine.getInitialStage('buying')).toBe('new-enquiry');
  });

  it('returns appraisal-request for selling pipeline', () => {
    expect(PipelineEngine.getInitialStage('selling')).toBe('appraisal-request');
  });
});
