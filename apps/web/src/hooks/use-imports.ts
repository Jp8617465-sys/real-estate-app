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

export function useImportJobs() {
  return useQuery({
    queryKey: ['import-jobs'],
    queryFn: () => apiFetch<unknown[]>('/api/v1/imports'),
    staleTime: 10_000,
  });
}

export function useImportJob(id: string) {
  return useQuery({
    queryKey: ['import-job', id],
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/v1/imports/${id}`),
    enabled: !!id,
    refetchInterval: 5_000, // Poll during processing
  });
}

export function useCreateImportJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { source: string; entityType: string; fileName: string; fileSize: number }) =>
      apiFetch<Record<string, unknown>>('/api/v1/imports', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-jobs'] }),
  });
}

export function useImportPreview() {
  return useMutation({
    mutationFn: ({ id, rows }: { id: string; rows: Array<Record<string, string>> }) =>
      apiFetch<Record<string, unknown>>(`/api/v1/imports/${id}/preview`, {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
  });
}

export function useSetFieldMappings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...params }: { id: string; fieldMappings: unknown[]; skipDuplicates: boolean }) =>
      apiFetch(`/api/v1/imports/${id}/mappings`, {
        method: 'PUT',
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-jobs'] }),
  });
}

export function useExecuteImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rows }: { id: string; rows: Array<Record<string, string>> }) =>
      apiFetch(`/api/v1/imports/${id}/execute`, {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-jobs'] }),
  });
}

export function useOnboardingProgress() {
  return useQuery({
    queryKey: ['onboarding'],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/v1/imports/onboarding'),
    staleTime: 30_000,
  });
}

export function useUpdateOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) =>
      apiFetch('/api/v1/imports/onboarding', {
        method: 'PUT',
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
  });
}
