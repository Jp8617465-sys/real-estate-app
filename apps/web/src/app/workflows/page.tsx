'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflows, useWorkflowTemplates, useCreateWorkflowFromTemplate } from '@/hooks/use-workflows';
import { WorkflowCard } from '@/components/workflows/workflow-card';
import Link from 'next/link';

type FilterTab = 'all' | 'active' | 'paused';

export default function WorkflowsPage() {
  const [tab, setTab] = useState<FilterTab>('all');
  const [showTemplates, setShowTemplates] = useState(false);

  const filter = tab === 'all' ? undefined : { isActive: tab === 'active' };
  const { data: workflows, isLoading, error } = useWorkflows(filter);
  const { data: templates } = useWorkflowTemplates();
  const { mutate: createFromTemplate, isPending: isCreating } = useCreateWorkflowFromTemplate();

  function handleCreateFromTemplate(templateId: number) {
    // Use a placeholder user ID for now (would come from auth context)
    createFromTemplate(
      { templateId, createdBy: '00000000-0000-0000-0000-000000000001' },
      { onSuccess: () => setShowTemplates(false) },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="mt-1 text-sm text-gray-500">Automate your real estate processes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            From Template
          </button>
          <Link
            href="/workflows/new"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            + Custom Workflow
          </Link>
        </div>
      </div>

      {/* Template picker */}
      {showTemplates && templates && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-brand-900">Pre-built Workflow Templates</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template: { id: number; name: string; description: string; category: string }) => (
              <button
                key={template.id}
                onClick={() => handleCreateFromTemplate(template.id)}
                disabled={isCreating}
                className="rounded-lg border border-brand-200 bg-white p-3 text-left transition-colors hover:border-brand-400 disabled:opacity-50"
              >
                <p className="text-sm font-medium text-gray-900">{template.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{template.description}</p>
                <span className="mt-2 inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {template.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'paused'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-gray-500">Loading workflows...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Failed to load workflows. Please try again.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && workflows?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
          <p className="text-sm font-medium text-gray-900">No workflows found</p>
          <p className="mt-1 text-sm text-gray-500">
            Create a workflow from a template or build a custom one.
          </p>
        </div>
      )}

      {/* Workflow grid */}
      {!isLoading && !error && workflows && workflows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow: Record<string, unknown>) => (
            <WorkflowCard
              key={workflow.id as string}
              workflow={{
                id: workflow.id as string,
                name: workflow.name as string,
                description: workflow.description as string | undefined,
                trigger: workflow.trigger as { type: string },
                actions: workflow.actions as unknown[],
                is_active: workflow.is_active as boolean,
                updated_at: workflow.updated_at as string,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
