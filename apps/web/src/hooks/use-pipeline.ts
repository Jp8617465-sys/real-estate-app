import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PipelineEngine } from '@realflow/business-logic';
import type { PipelineType, Transaction } from '@realflow/shared';

const supabase = createClient();

export function usePipelineTransactions(pipelineType: PipelineType) {
  return useQuery({
    queryKey: ['transactions', pipelineType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone, buyer_profile, lead_score),
          property:properties(id, address_street_number, address_street_name, address_suburb)
        `)
        .eq('pipeline_type', pipelineType)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useTransitionStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      fromStage,
      toStage,
      pipelineType,
      userId,
      reason,
    }: {
      transactionId: string;
      fromStage: string;
      toStage: string;
      pipelineType: PipelineType;
      userId: string;
      reason?: string;
    }) => {
      // Validate transition
      if (!PipelineEngine.isValidTransition(pipelineType, fromStage, toStage)) {
        throw new Error(`Invalid transition from ${fromStage} to ${toStage}`);
      }

      // Update transaction stage
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ current_stage: toStage })
        .eq('id', transactionId);

      if (updateError) throw updateError;

      // Log the transition
      const { error: logError } = await supabase
        .from('stage_transitions')
        .insert({
          transaction_id: transactionId,
          from_stage: fromStage,
          to_stage: toStage,
          triggered_by: userId,
          reason,
        });

      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
