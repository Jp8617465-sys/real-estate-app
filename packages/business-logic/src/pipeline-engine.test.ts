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

// ─── isValidTransition (Buyers Agent Pipeline) ─────────────────────

describe('PipelineEngine.isValidTransition (buyers-agent)', () => {
  it('allows enquiry → consult-qualify', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'enquiry', 'consult-qualify')).toBe(true);
  });

  it('allows consult-qualify → engaged', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'consult-qualify', 'engaged')).toBe(true);
  });

  it('allows engaged → strategy-brief', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'engaged', 'strategy-brief')).toBe(true);
  });

  it('allows strategy-brief → active-search', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'strategy-brief', 'active-search')).toBe(true);
  });

  it('allows active-search → offer-negotiate', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'active-search', 'offer-negotiate')).toBe(true);
  });

  it('allows offer-negotiate → under-contract', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'offer-negotiate', 'under-contract')).toBe(true);
  });

  it('allows under-contract → settled-nurture', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'under-contract', 'settled-nurture')).toBe(true);
  });

  it('allows backward transition consult-qualify → enquiry', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'consult-qualify', 'enquiry')).toBe(true);
  });

  it('allows backward transition engaged → consult-qualify', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'engaged', 'consult-qualify')).toBe(true);
  });

  it('allows backward transition offer-negotiate → active-search', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'offer-negotiate', 'active-search')).toBe(true);
  });

  it('allows backward transition under-contract → offer-negotiate', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'under-contract', 'offer-negotiate')).toBe(true);
  });

  it('rejects transitions from settled-nurture (terminal)', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'settled-nurture', 'under-contract')).toBe(false);
    expect(PipelineEngine.isValidTransition('buyers-agent', 'settled-nurture', 'enquiry')).toBe(false);
  });

  it('rejects skipping stages (enquiry → engaged)', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'enquiry', 'engaged')).toBe(false);
  });

  it('rejects skipping stages (enquiry → active-search)', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'enquiry', 'active-search')).toBe(false);
  });

  it('rejects invalid stage names', () => {
    expect(PipelineEngine.isValidTransition('buyers-agent', 'invalid', 'consult-qualify')).toBe(false);
    expect(PipelineEngine.isValidTransition('buyers-agent', 'enquiry', 'invalid')).toBe(false);
  });
});

// ─── getValidNextStages (Buyers Agent) ──────────────────────────────

describe('PipelineEngine.getValidNextStages (buyers-agent)', () => {
  it('returns [consult-qualify] for enquiry (initial stage)', () => {
    expect(PipelineEngine.getValidNextStages('buyers-agent', 'enquiry')).toEqual(['consult-qualify']);
  });

  it('returns [offer-negotiate, strategy-brief] for active-search', () => {
    const stages = PipelineEngine.getValidNextStages('buyers-agent', 'active-search');
    expect(stages).toContain('offer-negotiate');
    expect(stages).toContain('strategy-brief');
    expect(stages).toHaveLength(2);
  });

  it('returns empty for settled-nurture (terminal)', () => {
    expect(PipelineEngine.getValidNextStages('buyers-agent', 'settled-nurture')).toEqual([]);
  });
});

// ─── getStageRequirements (Buyers Agent) ────────────────────────────

describe('PipelineEngine.getStageRequirements (buyers-agent)', () => {
  it('returns 1 requirement for consult-qualify', () => {
    const reqs = PipelineEngine.getStageRequirements('buyers-agent', 'consult-qualify');
    expect(reqs).toHaveLength(1);
    expect(reqs[0]!.field).toBe('contactId');
  });

  it('returns 2 requirements for engaged (agreementSigned, retainerPaid)', () => {
    const reqs = PipelineEngine.getStageRequirements('buyers-agent', 'engaged');
    expect(reqs).toHaveLength(2);
    expect(reqs.map(r => r.field)).toContain('agreementSigned');
    expect(reqs.map(r => r.field)).toContain('retainerPaid');
  });

  it('returns 2 requirements for strategy-brief (clientBriefId, financeVerified)', () => {
    const reqs = PipelineEngine.getStageRequirements('buyers-agent', 'strategy-brief');
    expect(reqs).toHaveLength(2);
    expect(reqs.map(r => r.field)).toContain('clientBriefId');
    expect(reqs.map(r => r.field)).toContain('financeVerified');
  });

  it('returns 2 requirements for offer-negotiate', () => {
    const reqs = PipelineEngine.getStageRequirements('buyers-agent', 'offer-negotiate');
    expect(reqs).toHaveLength(2);
    expect(reqs.map(r => r.field)).toContain('propertyId');
    expect(reqs.map(r => r.field)).toContain('offerAmount');
  });

  it('returns 3 requirements for under-contract', () => {
    const reqs = PipelineEngine.getStageRequirements('buyers-agent', 'under-contract');
    expect(reqs).toHaveLength(3);
    expect(reqs.map(r => r.field)).toContain('contractPrice');
    expect(reqs.map(r => r.field)).toContain('exchangeDate');
    expect(reqs.map(r => r.field)).toContain('settlementDate');
  });

  it('returns empty for enquiry (no requirements)', () => {
    expect(PipelineEngine.getStageRequirements('buyers-agent', 'enquiry')).toEqual([]);
  });

  it('all requirements have required=true', () => {
    const stages = ['consult-qualify', 'engaged', 'strategy-brief', 'offer-negotiate', 'under-contract'];
    for (const stage of stages) {
      const reqs = PipelineEngine.getStageRequirements('buyers-agent', stage);
      for (const req of reqs) {
        expect(req.required).toBe(true);
      }
    }
  });
});

// ─── getStageOrder (Buyers Agent) ───────────────────────────────────

describe('PipelineEngine.getStageOrder (buyers-agent)', () => {
  it('returns correct order for all 8 buyers-agent stages', () => {
    expect(PipelineEngine.getStageOrder('buyers-agent', 'enquiry')).toBe(1);
    expect(PipelineEngine.getStageOrder('buyers-agent', 'consult-qualify')).toBe(2);
    expect(PipelineEngine.getStageOrder('buyers-agent', 'engaged')).toBe(3);
    expect(PipelineEngine.getStageOrder('buyers-agent', 'strategy-brief')).toBe(4);
    expect(PipelineEngine.getStageOrder('buyers-agent', 'active-search')).toBe(5);
    expect(PipelineEngine.getStageOrder('buyers-agent', 'offer-negotiate')).toBe(6);
    expect(PipelineEngine.getStageOrder('buyers-agent', 'under-contract')).toBe(7);
    expect(PipelineEngine.getStageOrder('buyers-agent', 'settled-nurture')).toBe(8);
  });

  it('returns 0 for unknown stages', () => {
    expect(PipelineEngine.getStageOrder('buyers-agent', 'nonexistent')).toBe(0);
  });
});

// ─── isTerminalStage (Buyers Agent) ─────────────────────────────────

describe('PipelineEngine.isTerminalStage (buyers-agent)', () => {
  it('returns true for settled-nurture', () => {
    expect(PipelineEngine.isTerminalStage('buyers-agent', 'settled-nurture')).toBe(true);
  });

  it('returns false for all non-terminal buyers-agent stages', () => {
    const nonTerminal = [
      'enquiry', 'consult-qualify', 'engaged', 'strategy-brief',
      'active-search', 'offer-negotiate', 'under-contract',
    ];
    for (const stage of nonTerminal) {
      expect(PipelineEngine.isTerminalStage('buyers-agent', stage)).toBe(false);
    }
  });
});

// ─── getInitialStage (Buyers Agent) ─────────────────────────────────

describe('PipelineEngine.getInitialStage (buyers-agent)', () => {
  it('returns enquiry for buyers-agent pipeline', () => {
    expect(PipelineEngine.getInitialStage('buyers-agent')).toBe('enquiry');
  });
});
