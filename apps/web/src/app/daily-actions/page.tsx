'use client';

import {
  useDailyActions,
  useCompleteDailyAction,
  useRegenerateDailyActions,
} from '@/hooks/use-daily-actions';
import type { DailyActionItem } from '@realflow/shared';

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

function getPriorityLabel(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' };
  if (score >= 40)
    return { label: 'Due Today', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  return { label: 'Suggested', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
}

function getPriorityBarColor(score: number): string {
  if (score >= 80) return 'bg-red-500';
  if (score >= 40) return 'bg-orange-400';
  return 'bg-blue-400';
}

function ActionCard({ item, onComplete }: { item: DailyActionItem; onComplete: () => void }) {
  const isCompleted = item.isCompleted;
  const emoji = CATEGORY_EMOJI[item.category] ?? '✅';
  const priority = getPriorityLabel(item.compositeScore ?? 0);

  return (
    <div
      className={`flex items-start gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
        isCompleted ? 'opacity-50' : ''
      }`}
    >
      {/* Priority bar */}
      <div
        className={`w-1 self-stretch shrink-0 ${
          isCompleted ? 'bg-gray-300' : getPriorityBarColor(item.compositeScore ?? 0)
        }`}
      />

      <div className="flex flex-1 items-start gap-3 p-4">
        {/* Emoji */}
        <span className="mt-0.5 text-lg leading-none">{emoji}</span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`text-sm font-semibold ${
                isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            >
              {item.title}
            </p>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${priority.cls}`}
            >
              {priority.label}
            </span>
          </div>
          {item.subtitle && item.subtitle !== item.title && (
            <p className="mt-1 text-sm text-gray-500">{item.subtitle}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
            <span>Score: {item.compositeScore ?? 0}</span>
          </div>
        </div>

        {/* Complete button */}
        <button
          onClick={onComplete}
          disabled={isCompleted}
          className={`shrink-0 rounded-full border-2 p-1.5 transition-colors ${
            isCompleted
              ? 'cursor-default border-green-400 bg-green-400 text-white'
              : 'border-gray-300 text-gray-400 hover:border-brand-500 hover:text-brand-500'
          }`}
          aria-label={isCompleted ? 'Completed' : 'Mark done'}
        >
          {isCompleted ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

const SECTIONS = [
  {
    key: 'urgent',
    title: '🔴 Urgent',
    bgColor: 'bg-red-50',
    filter: (i: DailyActionItem) => (i.compositeScore ?? 0) >= 80 && !i.isCompleted,
  },
  {
    key: 'today',
    title: '🟠 Due Today',
    bgColor: 'bg-orange-50',
    filter: (i: DailyActionItem) =>
      (i.compositeScore ?? 0) >= 40 && (i.compositeScore ?? 0) < 80 && !i.isCompleted,
  },
  {
    key: 'suggested',
    title: '🔵 Suggested',
    bgColor: 'bg-blue-50',
    filter: (i: DailyActionItem) => (i.compositeScore ?? 0) < 40 && !i.isCompleted,
  },
  {
    key: 'completed',
    title: '✓ Completed',
    bgColor: 'bg-gray-50',
    filter: (i: DailyActionItem) => i.isCompleted,
  },
] as const;

export default function DailyActionsPage() {
  const { data: response, isLoading, refetch: _refetch } = useDailyActions();
  const completeAction = useCompleteDailyAction();
  const regenerate = useRegenerateDailyActions();

  const items = response?.data ?? [];
  const meta = response?.meta;

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const sections = SECTIONS.map((s) => ({
    ...s,
    data: items.filter(s.filter),
  })).filter((s) => s.data.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Actions</h1>
          <p className="mt-1 text-sm text-gray-500">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {meta !== undefined && (
            <div className="text-right text-sm">
              <span className="font-bold text-gray-900">{meta.totalCount}</span>
              <span className="text-gray-500"> actions</span>
              {meta.urgentCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {meta.urgentCount} urgent
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {regenerate.isPending ? 'Regenerating…' : '↺ Regenerate'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && items.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-center gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="h-12 w-1 rounded-full bg-gray-200" />
              <div className="h-8 w-8 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-gray-200" />
                <div className="h-2.5 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <span className="text-5xl">🎉</span>
          <p className="mt-3 text-base font-medium text-gray-900">All done for today!</p>
          <p className="mt-1 text-sm text-gray-500">No actions remaining.</p>
          <button
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
            className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Regenerate list
          </button>
        </div>
      )}

      {/* Sections */}
      {!isLoading &&
        sections.map((section) => (
          <section key={section.key}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">
              {section.title}
              <span className="ml-2 font-normal text-gray-400">({section.data.length})</span>
            </h2>
            <div className="space-y-2">
              {section.data.map((item) => (
                <ActionCard
                  key={item.id}
                  item={item}
                  onComplete={() => completeAction.mutate(item.id)}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
