import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PropertyAlertEvent, PropertyAlertSubscription } from '@realflow/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

async function getToken(): Promise<string> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? '';
}

// ─── useAlertEvents ────────────────────────────────────────────────────────────

/**
 * Fetch recent property alert events for the authenticated agent.
 * Events are ordered newest-first by the API.
 */
export function useAlertEvents(limit = 20) {
  return useQuery({
    queryKey: ['alert-events', limit],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/alerts/events?limit=${limit}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch alert events');
      const json = (await res.json()) as { data: PropertyAlertEvent[] };
      return json.data;
    },
    staleTime: 60_000,
  });
}

// ─── useAlertSubscriptions ────────────────────────────────────────────────────

/**
 * Fetch all active alert subscriptions for the authenticated agent.
 */
export function useAlertSubscriptions() {
  return useQuery({
    queryKey: ['alert-subscriptions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/alerts/subscriptions`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch alert subscriptions');
      const json = (await res.json()) as { data: PropertyAlertSubscription[] };
      return json.data;
    },
    staleTime: 60_000,
  });
}

// ─── useSendMatchToClient ─────────────────────────────────────────────────────

/**
 * Mark a property match as sent to the portal client.
 * Invalidates the alert-events cache on success so the action state updates.
 */
export function useSendMatchToClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const res = await fetch(`${API_BASE}/api/v1/alerts/matches/${matchId}/send-to-client`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to send match to client');
      return res.json() as Promise<{ data: { matchId: string; status: string } }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-events'] });
    },
  });
}
