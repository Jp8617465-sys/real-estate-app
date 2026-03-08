'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface LeadAssignmentRule {
  id: string;
  name: string;
  ruleType: 'round_robin' | 'geographic' | 'specialisation' | 'manual';
  conditions: { leadSources?: string[]; suburbs?: string[] };
  priority: number;
  assigneeIds: string[];
  isActive: boolean;
  createdAt: string;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

const RULE_TYPE_LABELS = {
  round_robin: 'Round Robin',
  geographic: 'Geographic',
  specialisation: 'Specialisation',
  manual: 'Manual',
};

export default function AssignmentRulesClient() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['assignment-rules'],
    queryFn: () => apiRequest('/api/v1/team/assignment-rules').then(r => r.data as LeadAssignmentRule[]),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/v1/team/assignment-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignment-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/v1/team/assignment-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignment-rules'] }),
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading rules...</div>;

  const rules = (data ?? []).sort((a: LeadAssignmentRule, b: LeadAssignmentRule) => b.priority - a.priority);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Lead Assignment Rules</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Rules are evaluated in priority order. The first matching rule wins. Use round-robin to distribute leads evenly across your team.
      </p>

      {rules.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No assignment rules configured. Create a rule to automatically assign incoming leads.
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule: LeadAssignmentRule) => (
          <div key={rule.id} className={`bg-white rounded-lg border p-4 ${rule.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {RULE_TYPE_LABELS[rule.ruleType]}
                  </span>
                  <span className="text-xs text-gray-400">Priority: {rule.priority}</span>
                  {!rule.isActive && <span className="text-xs text-gray-400">(Inactive)</span>}
                </div>
                <h3 className="text-sm font-medium text-gray-900">{rule.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {rule.assigneeIds.length} assignee{rule.assigneeIds.length !== 1 ? 's' : ''}
                  {rule.conditions.leadSources?.length ? ` · Sources: ${rule.conditions.leadSources.join(', ')}` : ''}
                  {rule.conditions.suburbs?.length ? ` · Suburbs: ${rule.conditions.suburbs.join(', ')}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${rule.isActive ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                >
                  {rule.isActive ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this rule?')) deleteMutation.mutate(rule.id);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
