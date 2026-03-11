'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useFollowUpSequences, useSequenceTemplates } from '@/hooks/use-follow-up-sequences';
import { SequenceCard } from '@/components/workflows/sequence-card';
import type { FollowUpSequence } from '@realflow/shared';

const CATEGORY_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'New Lead', value: 'new_lead' },
  { label: 'Post-Engagement', value: 'post_engagement' },
  { label: 'Property Match', value: 'property_match' },
  { label: 'Pre-Settlement', value: 'pre_settlement' },
  { label: 'Re-engagement', value: 're_engagement' },
] as const;

export default function SequencesPage() {
  const [showTemplates, setShowTemplates] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  const { data: sequences, isLoading } = useFollowUpSequences(
    categoryFilter ? { category: categoryFilter } : undefined,
  );
  const { data: templates } = useSequenceTemplates();

  const mySequences = (sequences ?? []).filter((s: FollowUpSequence) => !s.isTemplate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-Up Sequences</h1>
          <p className="mt-1 text-sm text-gray-500">
            Automate multi-step outreach for your contacts
          </p>
        </div>
        <button
          onClick={() => setShowTemplates((p) => !p)}
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition-colors',
            showTemplates
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
          )}
        >
          {showTemplates ? '✕ Hide Templates' : '📋 Use a Template'}
        </button>
      </div>

      {/* Template picker */}
      {showTemplates && templates && templates.length > 0 && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h3 className="mb-4 text-sm font-semibold text-brand-900">
            Pre-built Sequence Templates
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(templates as FollowUpSequence[]).map((template) => (
              <SequenceCard key={template.id} sequence={template} />
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setCategoryFilter(f.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              categoryFilter === f.value
                ? 'bg-brand-100 text-brand-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
              <div className="h-4 w-2/3 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-full rounded bg-gray-100" />
              <div className="mt-3 h-3 w-1/3 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && mySequences.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
          <span className="text-4xl">🤖</span>
          <p className="mt-3 text-sm font-medium text-gray-900">No custom sequences yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Start from a template above or build your own.
          </p>
        </div>
      )}

      {/* Sequences grid */}
      {!isLoading && mySequences.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mySequences.map((sequence: FollowUpSequence) => (
            <SequenceCard key={sequence.id} sequence={sequence} />
          ))}
        </div>
      )}
    </div>
  );
}
