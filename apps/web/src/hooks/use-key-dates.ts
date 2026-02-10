import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateKeyDate, UpdateKeyDate } from '@realflow/shared';

const supabase = createClient();

export function useKeyDates(transactionId: string) {
  return useQuery({
    queryKey: ['key-dates', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('key_dates')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!transactionId,
  });
}

export function useCreateKeyDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyDate: CreateKeyDate) => {
      const { data, error } = await supabase
        .from('key_dates')
        .insert({
          transaction_id: keyDate.transactionId,
          label: keyDate.label,
          date: keyDate.date,
          is_critical: keyDate.isCritical,
          reminder_days_before: keyDate.reminderDaysBefore,
          status: keyDate.status,
          notes: keyDate.notes,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-dates'] });
    },
  });
}

export function useUpdateKeyDate(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateKeyDate) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.label !== undefined) updatePayload.label = updates.label;
      if (updates.date !== undefined) updatePayload.date = updates.date;
      if (updates.isCritical !== undefined) updatePayload.is_critical = updates.isCritical;
      if (updates.reminderDaysBefore !== undefined) updatePayload.reminder_days_before = updates.reminderDaysBefore;
      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.completedAt !== undefined) updatePayload.completed_at = updates.completedAt;
      if (updates.notes !== undefined) updatePayload.notes = updates.notes;

      const { data, error } = await supabase
        .from('key_dates')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-dates'] });
    },
  });
}
