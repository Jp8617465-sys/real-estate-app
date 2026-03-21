// Event bus
export {
  EventBus,
  RealFlowEventType,
  eventBus,
  type Event,
  type EventHandler,
} from './event-bus';
export { BaseService } from './base-service';

// Core engines
export { PipelineEngine } from './pipeline-engine';
export { ContactScoring } from './contact-scoring';
export { ContactMatcher } from './contact-matcher';
export { DuplicateDetector } from './duplicate-detection';
export { KeyDatesEngine } from './key-dates-engine';
export { MessageNormaliser } from './message-normaliser';
export { EmailParser } from './email-parser';
export { AnalyticsEngine } from './analytics-engine';
export { AmlEngine } from './aml-engine';
export { TeamEngine } from './team-engine';
export { PortalEngine } from './portal-engine';
export { PropertyAlertEngine } from './property-alert-engine';
export { ResearchConsolidationEngine } from './research-consolidation-engine';
export type { ConsolidationDataInput, ConsolidationOptions } from './research-consolidation-engine';
export {
  PipelineMigrationEngine,
  type MigrationContext,
  type MigrationDecision,
} from './pipeline-migration';

// Workflow engine
export {
  evaluateTrigger,
  evaluateConditions,
  evaluateCondition,
  executeAction,
  runWorkflow,
  parseDuration,
  pauseExecution,
  resumeExecution,
  scheduleResume,
} from './workflow-engine';
export type {
  WorkflowEvent,
  WorkflowContext,
  ActionResult,
  WorkflowRunResult,
  RunWorkflowOptions,
  SupabaseClient as WorkflowSupabaseClient,
} from './workflow-engine';
export {
  evaluateFieldCondition,
  evaluateConditionNode,
  evaluateConditionNodes,
} from './workflow-condition-evaluator';
export {
  classifyError,
  calculateRetryDelay,
  getErrorPolicy,
  recoverFromError,
  addToDeadLetterQueue,
  notifyWorkflowError,
} from './workflow-error-recovery';
export type { RecoveryResult } from './workflow-error-recovery';

// Daily actions
export { generateDailyActions, scoreCandidate } from './daily-action-engine';
export type {
  DAESupabaseClient,
  DAEAIClient,
  GenerateDailyActionsOptions,
  DailyActionResult,
} from './daily-action-engine';

// Follow-up sequences
export {
  enrollContact,
  processEnrollmentStep,
  processDueEnrollments,
} from './follow-up-sequence-engine';
export type {
  FSESupabaseClient,
  FSEAIClient,
  EnrollContactOptions,
  EnrollContactResult,
  ProcessEnrollmentOptions,
  ProcessStepResult,
  ProcessDueEnrollmentsOptions,
  BulkProcessResult,
} from './follow-up-sequence-engine';
