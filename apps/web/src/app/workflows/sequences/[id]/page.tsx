'use client';

import { useState } from 'react';
import { use } from 'react';
import { useFollowUpSequences, useSequenceEnrollments, usePauseEnrollment, useResumeEnrollment, useCancelEnrollment } from '@/hooks/use-follow-up-sequences';
import { SequenceStepList } from '@/components/workflows/sequence-step-list';
import type { FollowUpSequence, SequenceEnrollment } from '@realflow/shared';

const STATUS_BADGES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  paused: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function EnrollmentRow({
  enrollment,
}: {
  enrollment: SequenceEnrollment & { contacts?: { first_name: string; last_name: string; email: string } };
}) {
  const pauseEnrollment = usePauseEnrollment();
  const resumeEnrollment = useResumeEnrollment();
  const cancelEnrollment = useCancelEnrollment();

  const contact = (enrollment as Record<string, unknown>).contacts as
    | { first_name: string; last_name: string; email: string }
    | undefined;

  const statusClass = STATUS_BADGES[enrollment.status] ?? STATUS_BADGES['cancelled']!;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm">
        {contact ? (
          <div>
            <p className="font-medium text-gray-900">
              {contact.first_name} {contact.last_name}
            </p>
            <p className="text-xs text-gray-500">{contact.email}</p>
          </div>
        ) : (
          <span className="text-gray-400">{enrollment.contactId}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        Step {(enrollment.currentStepIndex ?? 0) + 1}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}>
          {enrollment.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDate(enrollment.nextStepDueAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {enrollment.status === 'active' && (
            <button
              onClick={() => pauseEnrollment.mutate(enrollment.id)}
              disabled={pauseEnrollment.isPending}
              className="text-xs font-medium text-yellow-600 hover:text-yellow-700 disabled:opacity-50"
            >
              Pause
            </button>
          )}
          {enrollment.status === 'paused' && (
            <button
              onClick={() => resumeEnrollment.mutate(enrollment.id)}
              disabled={resumeEnrollment.isPending}
              className="text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
            >
              Resume
            </button>
          )}
          {(enrollment.status === 'active' || enrollment.status === 'paused') && (
            <button
              onClick={() => cancelEnrollment.mutate(enrollment.id)}
              disabled={cancelEnrollment.isPending}
              className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<string | undefined>(
    undefined,
  );

  const { data: sequences, isLoading: seqLoading } = useFollowUpSequences();
  const { data: enrollments, isLoading: enrollLoading } = useSequenceEnrollments(id, {
    status: enrollmentStatusFilter,
  });

  const sequence = (sequences ?? []).find((s: FollowUpSequence) => s.id === id);

  if (seqLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!sequence) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Sequence not found.
      </div>
    );
  }

  const stepCount = Array.isArray(sequence.steps) ? sequence.steps.length : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{sequence.name}</h1>
            {sequence.isTemplate && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                Template
              </span>
            )}
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                sequence.isActive ? 'bg-green-400' : 'bg-gray-300'
              }`}
              title={sequence.isActive ? 'Active' : 'Inactive'}
            />
          </div>
          {sequence.description && (
            <p className="mt-1 text-sm text-gray-500">{sequence.description}</p>
          )}
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>
            <span className="font-medium text-gray-900">{stepCount}</span> steps
          </p>
          <p className="mt-0.5">
            <span className="font-medium text-gray-900">
              {(enrollments ?? []).length}
            </span>{' '}
            enrollments
          </p>
        </div>
      </div>

      {/* Steps section */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-base font-semibold text-gray-900">Sequence Steps</h2>
        <SequenceStepList steps={Array.isArray(sequence.steps) ? sequence.steps : []} />
      </section>

      {/* Enrollments section */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Enrollments</h2>
          <div className="flex gap-1">
            {(['all', 'active', 'paused', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() =>
                  setEnrollmentStatusFilter(status === 'all' ? undefined : status)
                }
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  (status === 'all' ? enrollmentStatusFilter === undefined : enrollmentStatusFilter === status)
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {enrollLoading && (
          <div className="p-6">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!enrollLoading && (enrollments ?? []).length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            No enrollments yet.
          </p>
        )}

        {!enrollLoading && (enrollments ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Step
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Next Due
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {(enrollments as SequenceEnrollment[]).map((enrollment) => (
                  <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
