import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Inspection, CreateInspection } from '@realflow/shared';

export function useInspection(id: string) {
  return useQuery({
    queryKey: ['inspections', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Inspection;
    },
    enabled: !!id,
  });
}

export function useInspections(propertyId?: string) {
  return useQuery({
    queryKey: ['inspections', { propertyId }],
    queryFn: async () => {
      let query = supabase
        .from('inspections')
        .select('*')
        .eq('is_deleted', false)
        .order('inspection_date', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Inspection[];
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
      return data as Inspection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });
}
