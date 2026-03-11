'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface OffMarketProperty {
  id: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  askingPrice: number | null;
  source: string;
  visibility: 'agent_only' | 'sent_to_client';
  status: 'active' | 'under_offer' | 'sold' | 'withdrawn';
  createdAt: string;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

const STATUS_COLOURS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  under_offer: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-gray-100 text-gray-700',
  withdrawn: 'bg-red-100 text-red-800',
};

export default function OffMarketClient() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const { data, isLoading, error } = useQuery({
    queryKey: ['off-market', statusFilter],
    queryFn: () =>
      apiRequest(`/api/v1/off-market?status=${statusFilter}`).then(
        (r) => r.data as OffMarketProperty[],
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/v1/off-market/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['off-market'] }),
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });

  if (isLoading)
    return <div className="p-6 text-sm text-gray-500">Loading off-market properties...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">Failed to load properties.</div>;

  const properties = data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Off-Market Properties</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="active">Active</option>
            <option value="under_offer">Under Offer</option>
            <option value="sold">Sold</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <Link
            href="/buyers-agent/off-market/new"
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Add Off-Market
          </Link>
        </div>
      </div>

      {properties.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No {statusFilter} off-market properties.{' '}
          <Link href="/buyers-agent/off-market/new" className="text-blue-600 hover:underline">
            Add one
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {properties.map((prop) => (
          <div key={prop.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[prop.status] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {prop.status.replace('_', ' ')}
                  </span>
                  {prop.visibility === 'sent_to_client' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      Visible to client
                    </span>
                  )}
                </div>
                <Link href={`/buyers-agent/off-market/${prop.id}`} className="hover:underline">
                  <h2 className="text-base font-medium text-gray-900">
                    {prop.addressLine1}, {prop.suburb} {prop.state} {prop.postcode}
                  </h2>
                </Link>
                <p className="text-sm text-gray-600 mt-0.5">
                  {prop.propertyType} · {prop.bedrooms ?? '?'}bd · {prop.bathrooms ?? '?'}ba
                  {prop.askingPrice &&
                    ` · ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(prop.askingPrice)}`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Source: {prop.source.replace('_', ' ')} · Added{' '}
                  {new Date(prop.createdAt).toLocaleDateString('en-AU')}
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/buyers-agent/off-market/${prop.id}`}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  View
                </Link>
                <button
                  onClick={() => {
                    if (confirm('Delete this off-market property?')) {
                      deleteMutation.mutate(prop.id);
                    }
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
