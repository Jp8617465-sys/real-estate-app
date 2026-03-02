import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Notification } from '@realflow/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

async function getToken(): Promise<string> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? '';
}

export function useNotifications(userId?: string, filter?: { category?: string; status?: string }) {
  return useQuery({
    queryKey: ['notifications', userId, filter],
    queryFn: async () => {
      if (!userId) return [];
      const params = new URLSearchParams({ user_id: userId });
      if (filter?.category) params.set('category', filter.category);
      if (filter?.status) params.set('status', filter.status);

      const res = await fetch(`${API_BASE}/api/v1/notifications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const json = await res.json() as { data: Notification[] };
      return json.data;
    },
    enabled: !!userId,
    refetchInterval: 30_000, // Poll every 30s
  });
}

export function useUnreadCount(userId?: string) {
  return useQuery({
    queryKey: ['notifications-unread-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const res = await fetch(
        `${API_BASE}/api/v1/notifications/unread-count?user_id=${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${await getToken()}` } },
      );
      if (!res.ok) return 0;
      const json = await res.json() as { count: number };
      return json.count;
    },
    enabled: !!userId,
    refetchInterval: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/v1/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to mark read');
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/v1/notifications/${id}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to dismiss');
    },
    onMutate: async (id) => {
      // Optimistic remove
      queryClient.setQueriesData<Notification[]>({ queryKey: ['notifications'] }, (old) =>
        old?.filter((n) => n.id !== id) ?? [],
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useSnoozeNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, minutes = 60 }: { id: string; minutes?: number }) => {
      const res = await fetch(`${API_BASE}/api/v1/notifications/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ minutes }),
      });
      if (!res.ok) throw new Error('Failed to snooze');
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
