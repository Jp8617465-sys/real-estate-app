'use client';

import { cn } from '@/lib/utils';
import { useUpcomingTasks } from '@/hooks/use-dashboard';

const priorityColors: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-gray-300',
};

function formatDueLabel(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return date.toLocaleDateString('en-AU', { weekday: 'short' });
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function UpcomingTasks() {
  const { data: tasks, isLoading } = useUpcomingTasks();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Tasks</h2>
        <a href="/tasks" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          View all
        </a>
      </div>

      {isLoading ? (
        <div className="mt-4 animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {(tasks ?? []).length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No upcoming tasks</p>
          ) : (
            (tasks ?? []).map((task) => (
              <div
                key={task.id}
                className={cn(
                  'rounded-lg border border-gray-200 border-l-4 bg-white p-3',
                  priorityColors[task.priority] ?? 'border-l-gray-300',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    {task.contact_name && (
                      <p className="mt-0.5 text-xs text-gray-500">{task.contact_name}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {formatDueLabel(task.due_date)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
