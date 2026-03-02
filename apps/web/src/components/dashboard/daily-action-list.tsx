'use client';

import Link from 'next/link';
import { useDailyActions, useCompleteDailyAction } from '@/hooks/use-daily-actions';
import type { DailyActionItem } from '@realflow/shared';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-400',
  low: 'bg-yellow-400',
};

const CATEGORY_EMOJI: Record<string, string> = {
  call: '📞',
  follow_up: '💬',
  key_date: '📅',
  inspection: '🏠',
  offer_review: '💰',
  document: '📄',
  pre_approval: '🏦',
  settlement: '🔑',
  general: '✅',
};

function getPriorityColor(score: number): string {
  if (score >= 80) return 'bg-red-500';
  if (score >= 40) return 'bg-orange-400';
  return 'bg-blue-400';
}

function ActionRow({
  item,
  onComplete,
}: {
  item: DailyActionItem;
  onComplete: () => void;
}) {
  const isCompleted = item.isCompleted;
  const emoji = CATEGORY_EMOJI[item.category] ?? '✅';

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5 transition-opacity ${
        isCompleted ? 'opacity-50' : ''
      }`}
    >
      {/* Priority bar */}
      <div
        className={`h-6 w-1 shrink-0 rounded-full ${
          isCompleted ? 'bg-gray-300' : getPriorityColor(item.compositeScore ?? 0)
        }`}
      />

      {/* Emoji */}
      <span className="text-sm">{emoji}</span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'
          }`}
        >
          {item.title}
        </p>
        {item.subtitle && item.subtitle !== item.title && (
          <p className="truncate text-xs text-gray-500">{item.subtitle}</p>
        )}
      </div>

      {/* Complete button */}
      <button
        onClick={onComplete}
        disabled={isCompleted}
        className={`shrink-0 rounded-full p-1 text-xs font-bold transition-colors ${
          isCompleted
            ? 'cursor-default text-green-600'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`}
        aria-label={isCompleted ? 'Completed' : 'Mark done'}
      >
        {isCompleted ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
          </svg>
        )}
      </button>
    </div>
  );
}

export function DailyActionList() {
  const { data: response, isLoading } = useDailyActions();
  const completeAction = useCompleteDailyAction();

  const items = response?.data ?? [];
  const meta = response?.meta;

  // Show top 5 incomplete first, then completed
  const incompleteItems = items.filter((i) => !i.isCompleted).slice(0, 5);
  const displayItems = incompleteItems.length > 0 ? incompleteItems : items.slice(0, 5);

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Today's Actions</h2>
          <p className="mt-0.5 text-xs text-gray-500">{today}</p>
        </div>
        {meta !== undefined && (
          <div className="text-right">
            <span className="text-sm font-bold text-gray-900">{meta.totalCount}</span>
            <span className="text-xs text-gray-500"> actions</span>
            {meta.urgentCount > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                {meta.urgentCount} urgent
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5">
              <div className="h-6 w-1 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-4 animate-pulse rounded bg-gray-100" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && displayItems.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">No actions today</p>
      )}

      {/* Action list */}
      {!isLoading && displayItems.length > 0 && (
        <div className="space-y-1.5">
          {displayItems.map((item) => (
            <ActionRow
              key={item.id}
              item={item}
              onComplete={() => completeAction.mutate(item.id)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <Link
          href="/daily-actions"
          className="block text-center text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View all actions →
        </Link>
      </div>
    </section>
  );
}
