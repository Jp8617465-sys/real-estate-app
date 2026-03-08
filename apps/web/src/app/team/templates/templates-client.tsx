'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface TeamTemplate {
  id: string;
  name: string;
  sharedAt: string;
  sharedBy: string;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

export default function TeamTemplatesClient() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['team-templates'],
    queryFn: () => apiRequest('/api/v1/team/workflow-templates').then(r => r.data as TeamTemplate[]),
  });

  const unshareMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/v1/team/workflow-templates/${id}/share`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-templates'] }),
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading templates...</div>;

  const templates = data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Shared Workflow Templates</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Templates shared here are visible to all agents in your office. You can share your own workflows from the Workflows section.
      </p>

      {templates.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No shared templates yet. Go to Workflows and share one with your team.
        </div>
      )}

      <div className="space-y-3">
        {templates.map((template: TeamTemplate) => (
          <div key={template.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">{template.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Shared {new Date(template.sharedAt).toLocaleDateString('en-AU')}
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm('Unshare this template?')) unshareMutation.mutate(template.id);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-red-600 hover:bg-red-50 shrink-0"
            >
              Unshare
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
