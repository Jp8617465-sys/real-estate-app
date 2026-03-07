import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { SocialDmLead, SocialLeadStats } from '@realflow/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

async function getToken(): Promise<string> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? '';
}

// ─── useSocialLeads ──────────────────────────────────────────────────────────

export function useSocialLeads(status?: string) {
  return useQuery({
    queryKey: ['social-leads', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(
        `${API_BASE}/api/v1/social/leads${params}`,
        { headers: { Authorization: `Bearer ${await getToken()}` } },
      );
      if (!res.ok) throw new Error('Failed to fetch social leads');
      const json = await res.json() as { data: SocialDmLead[] };
      return json.data;
    },
    staleTime: 30_000,
  });
}

// ─── useSocialLeadStats ───────────────────────────────────────────────────────

export function useSocialLeadStats() {
  return useQuery({
    queryKey: ['social-lead-stats'],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/v1/social/leads/stats`,
        { headers: { Authorization: `Bearer ${await getToken()}` } },
      );
      if (!res.ok) throw new Error('Failed to fetch social lead stats');
      const json = await res.json() as { data: SocialLeadStats };
      return json.data;
    },
    staleTime: 60_000,
  });
}

// ─── useConvertSocialLead ────────────────────────────────────────────────────

export function useConvertSocialLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, overrides }: { leadId: string; overrides?: Record<string, unknown> }) => {
      const res = await fetch(
        `${API_BASE}/api/v1/social/leads/${leadId}/convert`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${await getToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(overrides ?? {}),
        },
      );
      if (!res.ok) throw new Error('Failed to convert social lead');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-leads'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// ─── useDismissSocialLead ────────────────────────────────────────────────────

export function useDismissSocialLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(
        `${API_BASE}/api/v1/social/leads/${leadId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${await getToken()}` },
        },
      );
      if (!res.ok) throw new Error('Failed to dismiss social lead');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-leads'] });
    },
  });
}
