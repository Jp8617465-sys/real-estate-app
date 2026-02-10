import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateClientBrief, UpdateClientBrief } from '@realflow/shared';

const supabase = createClient();

export function useClientBriefs(contactId?: string) {
  return useQuery({
    queryKey: ['client-briefs', contactId],
    queryFn: async () => {
      let query = supabase
        .from('client_briefs')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone)
        `)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useClientBrief(id: string) {
  return useQuery({
    queryKey: ['client-briefs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_briefs')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateClientBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (brief: CreateClientBrief) => {
      const { data, error } = await supabase
        .from('client_briefs')
        .insert({
          contact_id: brief.contactId,
          transaction_id: brief.transactionId,
          purchase_type: brief.purchaseType,
          enquiry_type: brief.enquiryType,
          budget: brief.budget,
          finance: brief.finance,
          requirements: brief.requirements,
          timeline: brief.timeline,
          communication: brief.communication,
          solicitor: brief.solicitor,
          client_signed_off: brief.clientSignedOff,
          created_by: brief.createdBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-briefs'] });
    },
  });
}

export function useUpdateClientBrief(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateClientBrief) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.contactId) updatePayload.contact_id = updates.contactId;
      if (updates.transactionId) updatePayload.transaction_id = updates.transactionId;
      if (updates.purchaseType) updatePayload.purchase_type = updates.purchaseType;
      if (updates.enquiryType) updatePayload.enquiry_type = updates.enquiryType;
      if (updates.budget) updatePayload.budget = updates.budget;
      if (updates.finance) updatePayload.finance = updates.finance;
      if (updates.requirements) updatePayload.requirements = updates.requirements;
      if (updates.timeline) updatePayload.timeline = updates.timeline;
      if (updates.communication) updatePayload.communication = updates.communication;
      if (updates.solicitor !== undefined) updatePayload.solicitor = updates.solicitor;
      if (updates.clientSignedOff !== undefined) updatePayload.client_signed_off = updates.clientSignedOff;

      const { data, error } = await supabase
        .from('client_briefs')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-briefs'] });
      queryClient.invalidateQueries({ queryKey: ['client-briefs', id] });
    },
  });
}

export function useSignOffBrief(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('client_briefs')
        .update({
          client_signed_off: true,
          signed_off_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-briefs'] });
      queryClient.invalidateQueries({ queryKey: ['client-briefs', id] });
    },
  });
}
