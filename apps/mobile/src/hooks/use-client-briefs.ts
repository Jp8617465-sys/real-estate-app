import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ClientBrief } from '@realflow/shared';

export function useClientBrief(clientId: string) {
  return useQuery({
    queryKey: ['client-briefs', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_briefs')
        .select('*')
        .eq('contact_id', clientId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data as ClientBrief;
    },
    enabled: !!clientId,
  });
}

export function useClientBriefs() {
  return useQuery({
    queryKey: ['client-briefs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_briefs')
        .select('*, contact:contacts(id, first_name, last_name)')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as (ClientBrief & {
        contact: { id: string; first_name: string; last_name: string };
      })[];
    },
  });
}
