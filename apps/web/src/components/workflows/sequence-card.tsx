'use client';

import Link from 'next/link';
import type { FollowUpSequence } from '@realflow/shared';

const CATEGORY_LABELS: Record<string, string> = {
  new_lead: 'New Lead',
  post_engagement: 'Post-Engagement',
  property_match: 'Property Match',
  pre_settlement: 'Pre-Settlement',
  re_engagement: 'Re-engagement',
  general: 'General',
};

const TRIGGER_LABELS: Record<string, string> = {
  new_lead: 'New lead',
  stage_change: 'Stage change',
  no_activity: 'No activity',
  manual: 'Manual',
  workflow_trigger: 'Workflow trigger',
};

interface SequenceCardProps {
  sequence: FollowUpSequence;
  enrollmentCount?: number;
}

export function SequenceCard({ sequence, enrollmentCount }: SequenceCardProps) {
  const stepCount = Array.isArray(sequence.steps) ? sequence.steps.length : 0;
  const categoryLabel = CATEGORY_LABELS[sequence.category] ?? sequence.category;
  const triggerLabel = TRIGGER_LABELS[sequence.triggerType] ?? sequence.triggerType;

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">{sequence.name}</h3>
            {sequence.isTemplate && (
              <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                Template
              </span>
            )}
          </div>
          {sequence.description && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{sequence.description}</p>
          )}
        </div>

        {/* Active indicator */}
        <span
          className={`mt-0.5 shrink-0 h-2.5 w-2.5 rounded-full ${
            sequence.isActive ? 'bg-green-400' : 'bg-gray-300'
          }`}
          title={sequence.isActive ? 'Active' : 'Inactive'}
        />
      </div>

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {categoryLabel}
        </span>
        <span className="text-xs text-gray-400">Trigger: {triggerLabel}</span>
      </div>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>
          <span className="font-medium text-gray-900">{stepCount}</span> step
          {stepCount !== 1 ? 's' : ''}
        </span>
        {enrollmentCount !== undefined && (
          <span>
            <span className="font-medium text-gray-900">{enrollmentCount}</span> enrolled
          </span>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <Link
          href={`/workflows/sequences/${sequence.id}`}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View details →
        </Link>
      </div>
    </div>
  );
}
