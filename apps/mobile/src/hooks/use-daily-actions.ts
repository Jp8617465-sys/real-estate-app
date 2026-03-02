import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { DailyActionItem } from '@realflow/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

export function useDailyActions(agentId?: string) {
  const today = new Date().toISOString().split('T')[0]!;

  return useQuery({
    queryKey: ['daily-actions', agentId, today],
    queryFn: async () => {
      if (!agentId) return { data: [], meta: { urgentCount: 0, completedCount: 0, totalCount: 0 } };

      const res = await fetch(
        `${API_BASE}/api/v1/daily-actions?agent_id=${encodeURIComponent(agentId)}&date=${today}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
          },
        },
      );

      if (!res.ok) throw new Error('Failed to fetch daily actions');
      return res.json() as Promise<{ data: DailyActionItem[]; meta: { urgentCount: number; completedCount: number; totalCount: number; cached?: boolean } }>;
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCompleteDailyAction() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0]!;

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await fetch(`${API_BASE}/api/v1/daily-actions/${actionId}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
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
    mutationFn: async (agentId: string) => {
      const today = new Date().toISOString().split('T')[0]!;
      const res = await fetch(`${API_BASE}/api/v1/daily-actions/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ agent_id: agentId, date: today }),
      });
      if (!res.ok) throw new Error('Regeneration failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-actions'] });
    },
  });
}
