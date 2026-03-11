import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { OffMarketProperty, OffMarketStats, CreateOffMarketProperty } from '@realflow/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

async function getToken(): Promise<string> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? '';
}

// ─── useOffMarketProperties ───────────────────────────────────────────────────

export function useOffMarketProperties(status?: string) {
  return useQuery({
    queryKey: ['off-market', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`${API_BASE}/api/v1/off-market${params}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch off-market properties');
      const json = (await res.json()) as { data: OffMarketProperty[] };
      return json.data;
    },
    staleTime: 60_000,
  });
}

// ─── useOffMarketStats ────────────────────────────────────────────────────────

export function useOffMarketStats() {
  return useQuery({
    queryKey: ['off-market-stats'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/off-market/stats`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch off-market stats');
      const json = (await res.json()) as { data: OffMarketStats };
      return json.data;
    },
    staleTime: 300_000,
  });
}

// ─── useCreateOffMarketProperty ───────────────────────────────────────────────

export function useCreateOffMarketProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOffMarketProperty) => {
      const res = await fetch(`${API_BASE}/api/v1/off-market`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create off-market property');
      const json = (await res.json()) as { data: OffMarketProperty };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['off-market'] });
    },
  });
}

// ─── useDeleteOffMarketProperty ───────────────────────────────────────────────

export function useDeleteOffMarketProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/v1/off-market/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to delete off-market property');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['off-market'] });
    },
  });
}
