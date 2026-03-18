'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  const json = await res.json();
  return json.data as T;
}

export function useCalendarConnections() {
  return useQuery({
    queryKey: ['calendar-connections'],
    queryFn: () => apiFetch<unknown[]>('/api/v1/calendar/connections'),
    staleTime: 60_000,
  });
}

export function useCalendarEvents(params: { startDate?: string; endDate?: string; eventType?: string }) {
  const searchParams = new URLSearchParams();
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  if (params.eventType) searchParams.set('eventType', params.eventType);

  return useQuery({
    queryKey: ['calendar-events', params],
    queryFn: () => apiFetch<unknown[]>(`/api/v1/calendar/events?${searchParams}`),
    staleTime: 30_000,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) =>
      apiFetch('/api/v1/calendar/events', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...params }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/api/v1/calendar/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/calendar/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useCalendarConflicts(startTime: string, endTime: string) {
  return useQuery({
    queryKey: ['calendar-conflicts', startTime, endTime],
    queryFn: () => apiFetch<unknown[]>(`/api/v1/calendar/conflicts?startTime=${startTime}&endTime=${endTime}`),
    enabled: !!startTime && !!endTime,
  });
}
