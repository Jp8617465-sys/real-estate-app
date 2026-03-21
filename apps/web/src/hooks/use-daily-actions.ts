import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { DailyActionItem } from '@realflow/shared';

const supabase = createClient();

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}

interface DailyActionsResponse {
  data: DailyActionItem[];
  meta: { totalCount: number; urgentCount: number; date: string };
}

export function useDailyActions() {
  return useQuery({
    queryKey: ['daily-actions'],
    queryFn: async (): Promise<DailyActionsResponse> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/daily-actions', { headers });
      if (!res.ok) throw new Error('Failed to fetch daily actions');
      return res.json() as Promise<DailyActionsResponse>;
    },
  });
}

export function useCompleteDailyAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/daily-actions/${id}/complete`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error('Failed to complete action');
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['daily-actions'] });
      const previous = queryClient.getQueryData<DailyActionsResponse>(['daily-actions']);
      queryClient.setQueryData<DailyActionsResponse>(['daily-actions'], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((item) => (item.id === id ? { ...item, isCompleted: true } : item)),
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['daily-actions'], context.previous);
      }
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
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/daily-actions/regenerate', {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error('Failed to regenerate daily actions');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-actions'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}
