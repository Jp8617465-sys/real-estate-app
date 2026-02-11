import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Contact, CreateContact, UpdateContact, ContactSearch } from '@realflow/shared';

export function useContacts(search?: ContactSearch) {
  return useQuery({
    queryKey: ['contacts', search],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (search?.types?.length) {
        query = query.overlaps('types', search.types);
      }
      if (search?.assignedAgentId) {
        query = query.eq('assigned_agent_id', search.assignedAgentId);
      }
      if (search?.sources?.length) {
        query = query.in('source', search.sources);
      }
      if (search?.tags?.length) {
        query = query.overlaps('tags', search.tags);
      }
      if (search?.query) {
        query = query.or(
          `first_name.ilike.%${search.query}%,last_name.ilike.%${search.query}%,email.ilike.%${search.query}%,phone.ilike.%${search.query}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contact[];
    },
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Contact;
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contact: CreateContact) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          types: contact.types,
          first_name: contact.firstName,
          last_name: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          secondary_phone: contact.secondaryPhone,
          source: contact.source,
          source_detail: contact.sourceDetail,
          assigned_agent_id: contact.assignedAgentId,
          buyer_profile: contact.buyerProfile,
          seller_profile: contact.sellerProfile,
          tags: contact.tags ?? [],
          communication_preference: contact.communicationPreference,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateContact) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.types) updatePayload.types = updates.types;
      if (updates.firstName) updatePayload.first_name = updates.firstName;
      if (updates.lastName) updatePayload.last_name = updates.lastName;
      if (updates.email !== undefined) updatePayload.email = updates.email;
      if (updates.phone) updatePayload.phone = updates.phone;
      if (updates.source) updatePayload.source = updates.source;
      if (updates.assignedAgentId) updatePayload.assigned_agent_id = updates.assignedAgentId;
      if (updates.buyerProfile) updatePayload.buyer_profile = updates.buyerProfile;
      if (updates.sellerProfile) updatePayload.seller_profile = updates.sellerProfile;
      if (updates.tags) updatePayload.tags = updates.tags;
      if (updates.communicationPreference) updatePayload.communication_preference = updates.communicationPreference;
      if (updates.nextFollowUp !== undefined) updatePayload.next_follow_up = updates.nextFollowUp;

      const { data, error } = await supabase
        .from('contacts')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts', id] });
    },
  });
}

export function useDeleteContact(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Soft delete
      const { error } = await supabase
        .from('contacts')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
