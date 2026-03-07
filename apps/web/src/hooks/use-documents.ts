'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export function useContactDocuments(contactId: string) {
  return useQuery({
    queryKey: ['documents', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('contact_id', contactId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });
}

export function useTogglePortalVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, portalVisible }: { id: string; portalVisible: boolean }) => {
      const { data, error } = await supabase
        .from('documents')
        .update({ portal_visible: portalVisible, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('is_deleted', false)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useSendPortalInvite() {
  return useMutation({
    mutationFn: async ({ contactId, email }: { contactId: string; email: string }) => {
      const response = await fetch('/api/v1/portal/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, email }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Failed to send portal invite');
      }

      return response.json() as Promise<{ success: boolean; portalClientId: string }>;
    },
  });
}
