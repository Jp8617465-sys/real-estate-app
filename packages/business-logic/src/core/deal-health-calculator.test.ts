import { describe, it, expect } from 'vitest';
import { DealHealthCalculator } from './deal-health-calculator';
import type { DealHealthInput } from '@realflow/shared';

// ─── Constants ─────────────────────────────────────────────────────────

const AS_OF = '2026-03-21T12:00:00Z';

// ─── Helpers ───────────────────────────────────────────────────────────

function isoDate(daysAgo: number): string {
  const d = new Date(AS_OF);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function makeInput(overrides: Partial<DealHealthInput> = {}): DealHealthInput {
  return {
    pipelineType: 'buying',
    currentStage: 'active-search',
    stageEnteredAt: isoDate(5),
    dealCreatedAt: isoDate(30),
    lastContactDate: isoDate(1),
    activitiesLast30Days: 12,
    activitiesLast7Days: 3,
    averageDaysInStage: 10,
    budgetConfirmed: true,
    timelineConfirmed: true,
    motivationAssessed: true,
    decisionMakerIdentified: true,
    totalTasksForStage: 5,
    completedTasksForStage: 5,
    overdueTaskCount: 0,
    ...overrides,
  };
}

// ─── Engagement Recency ────────────────────────────────────────────────

describe('DealHealthCalculator.calculateEngagementRecency', () => {
  it('returns 100 for contact today (< 1 day)', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(AS_OF, AS_OF);
    expect(score).toBe(100);
  });

  it('returns ~90 for contact 2 days ago', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(isoDate(2), AS_OF);
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(95);
  });

  it('returns ~65 for contact 7 days ago', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(isoDate(7), AS_OF);
    expect(score).toBeGreaterThanOrEqual(55);
    expect(score).toBeLessThanOrEqual(75);
  });

  it('returns ~25 for contact 20 days ago', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(isoDate(20), AS_OF);
    expect(score).toBeGreaterThanOrEqual(15);
    expect(score).toBeLessThanOrEqual(35);
  });

  it('returns 0 for contact 45 days ago', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(isoDate(45), AS_OF);
    expect(score).toBe(0);
  });

  it('returns 0 for null (never contacted)', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(null, AS_OF);
    expect(score).toBe(0);
  });

  it('returns 0 for contact exactly 30 days ago', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(isoDate(30), AS_OF);
    expect(score).toBe(0);
  });

  it('returns 95 for contact exactly 1 day ago', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(isoDate(1), AS_OF);
    expect(score).toBe(95);
  });

  it('returns 80 for contact exactly 3 days ago', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(isoDate(3), AS_OF);
    expect(score).toBe(80);
  });

  it('returns 40 for contact exactly 14 days ago', () => {
    const score = DealHealthCalculator.calculateEngagementRecency(isoDate(14), AS_OF);
    expect(score).toBe(40);
  });

  it('returns 100 for future contact date', () => {
    const future = new Date(AS_OF);
    future.setDate(future.getDate() + 5);
    const score = DealHealthCalculator.calculateEngagementRecency(future.toISOString(), AS_OF);
    expect(score).toBe(100);
  });
});

// ─── Communication Frequency ───────────────────────────────────────────

describe('DealHealthCalculator.calculateCommunicationFrequency', () => {
  it('returns 100 when at benchmark for active stage (3/week)', () => {
    const score = DealHealthCalculator.calculateCommunicationFrequency(12, 3, 'active-search');
    expect(score).toBe(100);
  });

  it('returns 100 when double benchmark (capped)', () => {
    const score = DealHealthCalculator.calculateCommunicationFrequency(24, 6, 'active-search');
    expect(score).toBe(100);
  });

  it('returns 0 for zero activities', () => {
    const score = DealHealthCalculator.calculateCommunicationFrequency(0, 0, 'active-search');
    expect(score).toBe(0);
  });

  it('returns proportional score below benchmark', () => {
    // 1 activity / 3 benchmark = ~33
    const score = DealHealthCalculator.calculateCommunicationFrequency(4, 1, 'active-search');
    expect(score).toBe(33);
  });

  it('uses higher benchmark for deal stages (5/week)', () => {
    // 3 activities / 5 benchmark = 60
    const score = DealHealthCalculator.calculateCommunicationFrequency(10, 3, 'offer-made');
    expect(score).toBe(60);
  });

  it('uses lower benchmark for early stages (2/week)', () => {
    // 2 activities / 2 benchmark = 100
    const score = DealHealthCalculator.calculateCommunicationFrequency(8, 2, 'new-enquiry');
    expect(score).toBe(100);
  });

  it('adds 10-point bonus when 30-day weekly average exceeds benchmark', () => {
    // 30-day average: 20 / (30/7) ≈ 4.67/week, benchmark for active-search = 3
    // 7-day: 2 / 3 = 66.7, + 10 bonus = 77
    const score = DealHealthCalculator.calculateCommunicationFrequency(20, 2, 'active-search');
    expect(score).toBe(77);
  });

  it('does not add bonus when 30-day average is below benchmark', () => {
    // 30-day average: 6 / (30/7) ≈ 1.4/week, benchmark = 3 → no bonus
    // 7-day: 1/3 = 33
    const score = DealHealthCalculator.calculateCommunicationFrequency(6, 1, 'active-search');
    expect(score).toBe(33);
  });

  it('uses default benchmark of 3 for unknown stages', () => {
    const score = DealHealthCalculator.calculateCommunicationFrequency(12, 3, 'unknown-stage');
    expect(score).toBe(100);
  });
});

// ─── Pipeline Velocity ─────────────────────────────────────────────────

describe('DealHealthCalculator.calculatePipelineVelocity', () => {
  it('returns 100 when at org average', () => {
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(10), 10, AS_OF);
    expect(score).toBe(100);
  });

  it('returns 50 when at double org average', () => {
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(20), 10, AS_OF);
    expect(score).toBe(50);
  });

  it('returns 0 when at triple org average', () => {
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(30), 10, AS_OF);
    expect(score).toBe(0);
  });

  it('returns 0 when beyond triple org average', () => {
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(50), 10, AS_OF);
    expect(score).toBe(0);
  });

  it('returns 50 when no org average data', () => {
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(5), null, AS_OF);
    expect(score).toBe(50);
  });

  it('returns 100 when under org average (ahead of schedule)', () => {
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(3), 10, AS_OF);
    expect(score).toBe(100);
  });

  it('interpolates between 1x and 2x average', () => {
    // 15 days / 10 avg = 1.5x → should be ~75
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(15), 10, AS_OF);
    expect(score).toBe(75);
  });

  it('interpolates between 2x and 3x average', () => {
    // 25 days / 10 avg = 2.5x → should be ~25
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(25), 10, AS_OF);
    expect(score).toBe(25);
  });

  it('handles zero average (any time is over)', () => {
    const score = DealHealthCalculator.calculatePipelineVelocity(isoDate(1), 0, AS_OF);
    expect(score).toBe(0);
  });

  it('handles zero average with zero days', () => {
    const score = DealHealthCalculator.calculatePipelineVelocity(AS_OF, 0, AS_OF);
    expect(score).toBe(100);
  });
});

// ─── Qualification Score ───────────────────────────────────────────────

describe('DealHealthCalculator.calculateQualificationScore', () => {
  it('returns 100 when all four confirmed', () => {
    const score = DealHealthCalculator.calculateQualificationScore(true, true, true, true);
    expect(score).toBe(100);
  });

  it('returns 0 when none confirmed', () => {
    const score = DealHealthCalculator.calculateQualificationScore(false, false, false, false);
    expect(score).toBe(0);
  });

  it('returns 50 when two of four confirmed', () => {
    const score = DealHealthCalculator.calculateQualificationScore(true, true, false, false);
    expect(score).toBe(50);
  });

  it('returns 25 when one confirmed', () => {
    const score = DealHealthCalculator.calculateQualificationScore(false, false, false, true);
    expect(score).toBe(25);
  });

  it('returns 75 when three confirmed', () => {
    const score = DealHealthCalculator.calculateQualificationScore(true, true, true, false);
    expect(score).toBe(75);
  });

  it('each factor is worth exactly 25', () => {
    expect(DealHealthCalculator.calculateQualificationScore(true, false, false, false)).toBe(25);
    expect(DealHealthCalculator.calculateQualificationScore(false, true, false, false)).toBe(25);
    expect(DealHealthCalculator.calculateQualificationScore(false, false, true, false)).toBe(25);
    expect(DealHealthCalculator.calculateQualificationScore(false, false, false, true)).toBe(25);
  });
});

// ─── Activity Completeness ─────────────────────────────────────────────

describe('DealHealthCalculator.calculateActivityCompleteness', () => {
  it('returns 100 for all tasks done, no overdue', () => {
    const score = DealHealthCalculator.calculateActivityCompleteness(5, 5, 0);
    expect(score).toBe(100);
  });

  it('returns 50 for half done, no overdue', () => {
    const score = DealHealthCalculator.calculateActivityCompleteness(10, 5, 0);
    expect(score).toBe(50);
  });

  it('returns 70 for all done but 2 overdue', () => {
    const score = DealHealthCalculator.calculateActivityCompleteness(5, 5, 2);
    expect(score).toBe(70); // 100 - 30 penalty
  });

  it('returns 75 for no tasks defined', () => {
    const score = DealHealthCalculator.calculateActivityCompleteness(0, 0, 0);
    expect(score).toBe(75);
  });

  it('returns 0 for zero completed with 3 overdue (floored)', () => {
    const score = DealHealthCalculator.calculateActivityCompleteness(5, 0, 3);
    expect(score).toBe(0); // 0 - 45 = -45, clamped to 0
  });

  it('applies 15-point penalty per overdue task', () => {
    const score = DealHealthCalculator.calculateActivityCompleteness(10, 10, 1);
    expect(score).toBe(85); // 100 - 15
  });

  it('clamps to 0 when penalty exceeds base', () => {
    const score = DealHealthCalculator.calculateActivityCompleteness(5, 3, 10);
    expect(score).toBe(0); // 60 - 150 = -90, clamped to 0
  });
});

// ─── Overall Score Calculation ─────────────────────────────────────────

describe('DealHealthCalculator.calculateDealHealth', () => {
  it('returns overall 100 when all components are maxed', () => {
    const input = makeInput({
      lastContactDate: AS_OF, // today → 100
      activitiesLast7Days: 10, // well above benchmark → 100
      activitiesLast30Days: 40,
      stageEnteredAt: isoDate(3), // under average → 100
      averageDaysInStage: 10,
      budgetConfirmed: true,
      timelineConfirmed: true,
      motivationAssessed: true,
      decisionMakerIdentified: true,
      totalTasksForStage: 5,
      completedTasksForStage: 5,
      overdueTaskCount: 0,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.overallScore).toBe(100);
    expect(result.grade).toBe('excellent');
  });

  it('returns overall 0 when all components are zero', () => {
    const input = makeInput({
      lastContactDate: null, // never → 0
      activitiesLast7Days: 0, // no activities → 0
      activitiesLast30Days: 0,
      stageEnteredAt: isoDate(90), // way over average → 0
      averageDaysInStage: 10,
      budgetConfirmed: false,
      timelineConfirmed: false,
      motivationAssessed: false,
      decisionMakerIdentified: false,
      totalTasksForStage: 10,
      completedTasksForStage: 0,
      overdueTaskCount: 10,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.overallScore).toBe(0);
    expect(result.grade).toBe('critical');
  });

  it('custom weights override defaults', () => {
    const input = makeInput({
      lastContactDate: AS_OF, // engagement = 100
      activitiesLast7Days: 0, // frequency = 0
      activitiesLast30Days: 0,
      stageEnteredAt: isoDate(5),
      averageDaysInStage: 10,
      budgetConfirmed: false,
      timelineConfirmed: false,
      motivationAssessed: false,
      decisionMakerIdentified: false,
      totalTasksForStage: 0, // completeness = 75
    });

    // Put all weight on engagement (100% → score = 100)
    const result = DealHealthCalculator.calculateDealHealth(
      input,
      {
        engagementRecency: 100,
        communicationFrequency: 0,
        pipelineVelocity: 0,
        qualificationScore: 0,
        activityCompleteness: 0,
      },
      AS_OF,
    );
    expect(result.overallScore).toBe(100);
  });

  it('assigns correct grades at thresholds', () => {
    // Score ~80 → excellent
    const excellentInput = makeInput({
      lastContactDate: isoDate(1), // 95
      activitiesLast7Days: 3, // 100
      activitiesLast30Days: 12,
      averageDaysInStage: 10,
      stageEnteredAt: isoDate(5), // 100
      budgetConfirmed: true,
      timelineConfirmed: false,
      motivationAssessed: false,
      decisionMakerIdentified: false, // 25
      totalTasksForStage: 5,
      completedTasksForStage: 3,
      overdueTaskCount: 0, // 60
    });
    const excellentResult = DealHealthCalculator.calculateDealHealth(
      excellentInput,
      undefined,
      AS_OF,
    );
    // Weighted: 95*25 + 100*20 + 100*20 + 25*20 + 60*15 = 2375 + 2000 + 2000 + 500 + 900 = 7775 / 100 = 77.75 ≈ 78
    // With +10 bonus on frequency: (100+10=110 capped to 100) → still 100
    expect(excellentResult.grade).toBe('good'); // 78 is good range
  });

  it('includes all 5 component scores in result', () => {
    const input = makeInput();
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);

    expect(result.components.engagementRecency).toBeDefined();
    expect(result.components.communicationFrequency).toBeDefined();
    expect(result.components.pipelineVelocity).toBeDefined();
    expect(result.components.qualificationScore).toBeDefined();
    expect(result.components.activityCompleteness).toBeDefined();

    // Each component has required fields
    for (const comp of Object.values(result.components)) {
      expect(comp).toHaveProperty('score');
      expect(comp).toHaveProperty('weight');
      expect(comp).toHaveProperty('label');
      expect(comp).toHaveProperty('detail');
      expect(comp.score).toBeGreaterThanOrEqual(0);
      expect(comp.score).toBeLessThanOrEqual(100);
    }
  });

  it('weights sum to 100 by default', () => {
    const input = makeInput();
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    const totalWeight = Object.values(result.components).reduce(
      (sum, comp) => sum + comp.weight,
      0,
    );
    expect(totalWeight).toBe(100);
  });
});

// ─── Grade Determination ───────────────────────────────────────────────

describe('DealHealthCalculator.determineGrade', () => {
  it('returns excellent for 80+', () => {
    expect(DealHealthCalculator.determineGrade(80)).toBe('excellent');
    expect(DealHealthCalculator.determineGrade(100)).toBe('excellent');
    expect(DealHealthCalculator.determineGrade(95)).toBe('excellent');
  });

  it('returns good for 65-79', () => {
    expect(DealHealthCalculator.determineGrade(65)).toBe('good');
    expect(DealHealthCalculator.determineGrade(79)).toBe('good');
  });

  it('returns fair for 45-64', () => {
    expect(DealHealthCalculator.determineGrade(45)).toBe('fair');
    expect(DealHealthCalculator.determineGrade(64)).toBe('fair');
  });

  it('returns at-risk for 25-44', () => {
    expect(DealHealthCalculator.determineGrade(25)).toBe('at-risk');
    expect(DealHealthCalculator.determineGrade(44)).toBe('at-risk');
  });

  it('returns critical for 0-24', () => {
    expect(DealHealthCalculator.determineGrade(0)).toBe('critical');
    expect(DealHealthCalculator.determineGrade(24)).toBe('critical');
  });
});

// ─── Recommendations ───────────────────────────────────────────────────

describe('DealHealthCalculator.generateRecommendations', () => {
  it('generates engagement recommendation when recency is low', () => {
    const input = makeInput({ lastContactDate: isoDate(25) });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('No contact in')]),
    );
  });

  it('generates frequency recommendation when communication is low', () => {
    const input = makeInput({ activitiesLast7Days: 0, activitiesLast30Days: 0 });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('below benchmark')]),
    );
  });

  it('generates velocity recommendation when pipeline is slow', () => {
    const input = makeInput({ stageEnteredAt: isoDate(40), averageDaysInStage: 10 });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('review blockers')]),
    );
  });

  it('generates qualification recommendation when score is low', () => {
    const input = makeInput({
      budgetConfirmed: false,
      timelineConfirmed: false,
      motivationAssessed: false,
      decisionMakerIdentified: false,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('Missing:')]),
    );
  });

  it('generates completeness recommendation when overdue tasks exist', () => {
    const input = makeInput({
      totalTasksForStage: 5,
      completedTasksForStage: 1,
      overdueTaskCount: 4,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('overdue tasks')]),
    );
  });

  it('generates multiple recommendations when multiple areas are weak', () => {
    const input = makeInput({
      lastContactDate: null,
      activitiesLast7Days: 0,
      activitiesLast30Days: 0,
      stageEnteredAt: isoDate(50),
      averageDaysInStage: 10,
      budgetConfirmed: false,
      timelineConfirmed: false,
      motivationAssessed: false,
      decisionMakerIdentified: false,
      totalTasksForStage: 10,
      completedTasksForStage: 0,
      overdueTaskCount: 5,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(4);
  });

  it('generates no recommendations for a healthy deal', () => {
    const input = makeInput({
      lastContactDate: AS_OF,
      activitiesLast7Days: 5,
      activitiesLast30Days: 20,
      stageEnteredAt: isoDate(3),
      averageDaysInStage: 10,
      budgetConfirmed: true,
      timelineConfirmed: true,
      motivationAssessed: true,
      decisionMakerIdentified: true,
      totalTasksForStage: 5,
      completedTasksForStage: 5,
      overdueTaskCount: 0,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.recommendations).toHaveLength(0);
  });

  it('includes "no contact recorded" when lastContactDate is null and engagement is low', () => {
    const input = makeInput({ lastContactDate: null });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('No contact recorded')]),
    );
  });

  it('lists missing qualification criteria by name', () => {
    const input = makeInput({
      budgetConfirmed: false,
      timelineConfirmed: true,
      motivationAssessed: false,
      decisionMakerIdentified: true,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    const qualRec = result.recommendations.find((r) => r.includes('Missing:'));
    if (qualRec) {
      expect(qualRec).toContain('budget');
      expect(qualRec).toContain('motivation');
      expect(qualRec).not.toContain('timeline');
      expect(qualRec).not.toContain('decision-maker');
    }
  });
});

// ─── Edge Cases ────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('handles future stageEnteredAt gracefully', () => {
    const future = new Date(AS_OF);
    future.setDate(future.getDate() + 5);
    const input = makeInput({ stageEnteredAt: future.toISOString() });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('clamps negative values to 0', () => {
    // All minimums
    const input = makeInput({
      lastContactDate: null,
      activitiesLast7Days: 0,
      activitiesLast30Days: 0,
      stageEnteredAt: isoDate(100),
      averageDaysInStage: 1,
      budgetConfirmed: false,
      timelineConfirmed: false,
      motivationAssessed: false,
      decisionMakerIdentified: false,
      totalTasksForStage: 10,
      completedTasksForStage: 0,
      overdueTaskCount: 10,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.overallScore).toBe(0);
    for (const comp of Object.values(result.components)) {
      expect(comp.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps very large values to 100', () => {
    const input = makeInput({
      lastContactDate: AS_OF,
      activitiesLast7Days: 1000,
      activitiesLast30Days: 5000,
      averageDaysInStage: 100,
      stageEnteredAt: AS_OF,
      totalTasksForStage: 100,
      completedTasksForStage: 100,
      overdueTaskCount: 0,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    for (const comp of Object.values(result.components)) {
      expect(comp.score).toBeLessThanOrEqual(100);
    }
  });

  it('works with all pipeline types', () => {
    for (const pipelineType of ['buying', 'selling', 'buyers-agent'] as const) {
      const input = makeInput({ pipelineType });
      const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    }
  });

  it('returns deterministic results with fixed asOfDate', () => {
    const input = makeInput();
    const result1 = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    const result2 = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    expect(result1.overallScore).toBe(result2.overallScore);
    expect(result1.grade).toBe(result2.grade);
    expect(result1.recommendations).toEqual(result2.recommendations);
  });

  it('handles buyers-agent specific stages', () => {
    const input = makeInput({
      pipelineType: 'buyers-agent',
      currentStage: 'offer-negotiate',
      activitiesLast7Days: 5,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    // offer-negotiate benchmark is 5/week, so 5/5 = 100
    expect(result.components.communicationFrequency.score).toBe(100);
  });

  it('handles seller pipeline stages', () => {
    const input = makeInput({
      pipelineType: 'selling',
      currentStage: 'on-market',
      activitiesLast7Days: 3,
    });
    const result = DealHealthCalculator.calculateDealHealth(input, undefined, AS_OF);
    // on-market benchmark is 3/week, so 3/3 = 100
    expect(result.components.communicationFrequency.score).toBe(100);
  });
});
