'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

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

export default function TeamPerformanceClient() {
  const [days, setDays] = useState(30);

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];

  const { data, isLoading } = useQuery({
    queryKey: ['team-performance', days],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/team/performance?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Failed to fetch performance');
      return (await res.json()).data as TeamPerformance[];
    },
  });

  const sorted = (data ?? []).slice().sort((a, b) => b.dealsClosed - a.dealsClosed);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Team Performance</h1>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {isLoading && <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Contacts</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Active Deals</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Closed</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Leads In</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Converted</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Conv. %</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((p, i) => (
              <tr key={p.agentId} className={i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                <td className="px-5 py-3 text-sm font-medium text-gray-900">
                  {i === 0 && <span className="mr-1 text-yellow-500">★</span>}
                  {p.agentName}
                </td>
                <td className="px-5 py-3 text-sm text-right text-gray-700">{p.activeContacts}</td>
                <td className="px-5 py-3 text-sm text-right text-gray-700">{p.activeDeals}</td>
                <td className="px-5 py-3 text-sm text-right font-semibold text-gray-900">{p.dealsClosed}</td>
                <td className="px-5 py-3 text-sm text-right text-gray-700">{p.leadsReceived}</td>
                <td className="px-5 py-3 text-sm text-right text-gray-700">{p.leadsConverted}</td>
                <td className="px-5 py-3 text-sm text-right font-medium text-gray-900">{p.conversionRate}%</td>
                <td className="px-5 py-3 text-sm text-right text-gray-500">
                  {p.avgResponseHours != null ? `${p.avgResponseHours.toFixed(1)}h` : '—'}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                  No performance data for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
