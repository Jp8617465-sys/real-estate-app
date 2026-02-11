import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Transaction, PipelineType } from '@realflow/shared';

export function usePipeline(pipelineType: PipelineType) {
  return useQuery({
    queryKey: ['pipeline', pipelineType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, contact:contacts(id, first_name, last_name, buyer_profile)')
        .eq('pipeline_type', pipelineType)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as (Transaction & {
        contact: {
          id: string;
          first_name: string;
          last_name: string;
          buyer_profile: Record<string, unknown> | null;
        };
      })[];
    },
  });
}

export function useUpdateTransactionStage(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stage }: { stage: string }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update({ current_stage: stage })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}
