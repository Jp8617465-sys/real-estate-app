import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { DailyActionItem } from '@realflow/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

async function getToken(): Promise<string> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? '';
}

export function useDailyActions() {
  const today = new Date().toISOString().split('T')[0]!;

  return useQuery({
    queryKey: ['daily-actions', today],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE}/api/v1/daily-actions?date=${today}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) throw new Error('Failed to fetch daily actions');
      return res.json() as Promise<{ data: DailyActionItem[]; meta: { urgentCount: number; completedCount: number; totalCount: number; cached?: boolean } }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCompleteDailyAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await fetch(`${API_BASE}/api/v1/daily-actions/${actionId}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });
      if (!res.ok) throw new Error('Failed to complete action');
      return res.json();
    },
    onMutate: async (actionId: string) => {
      // Optimistic update: mark as completed immediately
      await queryClient.cancelQueries({ queryKey: ['daily-actions'] });

      queryClient.setQueriesData<{ data: DailyActionItem[] }>(
        { queryKey: ['daily-actions'] },
        (old) =>
          old
            ? {
                ...old,
                data: old.data.map((item) =>
                  item.id === actionId ? { ...item, isCompleted: true, completedAt: new Date().toISOString() } : item,
                ),
              }
            : old,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-actions'] });
    },
  });
}

export function useRegenerateDailyActions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split('T')[0]!;
      const res = await fetch(`${API_BASE}/api/v1/daily-actions/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ date: today }),
      });
      if (!res.ok) throw new Error('Regeneration failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-actions'] });
    },
  });
}
