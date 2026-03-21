export {
  EventBus,
  RealFlowEventType,
  eventBus,
  BaseService,
  type Event,
  type EventHandler,
} from './core';
export { PipelineEngine } from './core/pipeline-engine';
export { ContactScoring } from './core/contact-scoring';
export { DuplicateDetector } from './core/duplicate-detection';
export { PropertyMatchEngine } from './ba/property-match-engine';
export { DueDiligenceEngine } from './ba/due-diligence-engine';
export { FeeCalculator } from './selling/fee-calculator';
export { KeyDatesEngine } from './core/key-dates-engine';
export {
  BUYERS_AGENT_WORKFLOW_TEMPLATES,
  AI_POWERED_WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
} from './workflow-templates';
export { ResearchConsolidationEngine } from './core/research-consolidation-engine';
export type { ConsolidationDataInput, ConsolidationOptions } from './core/research-consolidation-engine';
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
} from './core/workflow-engine';
export type {
  WorkflowEvent,
  WorkflowContext,
  ActionResult,
  WorkflowRunResult,
  RunWorkflowOptions,
  SupabaseClient as WorkflowSupabaseClient,
} from './core/workflow-engine';
export {
  evaluateFieldCondition,
  evaluateConditionNode,
  evaluateConditionNodes,
} from './core/workflow-condition-evaluator';
export {
  classifyError,
  calculateRetryDelay,
  getErrorPolicy,
  recoverFromError,
  addToDeadLetterQueue,
  notifyWorkflowError,
} from './core/workflow-error-recovery';
export type { RecoveryResult } from './core/workflow-error-recovery';
export { MessageNormaliser } from './core/message-normaliser';
export { ContactMatcher } from './core/contact-matcher';
export { EmailParser } from './core/email-parser';
export { toDbSchema, fromDbSchema, type ClientBriefDbRow } from './ba/client-brief-transformer';
export {
  PipelineMigrationEngine,
  type MigrationContext,
  type MigrationDecision,
} from './core/pipeline-migration';
export { DomainSyncEngine, type DomainSearchParams, type SyncResult } from './selling/domain-sync-engine';
export { PropertyMatcher } from './ba/property-matcher';
export type {
  PropertyMatcherConfig,
  EnhancedMatchResult,
  FeatureMatchDetail,
} from './ba/property-matcher';
export { AnalyticsEngine } from './core/analytics-engine';
export { AmlEngine } from './core/aml-engine';
export { PropertyAlertEngine } from './core/property-alert-engine';
export { PortalEngine } from './core/portal-engine';
export { SocialLeadEngine } from './selling/social-lead-engine';
export { OffMarketEngine } from './ba/off-market-engine';
export { TeamEngine } from './core/team-engine';
export { generateDailyActions, scoreCandidate } from './core/daily-action-engine';
export type {
  DAESupabaseClient,
  DAEAIClient,
  GenerateDailyActionsOptions,
  DailyActionResult,
} from './core/daily-action-engine';
export {
  enrollContact,
  processEnrollmentStep,
  processDueEnrollments,
} from './core/follow-up-sequence-engine';
export type {
  FSESupabaseClient,
  FSEAIClient,
  EnrollContactOptions,
  EnrollContactResult,
  ProcessEnrollmentOptions,
  ProcessStepResult,
  ProcessDueEnrollmentsOptions,
  BulkProcessResult,
} from './core/follow-up-sequence-engine';
