import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Vitest Rule: use vi.hoisted() so the mock factory can reference these ────
const { mockExecuteAction } = vi.hoisted(() => ({
  mockExecuteAction: vi.fn(),
}));

// ─── Mock workflow-engine BEFORE importing the module under test ───────────────
vi.mock('./workflow-engine', () => ({
  executeAction: mockExecuteAction,
}));

import {
  classifyError,
  calculateRetryDelay,
  getErrorPolicy,
  recoverFromError,
  addToDeadLetterQueue,
} from './workflow-error-recovery';
import type { ActionErrorPolicy } from '@realflow/shared';
import type { WorkflowContext, ActionResult } from './workflow-engine';

// ─── UUIDs ────────────────────────────────────────────────────────────────────

const WORKFLOW_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const RUN_ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const CONTACT_ID = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeSupabase() {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: crypto.randomUUID() }, error: null }),
  };
  return {
    from: vi.fn(() => chain),
    _chain: chain,
  };
}

function makeContext(supabase = makeSupabase()): WorkflowContext {
  return {
    contactId: CONTACT_ID,
    entityData: {},
    supabase: supabase as unknown as WorkflowContext['supabase'],
  };
}

function makeFailedResult(overrides: Partial<ActionResult> = {}): ActionResult {
  return {
    success: false,
    actionType: 'send_email',
    error: 'Connection timeout',
    ...overrides,
  };
}

function makeAction(type = 'send_email') {
  return { type } as import('@realflow/shared').WorkflowAction;
}

function makeOptions(
  overrides: Partial<{ stepIndex: number; runId: string; workflowId: string }> = {},
) {
  return {
    stepIndex: 0,
    runId: RUN_ID,
    workflowId: WORKFLOW_ID,
    ...overrides,
  };
}

// ─── classifyError ────────────────────────────────────────────────────────────

describe('classifyError', () => {
  it('classifies "timeout" errors as transient', () => {
    expect(classifyError('Connection timeout')).toBe('transient');
  });

  it('classifies "rate limit" errors as transient', () => {
    expect(classifyError('rate limit exceeded')).toBe('transient');
  });

  it('classifies "503 Service Unavailable" as transient', () => {
    expect(classifyError('503 Service Unavailable')).toBe('transient');
  });

  it('classifies "not found" errors as permanent', () => {
    expect(classifyError('Contact not found')).toBe('permanent');
  });

  it('classifies "unauthorized" as permanent', () => {
    expect(classifyError('401 unauthorized')).toBe('permanent');
  });

  it('classifies "forbidden" as permanent', () => {
    expect(classifyError('403 forbidden')).toBe('permanent');
  });

  it('classifies "No contact ID" as permanent', () => {
    expect(classifyError('No contact ID provided')).toBe('permanent');
  });

  it('defaults unknown errors to transient (retry before giving up)', () => {
    expect(classifyError('Something went wrong')).toBe('transient');
  });
});

// ─── calculateRetryDelay ──────────────────────────────────────────────────────

describe('calculateRetryDelay', () => {
  it('returns 0 for "immediate" strategy regardless of attempt', () => {
    expect(calculateRetryDelay('immediate', 0, 1000, 60000)).toBe(0);
    expect(calculateRetryDelay('immediate', 5, 1000, 60000)).toBe(0);
  });

  it('returns baseDelay * (attempt + 1) for "linear" strategy', () => {
    // attempt 0 → 1000 * 1 = 1000ms
    expect(calculateRetryDelay('linear', 0, 1000, 60000)).toBe(1000);
    // attempt 2 → 1000 * 3 = 3000ms
    expect(calculateRetryDelay('linear', 2, 1000, 60000)).toBe(3000);
  });

  it('returns baseDelay * 2^attempt for "exponential" strategy', () => {
    // attempt 0 → 1000 * 2^0 = 1000ms
    expect(calculateRetryDelay('exponential', 0, 1000, 60000)).toBe(1000);
    // attempt 1 → 1000 * 2^1 = 2000ms
    expect(calculateRetryDelay('exponential', 1, 1000, 60000)).toBe(2000);
    // attempt 3 → 1000 * 2^3 = 8000ms
    expect(calculateRetryDelay('exponential', 3, 1000, 60000)).toBe(8000);
  });

  it('caps delay at maxDelayMs', () => {
    // exponential attempt 10 with base 1000 would be 1024000 ms — capped at 5000
    expect(calculateRetryDelay('exponential', 10, 1000, 5000)).toBe(5000);
  });

  it('linear delay is also capped at maxDelayMs', () => {
    // linear attempt 100 with base 2000 → 202000ms — capped at 30000
    expect(calculateRetryDelay('linear', 100, 2000, 30000)).toBe(30000);
  });
});

// ─── getErrorPolicy ───────────────────────────────────────────────────────────

describe('getErrorPolicy', () => {
  it('returns default send_email policy when no override', () => {
    const policy = getErrorPolicy('send_email');
    expect(policy.recoveryStrategy).toBe('retry');
    expect(policy.retryConfig?.maxRetries).toBe(3);
    expect(policy.retryConfig?.strategy).toBe('exponential');
  });

  it('returns default assign_contact policy — permanent fail strategy', () => {
    const policy = getErrorPolicy('assign_contact');
    expect(policy.classification).toBe('permanent');
    expect(policy.recoveryStrategy).toBe('fail');
  });

  it('returns default notify_agent policy — continue_with_warning', () => {
    const policy = getErrorPolicy('notify_agent');
    expect(policy.recoveryStrategy).toBe('continue_with_warning');
  });

  it('merges an override into the default policy', () => {
    const override: Partial<ActionErrorPolicy> = {
      recoveryStrategy: 'skip',
    };
    const policy = getErrorPolicy('send_email', override);
    expect(policy.recoveryStrategy).toBe('skip');
    // Non-overridden fields should retain defaults
    expect(policy.retryConfig?.maxRetries).toBe(3);
  });

  it('merges retryConfig overrides', () => {
    const override: Partial<ActionErrorPolicy> = {
      retryConfig: { maxRetries: 1, strategy: 'immediate', baseDelayMs: 0, maxDelayMs: 0 },
    };
    const policy = getErrorPolicy('send_email', override);
    expect(policy.retryConfig?.maxRetries).toBe(1);
    expect(policy.retryConfig?.strategy).toBe('immediate');
  });

  it('returns a sensible default for an unknown action type', () => {
    const policy = getErrorPolicy('some_unknown_action_type');
    expect(policy.recoveryStrategy).toBe('retry');
    expect(policy.retryConfig?.maxRetries).toBe(3);
  });
});

// ─── recoverFromError — skip strategy ────────────────────────────────────────

describe('recoverFromError — skip strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success: true and skips without calling executeAction', async () => {
    const policy: ActionErrorPolicy = {
      classification: 'transient',
      recoveryStrategy: 'skip',
    };

    const result = await recoverFromError(
      makeAction(),
      makeFailedResult(),
      makeContext(),
      policy,
      makeOptions(),
    );

    expect(result.success).toBe(true);
    expect(result.strategyApplied).toBe('skip');
    expect(result.deadLettered).toBe(false);
    expect(result.retryAttempts).toBe(0);
    expect(result.warning).toContain('skipped');
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });
});

// ─── recoverFromError — continue_with_warning strategy ───────────────────────

describe('recoverFromError — continue_with_warning strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success: true and continues without executeAction', async () => {
    const policy: ActionErrorPolicy = {
      classification: 'transient',
      recoveryStrategy: 'continue_with_warning',
    };

    const result = await recoverFromError(
      makeAction(),
      makeFailedResult(),
      makeContext(),
      policy,
      makeOptions(),
    );

    expect(result.success).toBe(true);
    expect(result.strategyApplied).toBe('continue_with_warning');
    expect(result.deadLettered).toBe(false);
    expect(result.warning).toContain('failed but workflow continues');
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });
});

// ─── recoverFromError — permanent fail strategy ───────────────────────────────

describe('recoverFromError — permanent fail (dead-letter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success: false and dead-letters without retrying', async () => {
    const supabase = makeSupabase();
    const policy: ActionErrorPolicy = {
      classification: 'permanent',
      recoveryStrategy: 'fail',
    };

    const result = await recoverFromError(
      makeAction('assign_contact'),
      makeFailedResult({ error: 'Contact not found' }),
      makeContext(supabase),
      policy,
      makeOptions(),
    );

    expect(result.success).toBe(false);
    expect(result.strategyApplied).toBe('fail');
    expect(result.deadLettered).toBe(true);
    expect(result.retryAttempts).toBe(0);
    expect(mockExecuteAction).not.toHaveBeenCalled();
    // Dead-letter insert should have been called
    expect(supabase.from).toHaveBeenCalledWith('workflow_dead_letters');
  });
});

// ─── recoverFromError — retry strategy succeeds on first retry ────────────────

describe('recoverFromError — retry strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on first retry and does not dead-letter', async () => {
    // First retry succeeds
    mockExecuteAction.mockResolvedValueOnce({
      success: true,
      actionType: 'send_email',
      result: { messageId: 'msg-abc' },
    });

    const policy: ActionErrorPolicy = {
      classification: 'transient',
      recoveryStrategy: 'retry',
      retryConfig: { maxRetries: 3, strategy: 'immediate', baseDelayMs: 0, maxDelayMs: 0 },
    };

    const result = await recoverFromError(
      makeAction('send_email'),
      makeFailedResult(),
      makeContext(),
      policy,
      makeOptions(),
    );

    expect(result.success).toBe(true);
    expect(result.strategyApplied).toBe('retry');
    expect(result.retryAttempts).toBe(1);
    expect(result.deadLettered).toBe(false);
    expect(mockExecuteAction).toHaveBeenCalledTimes(1);
  });

  it('succeeds on second retry after one failure', async () => {
    mockExecuteAction
      .mockResolvedValueOnce({ success: false, actionType: 'send_email', error: 'Still failing' })
      .mockResolvedValueOnce({ success: true, actionType: 'send_email' });

    const policy: ActionErrorPolicy = {
      classification: 'transient',
      recoveryStrategy: 'retry',
      retryConfig: { maxRetries: 3, strategy: 'immediate', baseDelayMs: 0, maxDelayMs: 0 },
    };

    const result = await recoverFromError(
      makeAction('send_email'),
      makeFailedResult(),
      makeContext(),
      policy,
      makeOptions(),
    );

    expect(result.success).toBe(true);
    expect(result.retryAttempts).toBe(2);
    expect(mockExecuteAction).toHaveBeenCalledTimes(2);
  });

  it('dead-letters after max retries are exhausted', async () => {
    // All retries fail
    mockExecuteAction.mockResolvedValue({
      success: false,
      actionType: 'send_email',
      error: 'Persistent failure',
    });

    const supabase = makeSupabase();
    const policy: ActionErrorPolicy = {
      classification: 'transient',
      recoveryStrategy: 'retry',
      retryConfig: { maxRetries: 2, strategy: 'immediate', baseDelayMs: 0, maxDelayMs: 0 },
    };

    const result = await recoverFromError(
      makeAction('send_email'),
      makeFailedResult(),
      makeContext(supabase),
      policy,
      makeOptions(),
    );

    expect(result.success).toBe(false);
    expect(result.strategyApplied).toBe('retry');
    expect(result.retryAttempts).toBe(2);
    expect(result.deadLettered).toBe(true);
    expect(mockExecuteAction).toHaveBeenCalledTimes(2);
    expect(supabase.from).toHaveBeenCalledWith('workflow_dead_letters');
  });

  it('fires the onRetryAttempt callback on each attempt when delay > 0', async () => {
    mockExecuteAction.mockResolvedValueOnce({ success: true, actionType: 'webhook' });

    const onRetryAttempt = vi.fn();
    const policy: ActionErrorPolicy = {
      classification: 'transient',
      recoveryStrategy: 'retry',
      retryConfig: { maxRetries: 3, strategy: 'linear', baseDelayMs: 1, maxDelayMs: 10 },
    };

    await recoverFromError(
      makeAction('webhook'),
      makeFailedResult({ actionType: 'webhook' }),
      makeContext(),
      policy,
      { ...makeOptions(), onRetryAttempt },
    );

    expect(onRetryAttempt).toHaveBeenCalledTimes(1);
    expect(onRetryAttempt).toHaveBeenCalledWith(0, expect.any(Number));
  });
});

// ─── addToDeadLetterQueue ─────────────────────────────────────────────────────

describe('addToDeadLetterQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a dead-letter record into workflow_dead_letters', async () => {
    const supabase = makeSupabase();
    const ctx = makeContext(supabase);

    const result = await addToDeadLetterQueue(ctx, {
      workflowId: WORKFLOW_ID,
      runId: RUN_ID,
      stepIndex: 2,
      actionType: 'send_email',
      error: 'SMTP server unreachable',
      errorClassification: 'transient',
      retryCount: 3,
    });

    expect(supabase.from).toHaveBeenCalledWith('workflow_dead_letters');
    expect(supabase._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_id: WORKFLOW_ID,
        run_id: RUN_ID,
        step_index: 2,
        action_type: 'send_email',
        retry_count: 3,
      }),
    );
    // Returns the data from the Supabase mock
    expect(result).not.toBeNull();
  });

  it('returns null gracefully when Supabase throws', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('DB is down');
      }),
    };
    const ctx = makeContext(supabase as unknown as ReturnType<typeof makeSupabase>);

    const result = await addToDeadLetterQueue(ctx, {
      workflowId: WORKFLOW_ID,
      runId: RUN_ID,
      stepIndex: 0,
      actionType: 'send_email',
      error: 'Timeout',
      errorClassification: 'transient',
      retryCount: 0,
    });

    expect(result).toBeNull();
  });
});
