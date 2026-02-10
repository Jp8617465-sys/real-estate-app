import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { UpdateDueDiligenceItem, CreateDueDiligenceChecklist } from '@realflow/shared';

const supabase = createClient();

export function useDueDiligenceChecklist(transactionId: string) {
  return useQuery({
    queryKey: ['due-diligence', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('due_diligence_checklists')
        .select(`
          *,
          items:due_diligence_items(*)
        `)
        .eq('transaction_id', transactionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!transactionId,
  });
}

export function useUpdateDDItem(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateDueDiligenceItem) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.status) updatePayload.status = updates.status;
      if (updates.assignedTo) updatePayload.assigned_to = updates.assignedTo;
      if (updates.dueDate !== undefined) updatePayload.due_date = updates.dueDate;
      if (updates.completedDate !== undefined) updatePayload.completed_date = updates.completedDate;
      if (updates.documents) updatePayload.documents = updates.documents;
      if (updates.notes !== undefined) updatePayload.notes = updates.notes;
      if (updates.isBlocking !== undefined) updatePayload.is_blocking = updates.isBlocking;
      if (updates.isCritical !== undefined) updatePayload.is_critical = updates.isCritical;

      const { data, error } = await supabase
        .from('due_diligence_items')
        .update(updatePayload)
        .eq('id', itemId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['due-diligence'] });
    },
  });
}

export function useGenerateChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checklist: CreateDueDiligenceChecklist) => {
      const { data, error } = await supabase
        .from('due_diligence_checklists')
        .insert({
          transaction_id: checklist.transactionId,
          state: checklist.state,
          property_type: checklist.propertyType,
          status: checklist.status,
          created_by: checklist.createdBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['due-diligence'] });
    },
  });
}
