'use client';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { SubscriptionResponse } from '@realflow/shared';
import { apiFetch } from '@/lib/api-client';

export function useSubscriptionStatus() {
  return useQuery<SubscriptionResponse>({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const { data } = await apiFetch<{ data: SubscriptionResponse }>(
        '/api/v1/subscriptions/status',
      );
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiFetch<{ data: { url: string } }>(
        '/api/v1/subscriptions/checkout',
        { method: 'POST' },
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      console.error('Checkout creation failed:', error.message);
    },
  });
}

export function useCreatePortal() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiFetch<{ data: { url: string } }>(
        '/api/v1/subscriptions/portal',
        { method: 'POST' },
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      console.error('Portal session creation failed:', error.message);
    },
  });
}
