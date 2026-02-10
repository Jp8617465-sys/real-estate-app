'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';

const supabase = createClient();

export interface PortalProperty {
  id: string;
  overall_score: number;
  status: string;
  agent_notes: string | null;
  property: {
    id: string;
    address: {
      street: string;
      suburb: string;
      state: string;
      postcode: string;
    };
    property_type: string;
    bedrooms: number;
    bathrooms: number;
    car_spaces: number;
    price_guide: string | null;
  };
}

export function usePortalProperties() {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();

  return useQuery({
    queryKey: ['portal-properties', portalClient?.contact_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_matches')
        .select(
          `
          id,
          overall_score,
          status,
          agent_notes,
          property:properties!property_id (
            id,
            address,
            property_type,
            bedrooms,
            bathrooms,
            car_spaces,
            price_guide
          )
        `,
        )
        .eq('client_id', portalClient!.contact_id)
        .order('overall_score', { ascending: false });

      if (error) throw error;
      return data as unknown as PortalProperty[];
    },
    enabled: !!user?.id && !!portalClient?.contact_id,
  });
}
