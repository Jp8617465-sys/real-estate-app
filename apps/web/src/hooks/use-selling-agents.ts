import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateSellingAgentProfile, UpdateSellingAgentProfile } from '@realflow/shared';

const supabase = createClient();

export function useSellingAgents(suburb?: string) {
  return useQuery({
    queryKey: ['selling-agents', suburb],
    queryFn: async () => {
      let query = supabase
        .from('selling_agent_profiles')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone)
        `)
        .order('relationship_score', { ascending: false });

      if (suburb) {
        query = query.contains('suburbs', [suburb]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useSellingAgent(contactId: string) {
  return useQuery({
    queryKey: ['selling-agents', 'contact', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('selling_agent_profiles')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone)
        `)
        .eq('contact_id', contactId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });
}

export function useCreateSellingAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: CreateSellingAgentProfile) => {
      const { data, error } = await supabase
        .from('selling_agent_profiles')
        .insert({
          contact_id: profile.contactId,
          agency: profile.agency,
          suburbs: profile.suburbs ?? [],
          relationship_score: profile.relationshipScore,
          last_contact_date: profile.lastContactDate,
          average_response_time: profile.averageResponseTime,
          tags: profile.tags ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selling-agents'] });
    },
  });
}

export function useUpdateSellingAgent(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateSellingAgentProfile) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.contactId) updatePayload.contact_id = updates.contactId;
      if (updates.agency !== undefined) updatePayload.agency = updates.agency;
      if (updates.suburbs) updatePayload.suburbs = updates.suburbs;
      if (updates.relationshipScore !== undefined) updatePayload.relationship_score = updates.relationshipScore;
      if (updates.lastContactDate !== undefined) updatePayload.last_contact_date = updates.lastContactDate;
      if (updates.averageResponseTime !== undefined) updatePayload.average_response_time = updates.averageResponseTime;
      if (updates.tags) updatePayload.tags = updates.tags;

      const { data, error } = await supabase
        .from('selling_agent_profiles')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selling-agents'] });
    },
  });
}
