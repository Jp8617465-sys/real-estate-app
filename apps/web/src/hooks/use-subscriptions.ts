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

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => apiFetch<unknown[]>('/api/v1/subscriptions/plans'),
    staleTime: 60 * 60 * 1000, // Plans rarely change
  });
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ['current-subscription'],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/v1/subscriptions/current'),
    staleTime: 60_000,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (params: { planId: string; billingInterval: string; seatCount: number }) =>
      apiFetch<{ checkoutUrl: string }>('/api/v1/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          successUrl: `${window.location.origin}/settings/billing?success=true`,
          cancelUrl: `${window.location.origin}/settings/billing?canceled=true`,
        }),
      }),
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { cancelAtPeriodEnd?: boolean; seatCount?: number }) =>
      apiFetch('/api/v1/subscriptions/current', {
        method: 'PUT',
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['current-subscription'] }),
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ portalUrl: string }>('/api/v1/subscriptions/billing-portal', {
        method: 'POST',
        body: JSON.stringify({ returnUrl: window.location.href }),
      }),
  });
}

export function usePaymentHistory() {
  return useQuery({
    queryKey: ['payment-history'],
    queryFn: () => apiFetch<unknown[]>('/api/v1/subscriptions/payments'),
    staleTime: 60_000,
  });
}
