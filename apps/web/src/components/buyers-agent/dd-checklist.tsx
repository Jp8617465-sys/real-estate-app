'use client';

import { cn } from '@/lib/utils';
import { useDueDiligenceChecklist } from '@/hooks/use-due-diligence';
import type {
  DueDiligenceCategory,
  DueDiligenceItemStatus,
  DueDiligenceAssignee,
  DueDiligenceItem,
} from '@realflow/shared';

interface DDChecklistProps {
  transactionId: string;
}

const CATEGORY_LABELS: Record<DueDiligenceCategory, string> = {
  legal: 'Legal',
  physical: 'Physical',
  financial: 'Financial',
  environmental: 'Environmental',
  council: 'Council',
  strata: 'Strata',
};

const STATUS_LABELS: Record<DueDiligenceItemStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  issue_found: 'Issue Found',
  not_applicable: 'N/A',
};

const STATUS_COLORS: Record<DueDiligenceItemStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  issue_found: 'bg-red-100 text-red-700',
  not_applicable: 'bg-gray-50 text-gray-400',
};

const ASSIGNEE_LABELS: Record<DueDiligenceAssignee, string> = {
  buyers_agent: "Buyer's Agent",
  solicitor: 'Solicitor',
  broker: 'Broker',
  building_inspector: 'Building Inspector',
  pest_inspector: 'Pest Inspector',
  client: 'Client',
};

function groupByCategory(items: DueDiligenceItem[]): Record<string, DueDiligenceItem[]> {
  const groups: Record<string, DueDiligenceItem[]> = {};
  for (const item of items) {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  }
  return groups;
}

function CompletionBar({ percentage }: { percentage: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-gray-100">
        <div
          className={cn(
            'h-2 rounded-full transition-all',
            percentage === 100 ? 'bg-green-500' : percentage >= 50 ? 'bg-blue-500' : 'bg-yellow-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-600">{percentage}%</span>
    </div>
  );
}

export function DDChecklist({ transactionId }: DDChecklistProps) {
  const { data: checklist, isLoading } = useDueDiligenceChecklist(transactionId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-4 w-48 rounded bg-gray-200" />
        <div className="h-2 w-full rounded bg-gray-200" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">No due diligence checklist found for this transaction.</p>
      </div>
    );
  }

  const items = (checklist.items ?? []) as DueDiligenceItem[];
  const grouped = groupByCategory(items);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Due Diligence Checklist</h3>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              checklist.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : checklist.status === 'blocked'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700',
            )}
          >
            {checklist.status === 'not_started'
              ? 'Not Started'
              : checklist.status === 'in_progress'
                ? 'In Progress'
                : checklist.status === 'completed'
                  ? 'Completed'
                  : 'Blocked'}
          </span>
        </div>
        <div className="mt-3">
          <CompletionBar percentage={checklist.completion_percentage ?? 0} />
        </div>
      </div>

      {/* Category Groups */}
      <div className="divide-y divide-gray-100">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="px-6 py-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {CATEGORY_LABELS[category as DueDiligenceCategory] ?? category}
            </h4>
            <div className="space-y-2">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2',
                    item.isBlocking
                      ? 'border-red-200 bg-red-50'
                      : item.isCritical
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-gray-100 bg-white',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {/* Status checkbox indicator */}
                    <div
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border',
                        item.status === 'completed'
                          ? 'border-green-500 bg-green-500 text-white'
                          : item.status === 'issue_found'
                            ? 'border-red-500 bg-red-500 text-white'
                            : 'border-gray-300 bg-white',
                      )}
                    >
                      {item.status === 'completed' && (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {item.status === 'issue_found' && (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01" />
                        </svg>
                      )}
                    </div>

                    <div>
                      <span className="text-sm text-gray-900">{item.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.isBlocking && (
                          <span className="text-[10px] font-semibold uppercase text-red-600">Blocking</span>
                        )}
                        {item.isCritical && !item.isBlocking && (
                          <span className="text-[10px] font-semibold uppercase text-amber-600">Critical</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[item.status])}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                      {ASSIGNEE_LABELS[item.assignedTo]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-gray-400">No checklist items yet.</p>
        </div>
      )}
    </div>
  );
}
