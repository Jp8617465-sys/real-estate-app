'use client';

import { cn } from '@/lib/utils';
import { useToggleWorkflow } from '@/hooks/use-workflows';
import Link from 'next/link';

interface WorkflowCardProps {
  workflow: {
    id: string;
    name: string;
    description?: string;
    trigger: { type: string };
    actions: unknown[];
    is_active: boolean;
    updated_at: string;
  };
  lastRun?: {
    status: string;
    started_at: string;
  } | null;
}

const triggerLabels: Record<string, string> = {
  stage_change: 'Stage Change',
  new_lead: 'New Lead',
  time_based: 'Scheduled',
  field_change: 'Field Change',
  no_activity: 'No Activity',
  date_approaching: 'Date Approaching',
  form_submitted: 'Form Submitted',
};

const triggerColors: Record<string, string> = {
  stage_change: 'bg-blue-50 text-blue-700',
  new_lead: 'bg-green-50 text-green-700',
  time_based: 'bg-purple-50 text-purple-700',
  field_change: 'bg-yellow-50 text-yellow-700',
  no_activity: 'bg-red-50 text-red-700',
  date_approaching: 'bg-orange-50 text-orange-700',
  form_submitted: 'bg-indigo-50 text-indigo-700',
};

export function WorkflowCard({ workflow, lastRun }: WorkflowCardProps) {
  const { mutate: toggle, isPending } = useToggleWorkflow(workflow.id);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <Link href={`/workflows/${workflow.id}`} className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{workflow.name}</h3>
          {workflow.description && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{workflow.description}</p>
          )}
        </Link>

        {/* Active/Paused toggle */}
        <button
          onClick={() => toggle(!workflow.is_active)}
          disabled={isPending}
          className={cn(
            'ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
            workflow.is_active
              ? 'bg-green-50 text-green-700 hover:bg-green-100'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
            isPending && 'opacity-50',
          )}
        >
          {workflow.is_active ? 'Active' : 'Paused'}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {/* Trigger badge */}
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            triggerColors[workflow.trigger.type] ?? 'bg-gray-50 text-gray-600',
          )}
        >
          {triggerLabels[workflow.trigger.type] ?? workflow.trigger.type}
        </span>

        {/* Action count */}
        <span className="text-xs text-gray-500">
          {workflow.actions.length} action{workflow.actions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Last run info */}
      {lastRun && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              lastRun.status === 'completed' ? 'bg-green-500' : lastRun.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500',
            )}
          />
          <span>
            Last run {new Date(lastRun.started_at).toLocaleDateString('en-AU')} -{' '}
            {lastRun.status}
          </span>
        </div>
      )}
    </div>
  );
}
