'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface TeamPerformance {
  agentId: string;
  agentName: string;
  activeContacts: number;
  activeDeals: number;
  dealsClosed: number;
  avgResponseHours: number | null;
  leadsReceived: number;
  leadsConverted: number;
  conversionRate: number;
}

async function apiRequest(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export default function TeamDashboardClient() {
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => apiRequest('/api/v1/team/members').then(r => r.data as TeamMember[]),
  });

  const { data: perfData, isLoading: perfLoading } = useQuery({
    queryKey: ['team-performance'],
    queryFn: () => apiRequest('/api/v1/team/performance').then(r => r.data as TeamPerformance[]),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Team Dashboard</h1>
        <Link
          href="/team/assignment-rules"
          className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Manage Assignment Rules
        </Link>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link href="/team/performance" className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors">
          <div className="text-sm font-medium text-gray-600">Performance</div>
          <div className="text-xs text-gray-400 mt-1">View per-agent stats</div>
        </Link>
        <Link href="/team/assignment-rules" className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors">
          <div className="text-sm font-medium text-gray-600">Assignment Rules</div>
          <div className="text-xs text-gray-400 mt-1">Configure lead routing</div>
        </Link>
        <Link href="/team/templates" className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors">
          <div className="text-sm font-medium text-gray-600">Shared Templates</div>
          <div className="text-xs text-gray-400 mt-1">Team workflow templates</div>
        </Link>
      </div>

      {/* Team Members */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-800 mb-4">Team Members ({membersData?.length ?? 0})</h2>
        {membersLoading && <div className="text-sm text-gray-400">Loading...</div>}
        <div className="grid grid-cols-2 gap-3">
          {(membersData ?? []).map(m => (
            <div key={m.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                {m.firstName[0]}{m.lastName[0]}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{m.firstName} {m.lastName}</div>
                <div className="text-xs text-gray-500">{m.role} · {m.email}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Summary */}
      <div>
        <h2 className="text-lg font-medium text-gray-800 mb-4">Performance (Last 30 Days)</h2>
        {perfLoading && <div className="text-sm text-gray-400">Loading...</div>}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contacts</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deals</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Closed</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conv. Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(perfData ?? []).map(p => (
                <tr key={p.agentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.agentName}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{p.activeContacts}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{p.activeDeals}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{p.dealsClosed}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{p.conversionRate}%</td>
                </tr>
              ))}
              {(perfData ?? []).length === 0 && !perfLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No performance data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
