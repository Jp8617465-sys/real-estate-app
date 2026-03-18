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

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: () => apiFetch<unknown[]>('/api/v1/reports'),
    staleTime: 30_000,
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/v1/reports/${id}`),
    enabled: !!id,
  });
}

export function useReportTemplates() {
  return useQuery({
    queryKey: ['report-templates'],
    queryFn: () => apiFetch<unknown[]>('/api/v1/reports/templates/list'),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) =>
      apiFetch('/api/v1/reports', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useExecuteReport() {
  return useMutation({
    mutationFn: (reportId: string) =>
      apiFetch<Record<string, unknown>>(`/api/v1/reports/${reportId}/execute`, {
        method: 'POST',
      }),
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) =>
      apiFetch(`/api/v1/reports/${reportId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useDashboardWidgets() {
  return useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: () => apiFetch<unknown[]>('/api/v1/reports/dashboard/widgets'),
    staleTime: 30_000,
  });
}
