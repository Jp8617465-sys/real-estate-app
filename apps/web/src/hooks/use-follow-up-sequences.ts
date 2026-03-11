import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { FollowUpSequence, SequenceEnrollment } from '@realflow/shared';

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

interface SequenceFilter {
  category?: string;
}

export function useFollowUpSequences(filter?: SequenceFilter) {
  return useQuery({
    queryKey: ['follow-up-sequences', filter],
    queryFn: async (): Promise<FollowUpSequence[]> => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (filter?.category) params.set('category', filter.category);

      const res = await fetch(`/api/v1/follow-up-sequences?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch sequences');
      const json = (await res.json()) as { data: FollowUpSequence[] };
      return json.data;
    },
  });
}

export function useSequenceTemplates() {
  return useQuery({
    queryKey: ['follow-up-sequences', 'templates'],
    queryFn: async (): Promise<FollowUpSequence[]> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/follow-up-sequences/templates', { headers });
      if (!res.ok) throw new Error('Failed to fetch sequence templates');
      const json = (await res.json()) as { data: FollowUpSequence[] };
      return json.data;
    },
  });
}

export function useSequenceEnrollments(sequenceId: string, filter?: { status?: string }) {
  return useQuery({
    queryKey: ['follow-up-sequences', sequenceId, 'enrollments', filter],
    queryFn: async (): Promise<SequenceEnrollment[]> => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (filter?.status) params.set('status', filter.status);

      const res = await fetch(`/api/v1/follow-up-sequences/${sequenceId}/enrollments?${params}`, {
        headers,
      });
      if (!res.ok) throw new Error('Failed to fetch enrollments');
      const json = (await res.json()) as { data: SequenceEnrollment[] };
      return json.data;
    },
    enabled: !!sequenceId,
  });
}

export function useEnrollContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sequenceId,
      contactId,
      transactionId,
      enrolledBy,
    }: {
      sequenceId: string;
      contactId: string;
      transactionId?: string;
      enrolledBy?: string;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/follow-up-sequences/${sequenceId}/enroll`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ contactId, transactionId, enrolledBy }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error ?? 'Enrollment failed');
      }
      return res.json();
    },
    onSuccess: (_data, { sequenceId }) => {
      queryClient.invalidateQueries({
        queryKey: ['follow-up-sequences', sequenceId, 'enrollments'],
      });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function usePauseEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/follow-up-sequences/enrollments/${enrollmentId}/pause`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error('Failed to pause enrollment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useResumeEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/follow-up-sequences/enrollments/${enrollmentId}/resume`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error('Failed to resume enrollment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useCancelEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/follow-up-sequences/enrollments/${enrollmentId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Failed to cancel enrollment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}
