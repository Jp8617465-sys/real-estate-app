'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useCallback } from 'react';
import type { User } from '@supabase/supabase-js';

const supabase = createClient();

interface AuthState {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 5 * 60 * 1000,
  });

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    window.location.href = '/auth';
  }, [queryClient]);

  return {
    user: user ?? null,
    isLoading,
    signOut,
  };
}

interface PortalClientData {
  id: string;
  auth_id: string;
  contact_id: string;
  agent_id: string;
  is_active: boolean;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string;
  };
  agent: {
    id: string;
    full_name: string;
    email: string | null;
  };
}

export function usePortalClient() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['portal-client', user?.id],
    queryFn: async (): Promise<PortalClientData> => {
      const { data, error } = await supabase
        .from('portal_clients')
        .select(
          `
          id,
          auth_id,
          contact_id,
          agent_id,
          is_active,
          contact:contacts!contact_id (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          agent:users!agent_id (
            id,
            full_name,
            email
          )
        `,
        )
        .eq('auth_id', user!.id)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as unknown as PortalClientData;
    },
    enabled: !!user?.id,
  });
}
