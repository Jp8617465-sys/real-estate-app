'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';
import { fromDbSchema } from '@realflow/business-logic';

const supabase = createClient();

export function useBrief() {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();

  return useQuery({
    queryKey: ['portal-brief', portalClient?.contact_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_briefs')
        .select('*')
        .eq('contact_id', portalClient!.contact_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return fromDbSchema(data);
    },
    enabled: !!user?.id && !!portalClient?.contact_id,
  });
}
