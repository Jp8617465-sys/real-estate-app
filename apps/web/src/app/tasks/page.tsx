'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTasks, useCompleteTask } from '@/hooks/use-tasks';

const priorityColors: Record<string, string> = {
  urgent: 'text-red-700 bg-red-50',
  high: 'text-orange-700 bg-orange-50',
  medium: 'text-yellow-700 bg-yellow-50',
  low: 'text-gray-600 bg-gray-50',
};

function TaskCheckbox({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) {
  const { mutate: complete, isPending } = useCompleteTask(taskId);

  return (
    <input
      type="checkbox"
      checked={isCompleted}
      disabled={isCompleted || isPending}
      onChange={() => complete()}
      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
    />
  );
}

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data: tasks, isLoading, error } = useTasks(
    statusFilter ? { status: statusFilter } : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your to-do list and follow-ups</p>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
          + Add Task
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {[
          { label: 'All', value: undefined },
          { label: 'Pending', value: 'pending' },
          { label: 'In Progress', value: 'in-progress' },
          { label: 'Completed', value: 'completed' },
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === tab.value
                ? 'bg-brand-100 text-brand-700'
                : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-gray-500">Loading tasks...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Failed to load tasks. Please try again.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && tasks?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
          <p className="text-sm font-medium text-gray-900">No tasks found</p>
          <p className="mt-1 text-sm text-gray-500">
            {statusFilter ? 'Try changing the filter or create a new task.' : 'Create your first task to get started.'}
          </p>
        </div>
      )}

      {/* Task table */}
      {!isLoading && !error && tasks && tasks.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-6 py-3" />
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.map((task: Record<string, string>) => (
                <tr key={task.id} className={cn('transition-colors', task.status === 'completed' ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50')}>
                  <td className="px-6 py-4">
                    <TaskCheckbox taskId={task.id} isCompleted={task.status === 'completed'} />
                  </td>
                  <td className="px-6 py-4">
                    <p className={cn('text-sm font-medium', task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                      {task.title}
                    </p>
                    <p className="text-xs capitalize text-gray-500">{task.type}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        priorityColors[task.priority] ?? 'text-gray-600 bg-gray-50',
                      )}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm capitalize text-gray-600">{task.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('en-AU') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
