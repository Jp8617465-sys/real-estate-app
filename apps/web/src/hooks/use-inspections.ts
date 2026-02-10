import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateInspection, UpdateInspection } from '@realflow/shared';

const supabase = createClient();

export function useInspections(filters?: { propertyId?: string; clientId?: string }) {
  return useQuery({
    queryKey: ['inspections', filters],
    queryFn: async () => {
      let query = supabase
        .from('inspections')
        .select(`
          *,
          property:properties(id, address_street_number, address_street_name, address_suburb),
          client:contacts(id, first_name, last_name)
        `)
        .order('inspection_date', { ascending: false });

      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inspection: CreateInspection) => {
      const { data, error } = await supabase
        .from('inspections')
        .insert({
          property_id: inspection.propertyId,
          client_id: inspection.clientId,
          transaction_id: inspection.transactionId,
          selling_agent_id: inspection.sellingAgentId,
          inspection_date: inspection.inspectionDate,
          time_spent_minutes: inspection.timeSpentMinutes,
          overall_impression: inspection.overallImpression,
          condition_notes: inspection.conditionNotes,
          area_feel_notes: inspection.areaFeelNotes,
          client_suitability: inspection.clientSuitability,
          photos: inspection.photos ?? [],
          voice_note_url: inspection.voiceNoteUrl,
          voice_note_transcript: inspection.voiceNoteTranscript,
          agent_notes: inspection.agentNotes,
          created_by: inspection.createdBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });
}

export function useUpdateInspection(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateInspection) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.propertyId) updatePayload.property_id = updates.propertyId;
      if (updates.clientId) updatePayload.client_id = updates.clientId;
      if (updates.transactionId) updatePayload.transaction_id = updates.transactionId;
      if (updates.sellingAgentId) updatePayload.selling_agent_id = updates.sellingAgentId;
      if (updates.inspectionDate) updatePayload.inspection_date = updates.inspectionDate;
      if (updates.timeSpentMinutes !== undefined) updatePayload.time_spent_minutes = updates.timeSpentMinutes;
      if (updates.overallImpression) updatePayload.overall_impression = updates.overallImpression;
      if (updates.conditionNotes !== undefined) updatePayload.condition_notes = updates.conditionNotes;
      if (updates.areaFeelNotes !== undefined) updatePayload.area_feel_notes = updates.areaFeelNotes;
      if (updates.clientSuitability !== undefined) updatePayload.client_suitability = updates.clientSuitability;
      if (updates.photos) updatePayload.photos = updates.photos;
      if (updates.agentNotes !== undefined) updatePayload.agent_notes = updates.agentNotes;

      const { data, error } = await supabase
        .from('inspections')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });
}
