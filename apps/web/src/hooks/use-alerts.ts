'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PropertyAlertEvent,
  PropertyAlertSubscription,
  CreateAlertSubscription,
  UpdateAlertSubscription,
} from '@realflow/shared';
import { apiFetch } from '@/lib/api-client';

// ─── hooks ───────────────────────────────────────────────────────────────────

export function useAlertEvents(limit = 50) {
  return useQuery<PropertyAlertEvent[]>({
    queryKey: ['alert-events', limit],
    queryFn: async () => {
      const { data } = await apiFetch<{ data: PropertyAlertEvent[] }>(
        `/api/v1/alerts/events?limit=${limit}`,
      );
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useAlertSubscriptions() {
  return useQuery<PropertyAlertSubscription[]>({
    queryKey: ['alert-subscriptions'],
    queryFn: async () => {
      const { data } = await apiFetch<{ data: PropertyAlertSubscription[] }>(
        '/api/v1/alerts/subscriptions',
      );
      return data;
    },
  });
}

export function useCreateAlertSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAlertSubscription) =>
      apiFetch<{ data: PropertyAlertSubscription }>('/api/v1/alerts/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-subscriptions'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useUpdateAlertSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateAlertSubscription) =>
      apiFetch<{ data: PropertyAlertSubscription }>(`/api/v1/alerts/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-subscriptions'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useDeleteAlertSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiFetch<undefined>(`/api/v1/alerts/subscriptions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-subscriptions'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useSendMatchToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) =>
      apiFetch<{ data: { matchId: string; status: string } }>(
        `/api/v1/alerts/matches/${matchId}/send-to-client`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-events'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}
