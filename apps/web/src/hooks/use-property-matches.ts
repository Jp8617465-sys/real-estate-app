import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { UpdatePropertyMatch } from '@realflow/shared';

const supabase = createClient();

export function usePropertyMatches(clientBriefId?: string) {
  return useQuery({
    queryKey: ['property-matches', clientBriefId],
    queryFn: async () => {
      let query = supabase
        .from('property_matches')
        .select(`
          *,
          property:properties(id, address_street_number, address_street_name, address_suburb, address_state, address_postcode, price_display, bedrooms, bathrooms, car_spaces),
          client_brief:client_briefs(id, contact_id),
          client:contacts(id, first_name, last_name)
        `)
        .order('overall_score', { ascending: false });

      if (clientBriefId) {
        query = query.eq('client_brief_id', clientBriefId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateMatchStatus(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdatePropertyMatch) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.status) updatePayload.status = updates.status;
      if (updates.rejectionReason !== undefined) updatePayload.rejection_reason = updates.rejectionReason;
      if (updates.agentNotes !== undefined) updatePayload.agent_notes = updates.agentNotes;

      const { data, error } = await supabase
        .from('property_matches')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-matches'] });
    },
  });
}
