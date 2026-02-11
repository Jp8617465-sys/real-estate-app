import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PropertyMatch, PropertyMatchStatus } from '@realflow/shared';

export function usePropertyMatches(briefId?: string) {
  return useQuery({
    queryKey: ['property-matches', { briefId }],
    queryFn: async () => {
      let query = supabase
        .from('property_matches')
        .select('*, property:properties(id, address, bedrooms, bathrooms, car_spaces, list_price, price_guide, listing_status)')
        .eq('is_deleted', false)
        .order('overall_score', { ascending: false });

      if (briefId) {
        query = query.eq('client_brief_id', briefId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (PropertyMatch & {
        property: {
          id: string;
          address: Record<string, string>;
          bedrooms: number;
          bathrooms: number;
          car_spaces: number;
          list_price: number | null;
          price_guide: string | null;
          listing_status: string;
        };
      })[];
    },
  });
}

export function usePropertyMatch(id: string) {
  return useQuery({
    queryKey: ['property-matches', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_matches')
        .select('*, property:properties(*), client_brief:client_briefs(*, contact:contacts(id, first_name, last_name))')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as PropertyMatch & {
        property: Record<string, unknown>;
        client_brief: Record<string, unknown> & {
          contact: { id: string; first_name: string; last_name: string };
        };
      };
    },
    enabled: !!id,
  });
}

export function useUpdatePropertyMatchStatus(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      status,
      rejectionReason,
      agentNotes,
    }: {
      status: PropertyMatchStatus;
      rejectionReason?: string;
      agentNotes?: string;
    }) => {
      const updatePayload: Record<string, unknown> = { status };
      if (rejectionReason !== undefined) updatePayload.rejection_reason = rejectionReason;
      if (agentNotes !== undefined) updatePayload.agent_notes = agentNotes;

      const { data, error } = await supabase
        .from('property_matches')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as PropertyMatch;
    },
    onMutate: async ({ status }) => {
      await queryClient.cancelQueries({ queryKey: ['property-matches'] });
      const previousMatches = queryClient.getQueryData(['property-matches']);

      queryClient.setQueriesData<PropertyMatch[]>(
        { queryKey: ['property-matches'] },
        (old) =>
          old?.map((match) =>
            match.id === id ? { ...match, status } : match,
          ),
      );

      return { previousMatches };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMatches) {
        queryClient.setQueriesData({ queryKey: ['property-matches'] }, context.previousMatches);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['property-matches'] });
    },
  });
}
