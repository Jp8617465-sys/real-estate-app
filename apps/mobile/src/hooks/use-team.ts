import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  TeamMember,
  TeamPerformance,
  LeadAssignmentRule,
  CreateLeadAssignmentRule,
  UpdateLeadAssignmentRule,
} from '@realflow/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

async function getToken(): Promise<string> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? '';
}

// ─── useTeamMembers ──────────────────────────────────────────────────────────

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/team/members`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch team members');
      const json = (await res.json()) as { data: TeamMember[] };
      return json.data;
    },
    staleTime: 30_000,
  });
}

// ─── useTeamPerformance ──────────────────────────────────────────────────────

export function useTeamPerformance(from?: string, to?: string) {
  return useQuery({
    queryKey: ['team-performance', from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/api/v1/team/performance${qs}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch team performance');
      const json = (await res.json()) as { data: TeamPerformance[] };
      return json.data;
    },
    staleTime: 30_000,
  });
}

// ─── useAssignmentRules ──────────────────────────────────────────────────────

export function useAssignmentRules() {
  return useQuery({
    queryKey: ['team-assignment-rules'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/team/assignment-rules`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch assignment rules');
      const json = (await res.json()) as { data: LeadAssignmentRule[] };
      return json.data;
    },
    staleTime: 30_000,
  });
}

// ─── useCreateAssignmentRule ─────────────────────────────────────────────────

export function useCreateAssignmentRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: CreateLeadAssignmentRule) => {
      const res = await fetch(`${API_BASE}/api/v1/team/assignment-rules`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error('Failed to create assignment rule');
      const json = (await res.json()) as { data: LeadAssignmentRule };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-assignment-rules'] });
    },
    onError: (error: Error) => {
      console.error('Create assignment rule failed:', error);
    },
  });
}

// ─── useUpdateAssignmentRule ─────────────────────────────────────────────────

export function useUpdateAssignmentRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateLeadAssignmentRule }) => {
      const res = await fetch(`${API_BASE}/api/v1/team/assignment-rules/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update assignment rule');
      const json = (await res.json()) as { data: LeadAssignmentRule };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-assignment-rules'] });
    },
    onError: (error: Error) => {
      console.error('Update assignment rule failed:', error);
    },
  });
}

// ─── useDeleteAssignmentRule ─────────────────────────────────────────────────

export function useDeleteAssignmentRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/v1/team/assignment-rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to delete assignment rule');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-assignment-rules'] });
    },
    onError: (error: Error) => {
      console.error('Delete assignment rule failed:', error);
    },
  });
}
