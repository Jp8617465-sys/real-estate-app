import type {
  ErrorClassification,
  ErrorRecoveryStrategy,
  ActionErrorPolicy,
  RetryConfig,
  RetryStrategy,
  DeadLetterEntry,
  WorkflowAction,
} from '@realflow/shared';
import type { WorkflowContext, ActionResult } from './workflow-engine';
import { executeAction } from './workflow-engine';

// ─── Error Classification ────────────────────────────────────────────

/** Patterns used to classify errors as transient (retryable). */
const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  /timeout/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /network/i,
  /503/,
  /502/,
  /429/,
  /rate.?limit/i,
  /temporarily unavailable/i,
  /service unavailable/i,
];

/** Patterns used to classify errors as permanent (non-retryable). */
const PERMANENT_ERROR_PATTERNS: RegExp[] = [
  /not found/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid/i,
  /malformed/i,
  /400/,
  /401/,
  /403/,
  /404/,
  /No contact ID/i,
  /No entity ID/i,
];

/**
 * Classify an error message into transient, permanent, or partial categories.
 */
export function classifyError(errorMessage: string): ErrorClassification {
  for (const pattern of PERMANENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return 'permanent';
    }
  }

  for (const pattern of TRANSIENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return 'transient';
    }
  }

  // Default to transient so the system attempts a retry before giving up
  return 'transient';
}

// ─── Retry Delay Calculation ─────────────────────────────────────────

/**
 * Calculate retry delay in milliseconds based on the retry strategy,
 * current attempt, and configuration.
 */
export function calculateRetryDelay(
  strategy: RetryStrategy,
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  let delay: number;

  switch (strategy) {
    case 'immediate':
      delay = 0;
      break;

    case 'linear':
      delay = baseDelayMs * (attempt + 1);
      break;

    case 'exponential':
      delay = baseDelayMs * Math.pow(2, attempt);
      break;

    default:
      delay = baseDelayMs;
  }

  return Math.min(delay, maxDelayMs);
}

// ─── Default Error Policies ──────────────────────────────────────────

/** Default error policies per action type. */
const DEFAULT_ACTION_POLICIES: Record<string, ActionErrorPolicy> = {
  send_email: {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 3, strategy: 'exponential', baseDelayMs: 1000, maxDelayMs: 300000 },
  },
  send_sms: {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 3, strategy: 'exponential', baseDelayMs: 1000, maxDelayMs: 300000 },
  },
  webhook: {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 3, strategy: 'exponential', baseDelayMs: 2000, maxDelayMs: 300000 },
  },
  create_task: {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 2, strategy: 'linear', baseDelayMs: 1000, maxDelayMs: 60000 },
  },
  assign_contact: {
    classification: 'permanent',
    recoveryStrategy: 'fail',
  },
  update_field: {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 2, strategy: 'linear', baseDelayMs: 500, maxDelayMs: 30000 },
  },
  add_tag: {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 2, strategy: 'linear', baseDelayMs: 500, maxDelayMs: 30000 },
  },
  notify_agent: {
    classification: 'transient',
    recoveryStrategy: 'continue_with_warning',
  },
  post_social: {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 3, strategy: 'exponential', baseDelayMs: 5000, maxDelayMs: 300000 },
  },
  wait: {
    classification: 'permanent',
    recoveryStrategy: 'fail',
  },
  create_follow_up: {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 2, strategy: 'linear', baseDelayMs: 1000, maxDelayMs: 60000 },
  },
};

/**
 * Get the error policy for a given action type, merging with any
 * user-supplied overrides.
 */
export function getErrorPolicy(
  actionType: string,
  override?: Partial<ActionErrorPolicy>,
): ActionErrorPolicy {
  const defaults = DEFAULT_ACTION_POLICIES[actionType] ?? {
    classification: 'transient',
    recoveryStrategy: 'retry',
    retryConfig: { maxRetries: 3, strategy: 'exponential', baseDelayMs: 1000, maxDelayMs: 300000 },
  };

  if (!override) return defaults;

  return {
    ...defaults,
    ...override,
    retryConfig: override.retryConfig
      ? { ...defaults.retryConfig, ...override.retryConfig }
      : defaults.retryConfig,
  };
}

// ─── Recovery Execution ──────────────────────────────────────────────

export interface RecoveryResult {
  /** Whether the action ultimately succeeded after recovery attempts. */
  success: boolean;
  /** The action result from the final attempt (or fallback). */
  actionResult: ActionResult;
  /** The recovery strategy that was applied. */
  strategyApplied: ErrorRecoveryStrategy;
  /** Number of retry attempts made. */
  retryAttempts: number;
  /** Whether this entry was sent to the dead letter queue. */
  deadLettered: boolean;
  /** Warning message if the action was skipped or continued. */
  warning?: string;
}

/**
 * Attempt to recover from an action failure using the configured error policy.
 *
 * This function orchestrates retry logic, fallback execution, skip/fail
 * behaviour, and dead letter queue insertion.
 */
export async function recoverFromError(
  action: WorkflowAction,
  failedResult: ActionResult,
  context: WorkflowContext,
  policy: ActionErrorPolicy,
  options: {
    stepIndex: number;
    runId: string;
    workflowId: string;
    onRetryAttempt?: (attempt: number, delay: number) => void;
  },
): Promise<RecoveryResult> {
  const errorMessage = failedResult.error ?? 'Unknown error';
  const classification = policy.classification ?? classifyError(errorMessage);

  // Permanent errors with a fail strategy are immediately dead-lettered
  if (classification === 'permanent' && policy.recoveryStrategy === 'fail') {
    await addToDeadLetterQueue(context, {
      workflowId: options.workflowId,
      runId: options.runId,
      stepIndex: options.stepIndex,
      actionType: action.type,
      error: errorMessage,
      errorClassification: classification,
      retryCount: 0,
    });

    return {
      success: false,
      actionResult: failedResult,
      strategyApplied: 'fail',
      retryAttempts: 0,
      deadLettered: true,
    };
  }

  // Skip strategy
  if (policy.recoveryStrategy === 'skip') {
    return {
      success: true, // Treat as success so the workflow continues
      actionResult: { ...failedResult, success: true },
      strategyApplied: 'skip',
      retryAttempts: 0,
      deadLettered: false,
      warning: `Action ${action.type} skipped due to error: ${errorMessage}`,
    };
  }

  // Continue with warning strategy
  if (policy.recoveryStrategy === 'continue_with_warning') {
    return {
      success: true,
      actionResult: { ...failedResult, success: true },
      strategyApplied: 'continue_with_warning',
      retryAttempts: 0,
      deadLettered: false,
      warning: `Action ${action.type} failed but workflow continues: ${errorMessage}`,
    };
  }

  // Retry strategy
  if (policy.recoveryStrategy === 'retry' && policy.retryConfig) {
    const config: RetryConfig = {
      maxRetries: policy.retryConfig.maxRetries ?? 3,
      strategy: policy.retryConfig.strategy ?? 'exponential',
      baseDelayMs: policy.retryConfig.baseDelayMs ?? 1000,
      maxDelayMs: policy.retryConfig.maxDelayMs ?? 300000,
    };

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      const delay = calculateRetryDelay(
        config.strategy,
        attempt,
        config.baseDelayMs,
        config.maxDelayMs,
      );

      if (delay > 0) {
        options.onRetryAttempt?.(attempt, delay);
        await sleep(delay);
      }

      const retryResult = await executeAction(action, context);

      if (retryResult.success) {
        return {
          success: true,
          actionResult: retryResult,
          strategyApplied: 'retry',
          retryAttempts: attempt + 1,
          deadLettered: false,
        };
      }
    }

    // All retries exhausted — try fallback if configured
    if (policy.fallbackAction) {
      return executeFallback(
        policy.fallbackAction,
        context,
        errorMessage,
        classification,
        config.maxRetries,
        options,
      );
    }

    // Dead letter after all retries exhausted
    await addToDeadLetterQueue(context, {
      workflowId: options.workflowId,
      runId: options.runId,
      stepIndex: options.stepIndex,
      actionType: action.type,
      error: errorMessage,
      errorClassification: classification,
      retryCount: config.maxRetries,
    });

    return {
      success: false,
      actionResult: failedResult,
      strategyApplied: 'retry',
      retryAttempts: config.maxRetries,
      deadLettered: true,
    };
  }

  // Fallback strategy (without retry)
  if (policy.recoveryStrategy === 'fallback' && policy.fallbackAction) {
    return executeFallback(
      policy.fallbackAction,
      context,
      errorMessage,
      classification,
      0,
      options,
    );
  }

  // Default: fail and dead letter
  await addToDeadLetterQueue(context, {
    workflowId: options.workflowId,
    runId: options.runId,
    stepIndex: options.stepIndex,
    actionType: action.type,
    error: errorMessage,
    errorClassification: classification,
    retryCount: 0,
  });

  return {
    success: false,
    actionResult: failedResult,
    strategyApplied: 'fail',
    retryAttempts: 0,
    deadLettered: true,
  };
}

// ─── Fallback Execution ──────────────────────────────────────────────

async function executeFallback(
  fallbackAction: WorkflowAction,
  context: WorkflowContext,
  originalError: string,
  classification: ErrorClassification,
  retryAttempts: number,
  options: {
    stepIndex: number;
    runId: string;
    workflowId: string;
  },
): Promise<RecoveryResult> {
  const fallbackResult = await executeAction(fallbackAction, context);

  if (fallbackResult.success) {
    return {
      success: true,
      actionResult: fallbackResult,
      strategyApplied: 'fallback',
      retryAttempts,
      deadLettered: false,
      warning: `Primary action failed (${originalError}), fallback succeeded`,
    };
  }

  // Fallback also failed — dead letter
  await addToDeadLetterQueue(context, {
    workflowId: options.workflowId,
    runId: options.runId,
    stepIndex: options.stepIndex,
    actionType: fallbackAction.type,
    error: `Primary: ${originalError} | Fallback: ${fallbackResult.error ?? 'Unknown'}`,
    errorClassification: classification,
    retryCount: retryAttempts,
  });

  return {
    success: false,
    actionResult: fallbackResult,
    strategyApplied: 'fallback',
    retryAttempts,
    deadLettered: true,
  };
}

// ─── Dead Letter Queue ───────────────────────────────────────────────

interface DeadLetterInput {
  workflowId: string;
  runId: string;
  stepIndex: number;
  actionType: string;
  error: string;
  errorClassification: ErrorClassification;
  retryCount: number;
}

/**
 * Add a failed execution step to the dead letter queue for manual review.
 */
export async function addToDeadLetterQueue(
  context: WorkflowContext,
  entry: DeadLetterInput,
): Promise<DeadLetterEntry | null> {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data } = await context.supabase
      .from('workflow_dead_letters')
      .insert({
        id,
        workflow_id: entry.workflowId,
        run_id: entry.runId,
        step_index: entry.stepIndex,
        action_type: entry.actionType,
        error: entry.error,
        error_classification: entry.errorClassification,
        context: {
          contactId: context.contactId,
          transactionId: context.transactionId,
        },
        retry_count: entry.retryCount,
        created_at: now,
      })
      .select()
      .single();

    return data as DeadLetterEntry | null;
  } catch {
    // If dead letter insertion itself fails, we cannot do much more.
    return null;
  }
}

/**
 * Send an error notification to the agent when a critical workflow fails.
 */
export async function notifyWorkflowError(
  context: WorkflowContext,
  workflowId: string,
  runId: string,
  error: string,
): Promise<void> {
  try {
    await context.supabase
      .from('conversation_messages')
      .insert({
        type: 'internal_note',
        content: `[WORKFLOW ERROR] Workflow ${workflowId} (run ${runId}) failed: ${error}`,
        contact_id: context.contactId,
      })
      .select()
      .single();
  } catch {
    // Best-effort notification — do not propagate
  }
}

// ─── Utility ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
