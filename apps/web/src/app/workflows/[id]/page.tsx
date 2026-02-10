'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useWorkflow, useWorkflowRuns, useToggleWorkflow, useDeleteWorkflow } from '@/hooks/use-workflows';
import Link from 'next/link';

const triggerLabels: Record<string, string> = {
  stage_change: 'Stage Change',
  new_lead: 'New Lead',
  time_based: 'Scheduled',
  field_change: 'Field Change',
  no_activity: 'No Activity',
  date_approaching: 'Date Approaching',
  form_submitted: 'Form Submitted',
};

const actionLabels: Record<string, string> = {
  send_email: 'Send Email',
  send_sms: 'Send SMS',
  create_task: 'Create Task',
  assign_contact: 'Assign Contact',
  update_field: 'Update Field',
  add_tag: 'Add Tag',
  notify_agent: 'Notify Agent',
  post_social: 'Post to Social',
  webhook: 'Webhook',
  wait: 'Wait',
  create_follow_up: 'Create Follow-Up',
};

const runStatusColors: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  running: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: workflow, isLoading, error } = useWorkflow(id);
  const { data: runs } = useWorkflowRuns(id);
  const { mutate: toggle, isPending: isToggling } = useToggleWorkflow(id);
  const { mutate: deleteWorkflow, isPending: isDeleting } = useDeleteWorkflow(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading workflow...</div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Workflow not found.</p>
        <Link href="/workflows" className="mt-2 text-sm text-red-600 underline">
          Back to workflows
        </Link>
      </div>
    );
  }

  const trigger = workflow.trigger as Record<string, unknown>;
  const conditions = (workflow.conditions ?? []) as Array<{ field: string; operator: string; value?: unknown }>;
  const actions = (workflow.actions ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/workflows" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Workflows
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{workflow.name as string}</h1>
          {workflow.description && (
            <p className="mt-1 text-sm text-gray-500">{workflow.description as string}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggle(!(workflow.is_active as boolean))}
            disabled={isToggling}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              (workflow.is_active as boolean)
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              isToggling && 'opacity-50',
            )}
          >
            {(workflow.is_active as boolean) ? 'Active' : 'Paused'}
          </button>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this workflow?')) {
                deleteWorkflow(undefined, {
                  onSuccess: () => {
                    window.location.href = '/workflows';
                  },
                });
              }
            }}
            disabled={isDeleting}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trigger */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Trigger</h2>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {triggerLabels[trigger.type as string] ?? (trigger.type as string)}
              </span>
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              {Object.entries(trigger)
                .filter(([key]) => key !== 'type')
                .map(([key, value]) => (
                  <div key={key}>
                    <span className="font-medium text-gray-600">{key}:</span> {String(value)}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Conditions</h2>
          {conditions.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">No conditions - runs every time trigger fires.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {conditions.map((condition, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                  <span className="font-medium text-gray-700">{condition.field}</span>
                  <span className="text-gray-500">{condition.operator}</span>
                  {condition.value !== undefined && (
                    <span className="font-mono text-gray-700">{String(condition.value)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Actions ({actions.length})</h2>
        <div className="mt-3 space-y-3">
          {actions.map((action, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {actionLabels[action.type as string] ?? (action.type as string)}
                </p>
                <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                  {Object.entries(action)
                    .filter(([key]) => key !== 'type')
                    .map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium text-gray-600">{key}:</span>{' '}
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Run History */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Run History</h2>
        {!runs || runs.length === 0 ? (
          <p className="mt-3 text-xs text-gray-400">No runs yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Started</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Completed</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions Run</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {runs.map((run: Record<string, unknown>) => (
                  <tr key={run.id as string} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          runStatusColors[run.status as string] ?? 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {run.status as string}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {run.started_at ? new Date(run.started_at as string).toLocaleString('en-AU') : '-'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {run.completed_at ? new Date(run.completed_at as string).toLocaleString('en-AU') : '-'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {(run.current_action_index as number) ?? 0}
                    </td>
                    <td className="px-4 py-2 text-xs text-red-600">
                      {(run.error as string) ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
