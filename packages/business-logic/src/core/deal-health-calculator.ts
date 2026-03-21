import type {
  DealHealthInput,
  DealHealthResult,
  DealHealthWeights,
  DealHealthGrade,
  ComponentScore,
} from '@realflow/shared';
import { HEALTH_GRADE_THRESHOLDS } from '@realflow/shared';

// ─── Default Weights (sum to 100) ──────────────────────────────────────

const DEFAULT_WEIGHTS: DealHealthWeights = {
  engagementRecency: 25,
  communicationFrequency: 20,
  pipelineVelocity: 20,
  qualificationScore: 20,
  activityCompleteness: 15,
};

// ─── Stage Activity Benchmarks (expected activities per week) ──────────

const STAGE_WEEKLY_BENCHMARKS: Record<string, number> = {
  // Early stages — lower touch
  'new-enquiry': 2,
  'qualified-lead': 2,
  'appraisal-request': 2,
  enquiry: 2,
  'consult-qualify': 2,

  // Active stages — moderate touch
  'active-search': 3,
  'property-shortlisted': 3,
  'listing-preparation': 3,
  'on-market': 3,
  engaged: 3,
  'strategy-brief': 3,

  // Deal stages — high touch
  'offer-made': 5,
  'due-diligence': 5,
  'offers-negotiation': 5,
  'offer-negotiate': 5,

  // Closing stages — lower touch
  'under-contract': 2,
  settled: 2,
  'settled-nurture': 2,
};

const DEFAULT_WEEKLY_BENCHMARK = 3;

// ─── Helpers ───────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(from: string, to: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return diff / msPerDay;
}

function lerp(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  if (fromMax === fromMin) return toMax;
  const t = (value - fromMin) / (fromMax - fromMin);
  return toMin + t * (toMax - toMin);
}

// ─── DealHealthCalculator ──────────────────────────────────────────────

export class DealHealthCalculator {
  /**
   * Orchestrator: calculates all components, applies weights, determines grade,
   * and generates recommendations.
   *
   * All date calculations use `asOfDate` for deterministic testing.
   */
  static calculateDealHealth(
    input: DealHealthInput,
    weights?: Partial<DealHealthWeights>,
    asOfDate?: string,
  ): DealHealthResult {
    const now = asOfDate ?? new Date().toISOString();
    const w: DealHealthWeights = { ...DEFAULT_WEIGHTS, ...weights };

    const engagementRecency: ComponentScore = {
      score: DealHealthCalculator.calculateEngagementRecency(input.lastContactDate, now),
      weight: w.engagementRecency,
      label: 'Engagement Recency',
      detail: input.lastContactDate
        ? `Last contact ${Math.round(daysBetween(input.lastContactDate, now))} days ago`
        : 'No contact recorded',
    };

    const communicationFrequency: ComponentScore = {
      score: DealHealthCalculator.calculateCommunicationFrequency(
        input.activitiesLast30Days,
        input.activitiesLast7Days,
        input.currentStage,
      ),
      weight: w.communicationFrequency,
      label: 'Communication Frequency',
      detail: `${input.activitiesLast7Days} activities this week, ${input.activitiesLast30Days} this month`,
    };

    const pipelineVelocity: ComponentScore = {
      score: DealHealthCalculator.calculatePipelineVelocity(
        input.stageEnteredAt,
        input.averageDaysInStage,
        now,
      ),
      weight: w.pipelineVelocity,
      label: 'Pipeline Velocity',
      detail: input.averageDaysInStage !== null
        ? `${Math.round(daysBetween(input.stageEnteredAt, now))} days in stage (avg: ${input.averageDaysInStage})`
        : `${Math.round(daysBetween(input.stageEnteredAt, now))} days in stage (no org average)`,
    };

    const qualificationScore: ComponentScore = {
      score: DealHealthCalculator.calculateQualificationScore(
        input.budgetConfirmed,
        input.timelineConfirmed,
        input.motivationAssessed,
        input.decisionMakerIdentified,
      ),
      weight: w.qualificationScore,
      label: 'Qualification Score',
      detail: `${[input.budgetConfirmed, input.timelineConfirmed, input.motivationAssessed, input.decisionMakerIdentified].filter(Boolean).length}/4 criteria confirmed`,
    };

    const activityCompleteness: ComponentScore = {
      score: DealHealthCalculator.calculateActivityCompleteness(
        input.totalTasksForStage,
        input.completedTasksForStage,
        input.overdueTaskCount,
      ),
      weight: w.activityCompleteness,
      label: 'Activity Completeness',
      detail: input.totalTasksForStage > 0
        ? `${input.completedTasksForStage}/${input.totalTasksForStage} tasks complete, ${input.overdueTaskCount} overdue`
        : 'No tasks defined for this stage',
    };

    const components = {
      engagementRecency,
      communicationFrequency,
      pipelineVelocity,
      qualificationScore,
      activityCompleteness,
    };

    // Weighted average
    const totalWeight = Object.values(w).reduce((sum, v) => sum + v, 0);
    const weightedSum =
      engagementRecency.score * w.engagementRecency +
      communicationFrequency.score * w.communicationFrequency +
      pipelineVelocity.score * w.pipelineVelocity +
      qualificationScore.score * w.qualificationScore +
      activityCompleteness.score * w.activityCompleteness;

    const overallScore = clamp(Math.round(weightedSum / totalWeight), 0, 100);
    const grade = DealHealthCalculator.determineGrade(overallScore);
    const recommendations = DealHealthCalculator.generateRecommendations(
      components,
      input,
      now,
    );

    return { overallScore, grade, components, recommendations };
  }

  /**
   * Score engagement recency based on days since last contact.
   *
   * - No contact ever → 0
   * - > 30 days → 0
   * - 14-30 days → 0-40
   * - 3-14 days → 40-80
   * - 1-3 days → 80-95
   * - Today (< 1 day) → 100
   */
  static calculateEngagementRecency(lastContactDate: string | null, asOfDate: string): number {
    if (lastContactDate === null) return 0;

    const days = daysBetween(lastContactDate, asOfDate);

    // Future contact date — treat as today
    if (days < 0) return 100;

    if (days < 1) return 100;
    if (days <= 3) return Math.round(lerp(days, 1, 3, 95, 80));
    if (days <= 14) return Math.round(lerp(days, 3, 14, 80, 40));
    if (days <= 30) return Math.round(lerp(days, 14, 30, 40, 0));

    return 0;
  }

  /**
   * Score communication frequency relative to stage benchmarks.
   *
   * Score = min(100, (activitiesLast7Days / weeklyBenchmark) * 100)
   * Bonus: if 30-day weekly average beats benchmark, +10 (cap 100)
   */
  static calculateCommunicationFrequency(
    activitiesLast30Days: number,
    activitiesLast7Days: number,
    currentStage: string,
  ): number {
    const benchmark = STAGE_WEEKLY_BENCHMARKS[currentStage] ?? DEFAULT_WEEKLY_BENCHMARK;

    let score = Math.min(100, (activitiesLast7Days / benchmark) * 100);

    // Bonus for sustained engagement: 30-day weekly average above benchmark
    const weeklyAvg30d = activitiesLast30Days / (30 / 7);
    if (weeklyAvg30d > benchmark) {
      score = Math.min(100, score + 10);
    }

    return Math.round(clamp(score, 0, 100));
  }

  /**
   * Score pipeline velocity — how long in current stage vs org average.
   *
   * - No org average → 50 (neutral)
   * - At or under average → 100
   * - 2x average → 50
   * - 3x+ average → 0
   */
  static calculatePipelineVelocity(
    stageEnteredAt: string,
    averageDaysInStage: number | null,
    asOfDate: string,
  ): number {
    if (averageDaysInStage === null) return 50;

    const daysInStage = Math.max(0, daysBetween(stageEnteredAt, asOfDate));

    if (averageDaysInStage === 0) {
      // If average is 0, any time in stage is over
      return daysInStage === 0 ? 100 : 0;
    }

    const ratio = daysInStage / averageDaysInStage;

    if (ratio <= 1) return 100;
    if (ratio >= 3) return 0;

    // Linear interpolation: 1x→100, 2x→50, 3x→0
    if (ratio <= 2) {
      return Math.round(lerp(ratio, 1, 2, 100, 50));
    }
    return Math.round(lerp(ratio, 2, 3, 50, 0));
  }

  /**
   * Score qualification — each of 4 criteria is worth 25 points.
   */
  static calculateQualificationScore(
    budgetConfirmed: boolean,
    timelineConfirmed: boolean,
    motivationAssessed: boolean,
    decisionMakerIdentified: boolean,
  ): number {
    let score = 0;
    if (budgetConfirmed) score += 25;
    if (timelineConfirmed) score += 25;
    if (motivationAssessed) score += 25;
    if (decisionMakerIdentified) score += 25;
    return score;
  }

  /**
   * Score activity/task completeness.
   *
   * - No tasks defined → 75 (mildly penalise lack of structure)
   * - completionRate * 100, minus 15 per overdue task
   * - Clamped to 0-100
   */
  static calculateActivityCompleteness(
    totalTasks: number,
    completedTasks: number,
    overdueCount: number,
  ): number {
    if (totalTasks === 0) return 75;

    const completionRate = completedTasks / totalTasks;
    const baseScore = completionRate * 100;
    const overduePenalty = overdueCount * 15;

    return Math.round(clamp(baseScore - overduePenalty, 0, 100));
  }

  /**
   * Map a score to a health grade.
   */
  static determineGrade(score: number): DealHealthGrade {
    if (score >= HEALTH_GRADE_THRESHOLDS.excellent) return 'excellent';
    if (score >= HEALTH_GRADE_THRESHOLDS.good) return 'good';
    if (score >= HEALTH_GRADE_THRESHOLDS.fair) return 'fair';
    if (score >= HEALTH_GRADE_THRESHOLDS['at-risk']) return 'at-risk';
    return 'critical';
  }

  /**
   * Generate actionable recommendations for any component scoring below 40.
   */
  static generateRecommendations(
    components: DealHealthResult['components'],
    input: DealHealthInput,
    asOfDate: string,
  ): string[] {
    const recommendations: string[] = [];

    if (components.engagementRecency.score < 40) {
      const days = input.lastContactDate
        ? Math.round(daysBetween(input.lastContactDate, asOfDate))
        : null;
      recommendations.push(
        days !== null
          ? `No contact in ${days} days — schedule a call or send an update`
          : 'No contact recorded — reach out to establish the relationship',
      );
    }

    if (components.communicationFrequency.score < 40) {
      const benchmark = STAGE_WEEKLY_BENCHMARKS[input.currentStage] ?? DEFAULT_WEEKLY_BENCHMARK;
      recommendations.push(
        `Activity is below benchmark for this stage — aim for ${benchmark} touchpoints this week`,
      );
    }

    if (components.pipelineVelocity.score < 40) {
      const daysInStage = Math.round(Math.max(0, daysBetween(input.stageEnteredAt, asOfDate)));
      const avg = input.averageDaysInStage;
      recommendations.push(
        avg !== null
          ? `Deal has been in ${input.currentStage} for ${daysInStage} days (org average: ${avg}) — review blockers`
          : `Deal has been in ${input.currentStage} for ${daysInStage} days — review blockers`,
      );
    }

    if (components.qualificationScore.score < 40) {
      const missing: string[] = [];
      if (!input.budgetConfirmed) missing.push('budget');
      if (!input.timelineConfirmed) missing.push('timeline');
      if (!input.motivationAssessed) missing.push('motivation');
      if (!input.decisionMakerIdentified) missing.push('decision-maker');
      recommendations.push(
        `Missing: ${missing.join(', ')} — qualify in next conversation`,
      );
    }

    if (components.activityCompleteness.score < 40) {
      if (input.overdueTaskCount > 0) {
        recommendations.push(
          `${input.overdueTaskCount} overdue tasks — complete or reschedule to maintain momentum`,
        );
      } else if (input.totalTasksForStage === 0) {
        recommendations.push(
          'No tasks defined for this stage — create a task checklist to track progress',
        );
      } else {
        recommendations.push(
          `Only ${input.completedTasksForStage}/${input.totalTasksForStage} tasks complete — prioritise remaining tasks`,
        );
      }
    }

    return recommendations;
  }
}
