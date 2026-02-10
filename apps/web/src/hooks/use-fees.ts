import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateFeeStructure } from '@realflow/shared';

const supabase = createClient();

export function useFeeStructure(clientId: string) {
  return useQuery({
    queryKey: ['fee-structures', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_structures')
        .select(`
          *,
          invoices:invoices(*),
          referral_fees:referral_fees(*)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feeStructure: CreateFeeStructure) => {
      const { data, error } = await supabase
        .from('fee_structures')
        .insert({
          client_id: feeStructure.clientId,
          transaction_id: feeStructure.transactionId,
          retainer_fee: feeStructure.retainerFee,
          retainer_paid_date: feeStructure.retainerPaidDate,
          success_fee_type: feeStructure.successFeeType,
          success_fee_flat_amount: feeStructure.successFeeFlatAmount,
          success_fee_percentage: feeStructure.successFeePercentage,
          success_fee_tiers: feeStructure.successFeeTiers,
          success_fee_due_date: feeStructure.successFeeDueDate,
          success_fee_paid: feeStructure.successFeePaid,
          gst_included: feeStructure.gstIncluded,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
  });
}

export function useInvoices(feeStructureId: string) {
  return useQuery({
    queryKey: ['invoices', feeStructureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('fee_structure_id', feeStructureId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!feeStructureId,
  });
}
