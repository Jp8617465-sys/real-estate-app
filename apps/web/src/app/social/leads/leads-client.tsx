'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface SocialDmLead {
  id: string;
  channel: 'facebook_dm' | 'instagram_dm' | 'linkedin_dm';
  externalId: string;
  senderName: string | null;
  senderHandle: string | null;
  messageText: string | null;
  status: 'pending' | 'converted' | 'dismissed';
  contactId: string | null;
  agentId: string;
  createdAt: string;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

const CHANNEL_LABELS = {
  facebook_dm: 'Facebook',
  instagram_dm: 'Instagram',
  linkedin_dm: 'LinkedIn',
};

export default function SocialLeadsClient() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const { data, isLoading, error } = useQuery({
    queryKey: ['social-leads', statusFilter],
    queryFn: () => apiRequest(`/api/v1/social/leads?status=${statusFilter}`).then(r => r.data as SocialDmLead[]),
  });

  const convertMutation = useMutation({
    mutationFn: (leadId: string) =>
      apiRequest(`/api/v1/social/leads/${leadId}/convert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social-leads'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (leadId: string) =>
      apiRequest(`/api/v1/social/leads/${leadId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social-leads'] }),
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading leads...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">Failed to load social leads.</div>;

  const leads = data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Social DM Leads</h1>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="converted">Converted</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {leads.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No {statusFilter} leads at the moment.
        </div>
      )}

      <div className="space-y-3">
        {leads.map(lead => (
          <div key={lead.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {CHANNEL_LABELS[lead.channel]}
                </span>
                {lead.senderName && (
                  <span className="text-sm font-medium text-gray-900">{lead.senderName}</span>
                )}
                {lead.senderHandle && (
                  <span className="text-xs text-gray-500">@{lead.senderHandle}</span>
                )}
              </div>
              <p className="text-sm text-gray-700 truncate">{lead.messageText ?? '(no message text)'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(lead.createdAt).toLocaleString('en-AU')}
              </p>
            </div>

            {lead.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => convertMutation.mutate(lead.id)}
                  disabled={convertMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Convert
                </button>
                <button
                  onClick={() => dismissMutation.mutate(lead.id)}
                  disabled={dismissMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            )}

            {lead.status === 'converted' && (
              <span className="text-xs text-green-600 font-medium shrink-0">Converted</span>
            )}
            {lead.status === 'dismissed' && (
              <span className="text-xs text-gray-400 font-medium shrink-0">Dismissed</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
