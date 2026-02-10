import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Property, ListingStatus } from '@realflow/shared';

export function useProperties(listingStatus?: ListingStatus) {
  return useQuery({
    queryKey: ['properties', listingStatus],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (listingStatus) {
        query = query.eq('listing_status', listingStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Property;
    },
    enabled: !!id,
  });
}
