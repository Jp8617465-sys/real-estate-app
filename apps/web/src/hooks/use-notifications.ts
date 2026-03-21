import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  Notification,
  NotificationPreferences,
  UpdateNotificationPreferences,
} from '@realflow/shared';

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

interface NotificationsResponse {
  data: Notification[];
  hasMore: boolean;
  nextCursor?: string;
}

interface NotificationFilter {
  status?: string;
  category?: string;
  limit?: number;
  before?: string;
}

export function useNotifications(filter?: NotificationFilter) {
  return useQuery({
    queryKey: ['notifications', filter],
    queryFn: async (): Promise<NotificationsResponse> => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (filter?.status) params.set('status', filter.status);
      if (filter?.category) params.set('category', filter.category);
      if (filter?.limit) params.set('limit', String(filter.limit));
      if (filter?.before) params.set('before', filter.before);

      const res = await fetch(`/api/v1/notifications?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json() as Promise<NotificationsResponse>;
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async (): Promise<number> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/notifications/unread-count', { headers });
      if (!res.ok) throw new Error('Failed to fetch unread count');
      const json = (await res.json()) as { count: number };
      return json.count;
    },
    refetchInterval: 30_000,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: async (): Promise<NotificationPreferences> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/notifications/preferences', { headers });
      if (!res.ok) throw new Error('Failed to fetch preferences');
      const json = (await res.json()) as { data: NotificationPreferences };
      return json.data;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/notifications/${id}/dismiss`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error('Failed to dismiss notification');
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<NotificationsResponse>(['notifications']);
      queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
        if (!old) return old;
        return { ...old, data: old.data.filter((n) => n.id !== id) };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useSnoozeNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, snoozeUntil }: { id: string; snoozeUntil: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/notifications/${id}/snooze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ snoozeUntil }),
      });
      if (!res.ok) throw new Error('Failed to snooze notification');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: UpdateNotificationPreferences) => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(preferences),
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}
