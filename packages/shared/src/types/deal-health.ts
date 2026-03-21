import { z } from 'zod';

// ─── Deal Health Types ─────────────────────────────────────────────────

// Grade thresholds — score >= threshold → that grade
export const HEALTH_GRADE_THRESHOLDS = {
  excellent: 80,
  good: 65,
  fair: 45,
  'at-risk': 25,
  critical: 0,
} as const;

export type DealHealthGrade = keyof typeof HEALTH_GRADE_THRESHOLDS;

// ─── Component Score ───────────────────────────────────────────────────

export interface ComponentScore {
  score: number; // 0-100
  weight: number; // percentage weight (sums to 100 across all components)
  label: string; // human-readable name
  detail: string; // explanation of the score
}

// ─── Deal Health Input (pre-fetched data — caller is responsible for fetching) ──

export const DealHealthInputSchema = z.object({
  // Pipeline context
  pipelineType: z.enum(['buying', 'selling', 'buyers-agent']),
  currentStage: z.string(),
  stageEnteredAt: z.string(), // ISO date when deal entered current stage
  dealCreatedAt: z.string(), // ISO date when deal was created

  // Engagement data
  lastContactDate: z.string().nullable(), // ISO date of most recent activity
  activitiesLast30Days: z.number().int().min(0),
  activitiesLast7Days: z.number().int().min(0),

  // Stage velocity
  averageDaysInStage: z.number().min(0).nullable(), // org average for this stage (null if no data)

  // Qualification signals
  budgetConfirmed: z.boolean(),
  timelineConfirmed: z.boolean(),
  motivationAssessed: z.boolean(),
  decisionMakerIdentified: z.boolean(),

  // Task completeness
  totalTasksForStage: z.number().int().min(0),
  completedTasksForStage: z.number().int().min(0),
  overdueTaskCount: z.number().int().min(0),
});

export type DealHealthInput = z.infer<typeof DealHealthInputSchema>;

// ─── Deal Health Result ────────────────────────────────────────────────

export interface DealHealthResult {
  overallScore: number; // 0-100
  grade: DealHealthGrade;
  components: {
    engagementRecency: ComponentScore;
    communicationFrequency: ComponentScore;
    pipelineVelocity: ComponentScore;
    qualificationScore: ComponentScore;
    activityCompleteness: ComponentScore;
  };
  recommendations: string[];
}

// ─── Weights ───────────────────────────────────────────────────────────

export interface DealHealthWeights {
  engagementRecency: number;
  communicationFrequency: number;
  pipelineVelocity: number;
  qualificationScore: number;
  activityCompleteness: number;
}
