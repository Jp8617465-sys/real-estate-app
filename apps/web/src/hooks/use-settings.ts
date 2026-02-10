import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Profile Hooks ──────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  office_id: string | null;
  is_active: boolean;
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .single();
      if (error) throw error;
      return data as UserProfile;
    },
  });
}

interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateProfileInput) => {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .single();

      if (!userData) throw new Error('User not found');

      const updatePayload: Record<string, unknown> = {};
      if (updates.firstName) updatePayload.first_name = updates.firstName;
      if (updates.lastName) updatePayload.last_name = updates.lastName;
      if (updates.email) updatePayload.email = updates.email;
      if (updates.phone !== undefined) updatePayload.phone = updates.phone;
      updatePayload.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userData.id)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// ─── Integration Hooks ──────────────────────────────────────────────────

interface IntegrationStatus {
  name: string;
  provider: string;
  connected: boolean;
  status: string;
  accountEmail?: string;
  lastSyncAt?: string;
}

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .single();

      if (!userData) throw new Error('User not found');

      // Get integration connections
      const { data: connections } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('user_id', userData.id);

      // Get OAuth tokens
      const { data: tokens } = await supabase
        .from('oauth_tokens')
        .select('provider, account_email, expires_at')
        .eq('user_id', userData.id);

      const providers = [
        { name: 'Domain.com.au', provider: 'domain' },
        { name: 'realestate.com.au', provider: 'rea' },
        { name: 'Instagram', provider: 'instagram' },
        { name: 'Facebook', provider: 'facebook' },
        { name: 'Google Calendar', provider: 'google_calendar' },
      ];

      return providers.map((p): IntegrationStatus => {
        const connection = (connections ?? []).find(
          (c: Record<string, unknown>) => c.provider === p.provider,
        );
        const token = (tokens ?? []).find(
          (t: Record<string, unknown>) => t.provider === p.provider,
        );

        const isActive = connection
          ? (connection as Record<string, unknown>).is_active === true
          : false;
        const hasToken = !!token;

        return {
          name: p.name,
          provider: p.provider,
          connected: isActive || hasToken,
          status: isActive || hasToken ? 'Connected' : 'Not connected',
          accountEmail: token
            ? ((token as Record<string, unknown>).account_email as string | undefined)
            : undefined,
          lastSyncAt: connection
            ? ((connection as Record<string, unknown>).last_sync_at as string | undefined)
            : undefined,
        };
      });
    },
  });
}

export function useConnectIntegration() {
  return useMutation({
    mutationFn: async (provider: string) => {
      // Build OAuth URLs for providers
      const oauthUrls: Record<string, string> = {
        domain: `https://auth.domain.com.au/v1/connect/authorize?client_id=${process.env.NEXT_PUBLIC_DOMAIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_DOMAIN_REDIRECT_URI ?? '')}&response_type=code&scope=api_listings_read`,
        rea: `https://connect.realestate.com.au/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_REA_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_REA_REDIRECT_URI ?? '')}&response_type=code`,
        instagram: `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_META_REDIRECT_URI ?? '')}&scope=instagram_basic,instagram_content_publish`,
        facebook: `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_META_REDIRECT_URI ?? '')}&scope=pages_manage_posts,pages_messaging`,
        google_calendar: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ?? '')}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar')}&access_type=offline&prompt=consent`,
      };

      const url = oauthUrls[provider];
      if (!url) throw new Error(`Unsupported provider: ${provider}`);

      // Open OAuth flow in new window
      window.open(url, '_blank', 'width=600,height=700');
      return { provider };
    },
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: string) => {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .single();

      if (!userData) throw new Error('User not found');

      // Delete OAuth tokens
      await supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', userData.id)
        .eq('provider', provider);

      // Deactivate integration connection
      const { error } = await supabase
        .from('integration_connections')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userData.id)
        .eq('provider', provider);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}
