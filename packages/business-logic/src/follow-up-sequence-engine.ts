/**
 * Follow-Up Sequence Engine
 *
 * Manages enrollment into multi-channel follow-up sequences and executes
 * steps by delegating to the existing workflow-engine executeAction().
 */

import type { SequenceStep } from '@realflow/shared';
import { executeAction, type WorkflowContext } from './workflow-engine';

// ─── Supabase client interface ────────────────────────────────────────────────

interface QueryResult<T = Record<string, unknown>> {
  data: T | null;
  error: { message: string } | null;
}

interface QueryBuilder {
  select: (cols: string) => QueryBuilder;
  eq: (col: string, val: unknown) => QueryBuilder;
  lte: (col: string, val: unknown) => QueryBuilder;
  update: (data: Record<string, unknown>) => QueryBuilder;
  insert: (data: Record<string, unknown>) => { select: () => { single: () => Promise<QueryResult> } };
  single: () => Promise<QueryResult>;
  then: (resolve: (result: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => void) => void;
}

export interface FSESupabaseClient {
  from: (table: string) => QueryBuilder;
}

// ─── AI client interface (optional) ──────────────────────────────────────────

export interface FSEAIClient {
  generateSequenceContent: (params: {
    stepAction: 'send_email' | 'send_sms';
    dayOffset: number;
    contactContext: { name: string; pipelineStage?: string; source?: string };
    sequenceName: string;
  }) => Promise<{ subject?: string; body: string; suggestedTone: string }>;
}

// ─── Enrollment ───────────────────────────────────────────────────────────────

export interface EnrollContactOptions {
  sequenceId: string;
  contactId: string;
  transactionId?: string;
  enrolledBy?: string;
  supabase: FSESupabaseClient;
}

export interface EnrollContactResult {
  enrollmentId: string;
  nextStepDueAt: string;
}

/**
 * Enroll a contact in a sequence.
 * The first step with dayOffset=0 is scheduled immediately; steps with dayOffset>0
 * are scheduled relative to enrollment date.
 */
export async function enrollContact(opts: EnrollContactOptions): Promise<EnrollContactResult> {
  const { sequenceId, contactId, transactionId, enrolledBy, supabase } = opts;

  // Fetch sequence to get first step's dayOffset
  const seqResult = await supabase
    .from('follow_up_sequences')
    .select('id, steps')
    .eq('id', sequenceId)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .single();

  if (seqResult.error || !seqResult.data) {
    throw new Error(`Sequence not found: ${sequenceId}`);
  }

  const steps = (seqResult.data.steps ?? []) as SequenceStep[];
  const firstStep = steps[0];
  const nextStepDueAt = firstStep
    ? addDays(new Date(), firstStep.dayOffset).toISOString()
    : new Date().toISOString();

  const insertResult = await supabase
    .from('sequence_enrollments')
    .insert({
      sequence_id: sequenceId,
      contact_id: contactId,
      transaction_id: transactionId ?? null,
      enrolled_by: enrolledBy ?? null,
      current_step_index: 0,
      status: 'active',
      next_step_due_at: nextStepDueAt,
    })
    .select()
    .single();

  if (insertResult.error) {
    if (insertResult.error.message.includes('unique')) {
      throw new Error(`Contact ${contactId} is already enrolled in sequence ${sequenceId}`);
    }
    throw new Error(`Failed to enroll contact: ${insertResult.error.message}`);
  }

  return {
    enrollmentId: (insertResult.data?.id as string) ?? '',
    nextStepDueAt,
  };
}

// ─── Step Processing ──────────────────────────────────────────────────────────

export interface ProcessEnrollmentOptions {
  enrollmentId: string;
  supabase: FSESupabaseClient;
  aiClient?: FSEAIClient;
}

export interface ProcessStepResult {
  enrollmentId: string;
  stepIndex: number;
  actionType: string;
  success: boolean;
  error?: string;
  nextStepDueAt?: string;
  completed?: boolean;
}

/**
 * Execute the current step for an enrollment.
 * After success, advance to the next step or mark complete.
 */
export async function processEnrollmentStep(opts: ProcessEnrollmentOptions): Promise<ProcessStepResult> {
  const { enrollmentId, supabase, aiClient } = opts;

  // Fetch enrollment + sequence
  const enrollResult = await supabase
    .from('sequence_enrollments')
    .select('id, sequence_id, contact_id, transaction_id, current_step_index, status, ai_content_overrides')
    .eq('id', enrollmentId)
    .eq('status', 'active')
    .single();

  if (enrollResult.error || !enrollResult.data) {
    return { enrollmentId, stepIndex: 0, actionType: 'unknown', success: false, error: 'Enrollment not found or not active' };
  }

  const enrollment = enrollResult.data;
  const currentIndex = enrollment.current_step_index as number;

  const seqResult = await supabase
    .from('follow_up_sequences')
    .select('id, name, steps')
    .eq('id', enrollment.sequence_id)
    .single();

  if (seqResult.error || !seqResult.data) {
    return { enrollmentId, stepIndex: currentIndex, actionType: 'unknown', success: false, error: 'Sequence not found' };
  }

  const steps = (seqResult.data.steps ?? []) as SequenceStep[];
  const currentStep = steps[currentIndex];

  if (!currentStep) {
    // No more steps — mark complete
    await supabase
      .from('sequence_enrollments')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', enrollmentId);
    return { enrollmentId, stepIndex: currentIndex, actionType: 'none', success: true, completed: true };
  }

  // ─── AI content override for email/sms steps ──────────────────────────────
  const action = { ...currentStep.action } as Record<string, unknown>;
  if (
    aiClient &&
    (currentStep.action.type === 'send_email' || currentStep.action.type === 'send_sms')
  ) {
    try {
      // Fetch contact name for context
      const contactResult = await supabase
        .from('contacts')
        .select('first_name, last_name')
        .eq('id', enrollment.contact_id)
        .single();

      const contactName = contactResult.data
        ? `${contactResult.data.first_name} ${contactResult.data.last_name}`
        : 'the contact';

      const aiContent = await aiClient.generateSequenceContent({
        stepAction: currentStep.action.type,
        dayOffset: currentStep.dayOffset,
        contactContext: { name: contactName as string },
        sequenceName: seqResult.data.name as string,
      });

      // Store AI-generated content as override (persisted for audit)
      const overrides = (enrollment.ai_content_overrides as Record<string, unknown>) ?? {};
      overrides[`step_${currentIndex}`] = aiContent;
      await supabase
        .from('sequence_enrollments')
        .update({ ai_content_overrides: overrides, updated_at: new Date().toISOString() })
        .eq('id', enrollmentId);
    } catch {
      // Graceful degradation — use template as-is
    }
  }

  // ─── Execute step via workflow engine ─────────────────────────────────────
  const context: WorkflowContext = {
    contactId: enrollment.contact_id as string,
    transactionId: enrollment.transaction_id as string | undefined,
    entityData: {},
    supabase: supabase as unknown as WorkflowContext['supabase'],
  };

  const result = await executeAction(currentStep.action as Parameters<typeof executeAction>[0], context);

  if (!result.success) {
    return {
      enrollmentId,
      stepIndex: currentIndex,
      actionType: currentStep.action.type,
      success: false,
      error: result.error,
    };
  }

  // ─── Advance to next step ──────────────────────────────────────────────────
  const nextIndex = currentIndex + 1;
  const nextStep = steps[nextIndex];

  if (!nextStep) {
    // Final step complete
    await supabase
      .from('sequence_enrollments')
      .update({
        current_step_index: nextIndex,
        status: 'completed',
        last_step_sent_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    return { enrollmentId, stepIndex: currentIndex, actionType: currentStep.action.type, success: true, completed: true };
  }

  // Schedule next step
  const nextStepDueAt = addDays(new Date(), nextStep.dayOffset - currentStep.dayOffset).toISOString();

  await supabase
    .from('sequence_enrollments')
    .update({
      current_step_index: nextIndex,
      last_step_sent_at: new Date().toISOString(),
      next_step_due_at: nextStepDueAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);

  return {
    enrollmentId,
    stepIndex: currentIndex,
    actionType: currentStep.action.type,
    success: true,
    nextStepDueAt,
  };
}

// ─── Bulk Processor (called by scheduler) ─────────────────────────────────────

export interface ProcessDueEnrollmentsOptions {
  supabase: FSESupabaseClient;
  aiClient?: FSEAIClient;
}

export interface BulkProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

/**
 * Query all active enrollments with next_step_due_at <= now() and process each.
 */
export async function processDueEnrollments(opts: ProcessDueEnrollmentsOptions): Promise<BulkProcessResult> {
  const { supabase, aiClient } = opts;

  const result = await new Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>(
    (resolve) => {
      supabase
        .from('sequence_enrollments')
        .select('id')
        .eq('status', 'active')
        .lte('next_step_due_at', new Date().toISOString())
        .then(resolve as Parameters<QueryBuilder['then']>[0]);
    },
  );

  if (!result.data || result.data.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, errors: [] };
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const enrollment of result.data) {
    try {
      const stepResult = await processEnrollmentStep({
        enrollmentId: enrollment.id as string,
        supabase,
        aiClient,
      });

      if (stepResult.success) {
        succeeded++;
      } else {
        failed++;
        if (stepResult.error) errors.push(`${enrollment.id}: ${stepResult.error}`);
      }
    } catch (err) {
      failed++;
      errors.push(`${enrollment.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { processed: result.data.length, succeeded, failed, errors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
