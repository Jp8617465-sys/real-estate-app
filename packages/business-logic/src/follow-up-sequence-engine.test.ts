import { describe, it, expect, vi } from 'vitest';
import {
  enrollContact,
  processEnrollmentStep,
  processDueEnrollments,
} from './follow-up-sequence-engine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSequence(steps = 2) {
  const stepsData = Array.from({ length: steps }, (_, i) => ({
    index: i,
    dayOffset: i * 2,
    action: { type: 'send_email', templateId: `template-${i}`, aiDraft: false },
    skipIfResponded: false,
  }));

  return {
    id: 'seq-1',
    name: 'Test Sequence',
    steps: stepsData,
    is_active: true,
    is_deleted: false,
  };
}

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enroll-1',
    sequence_id: 'seq-1',
    contact_id: 'contact-1',
    transaction_id: null,
    current_step_index: 0,
    status: 'active',
    ai_content_overrides: {},
    ...overrides,
  };
}

function makeMockSupabase({
  sequence = makeSequence(),
  enrollment = makeEnrollment(),
  insertError = null as { message: string } | null,
} = {}) {
  const updated: Record<string, unknown>[] = [];
  const inserted: Record<string, unknown>[] = [];

  const makeQB = (data: Record<string, unknown> | Record<string, unknown>[] | null) => {
    const qb = {
      select: () => qb,
      eq: () => qb,
      lte: () => qb,
      in: () => qb,
      update: (payload: Record<string, unknown>) => {
        updated.push(payload);
        return qb;
      },
      insert: (payload: Record<string, unknown>) => {
        inserted.push(payload);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: insertError ? null : { id: 'new-enroll-id', ...payload },
                error: insertError,
              }),
          }),
        };
      },
      single: () => Promise.resolve({ data, error: null }),
      then: (resolve: (r: { data: Record<string, unknown>[]; error: null }) => void) => {
        const arr = Array.isArray(data) ? data : data ? [data as Record<string, unknown>] : [];
        resolve({ data: arr, error: null });
      },
    };
    return qb;
  };

  const supabase = {
    from: (table: string) => {
      if (table === 'follow_up_sequences') return makeQB(sequence);
      if (table === 'sequence_enrollments') return makeQB(enrollment);
      if (table === 'contacts') return makeQB({ first_name: 'Jane', last_name: 'Smith' });
      return makeQB(null);
    },
    _updated: updated,
    _inserted: inserted,
  };

  return supabase;
}

// ─── enrollContact ────────────────────────────────────────────────────────────

describe('enrollContact', () => {
  it('creates enrollment with correct next_step_due_at for dayOffset=0', async () => {
    const supabase = makeMockSupabase();

    const result = await enrollContact({
      sequenceId: 'seq-1',
      contactId: 'contact-1',
      supabase: supabase as Parameters<typeof enrollContact>[0]['supabase'],
    });

    expect(result.enrollmentId).toBe('new-enroll-id');
    expect(result.nextStepDueAt).toBeTruthy();
  });

  it('throws if sequence not found', async () => {
    const supabase = makeMockSupabase({
      sequence: null as unknown as ReturnType<typeof makeSequence>,
    });
    supabase.from = (table: string) => {
      if (table === 'follow_up_sequences') {
        const qb = {
          select: () => qb,
          eq: () => qb,
          single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
        };
        return qb as unknown as ReturnType<typeof makeMockSupabase>['from'];
      }
      return makeMockSupabase().from(table);
    };

    await expect(
      enrollContact({
        sequenceId: 'nonexistent',
        contactId: 'contact-1',
        supabase: supabase as Parameters<typeof enrollContact>[0]['supabase'],
      }),
    ).rejects.toThrow('Sequence not found');
  });

  it('throws with duplicate-friendly message on unique constraint violation', async () => {
    const supabase = makeMockSupabase({
      insertError: { message: 'duplicate key value violates unique constraint' },
    });

    await expect(
      enrollContact({
        sequenceId: 'seq-1',
        contactId: 'contact-1',
        supabase: supabase as Parameters<typeof enrollContact>[0]['supabase'],
      }),
    ).rejects.toThrow('already enrolled');
  });
});

// ─── processEnrollmentStep ────────────────────────────────────────────────────

describe('processEnrollmentStep', () => {
  it('returns success and advances step index', async () => {
    const supabase = makeMockSupabase();

    const result = await processEnrollmentStep({
      enrollmentId: 'enroll-1',
      supabase: supabase as Parameters<typeof processEnrollmentStep>[0]['supabase'],
    });

    expect(result.success).toBe(true);
    expect(result.stepIndex).toBe(0);
    expect(result.actionType).toBe('send_email');
  });

  it('marks enrollment complete after final step', async () => {
    // Enrollment already on last step (index 1, sequence has 2 steps)
    const enrollment = makeEnrollment({ current_step_index: 1 });
    const supabase = makeMockSupabase({ enrollment });

    const result = await processEnrollmentStep({
      enrollmentId: 'enroll-1',
      supabase: supabase as Parameters<typeof processEnrollmentStep>[0]['supabase'],
    });

    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
  });

  it('returns error if enrollment not found', async () => {
    const supabase = makeMockSupabase({
      enrollment: null as unknown as ReturnType<typeof makeEnrollment>,
    });
    supabase.from = (table: string) => {
      if (table === 'sequence_enrollments') {
        const qb = {
          select: () => qb,
          eq: () => qb,
          single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
        };
        return qb as unknown as ReturnType<typeof makeMockSupabase>['from'];
      }
      return makeMockSupabase().from(table);
    };

    const result = await processEnrollmentStep({
      enrollmentId: 'enroll-1',
      supabase: supabase as Parameters<typeof processEnrollmentStep>[0]['supabase'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ─── processDueEnrollments ────────────────────────────────────────────────────

describe('processDueEnrollments', () => {
  it('returns zero processed when no due enrollments', async () => {
    const supabase = {
      from: (_table: string) => {
        const qb = {
          select: () => qb,
          eq: () => qb,
          lte: () => qb,
          then: (resolve: (r: { data: []; error: null }) => void) => {
            resolve({ data: [], error: null });
          },
        };
        return qb;
      },
    };

    const result = await processDueEnrollments({
      supabase: supabase as Parameters<typeof processDueEnrollments>[0]['supabase'],
    });

    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
  });
});
