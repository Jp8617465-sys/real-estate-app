'use client';

import { cn, formatDate } from '@/lib/utils';
import { useKeyDates } from '@/hooks/use-key-dates';
import type { KeyDateStatus } from '@realflow/shared';

interface KeyDatesTimelineProps {
  transactionId: string;
}

const STATUS_COLORS: Record<KeyDateStatus, { dot: string; border: string; text: string }> = {
  upcoming: {
    dot: 'bg-blue-500',
    border: 'border-blue-200',
    text: 'text-blue-700',
  },
  due_soon: {
    dot: 'bg-yellow-500',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
  },
  overdue: {
    dot: 'bg-red-500',
    border: 'border-red-200',
    text: 'text-red-700',
  },
  completed: {
    dot: 'bg-green-500',
    border: 'border-green-200',
    text: 'text-green-700',
  },
};

const STATUS_LABELS: Record<KeyDateStatus, string> = {
  upcoming: 'Upcoming',
  due_soon: 'Due Soon',
  overdue: 'Overdue',
  completed: 'Completed',
};

export function KeyDatesTimeline({ transactionId }: KeyDatesTimelineProps) {
  const { data: keyDates, isLoading } = useKeyDates(transactionId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-3 w-3 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-40 rounded bg-gray-200" />
                <div className="h-2 w-24 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!keyDates || keyDates.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">No key dates set for this transaction.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Key Dates</h3>
      </div>

      <div className="px-6 py-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-gray-200" />

          <div className="space-y-6">
            {keyDates.map((keyDate) => {
              const status = (keyDate.status as KeyDateStatus) ?? 'upcoming';
              const colors = STATUS_COLORS[status];
              const isCritical = keyDate.is_critical;

              return (
                <div key={keyDate.id} className="relative flex gap-4 pl-6">
                  {/* Dot */}
                  <div
                    className={cn(
                      'absolute left-0 top-1 h-3 w-3 rounded-full ring-2 ring-white',
                      colors.dot,
                      isCritical && 'ring-2 ring-red-200',
                    )}
                  />

                  {/* Content */}
                  <div
                    className={cn(
                      'flex-1 rounded-lg border p-3',
                      isCritical ? 'border-red-200 bg-red-50' : colors.border,
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {keyDate.label}
                          {isCritical && (
                            <span className="ml-2 text-[10px] font-semibold uppercase text-red-600">
                              Critical
                            </span>
                          )}
                        </p>
                        <p className={cn('mt-0.5 text-xs', colors.text)}>
                          {formatDate(keyDate.date)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          status === 'upcoming' && 'bg-blue-100 text-blue-700',
                          status === 'due_soon' && 'bg-yellow-100 text-yellow-700',
                          status === 'overdue' && 'bg-red-100 text-red-700',
                          status === 'completed' && 'bg-green-100 text-green-700',
                        )}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    {keyDate.notes && (
                      <p className="mt-1.5 text-xs text-gray-500">{keyDate.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
