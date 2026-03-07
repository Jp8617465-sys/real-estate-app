import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  CreateSocialPost,
  UpdateSocialPost,
  SocialPlatform,
  SocialPostFilters,
  AutoGeneratePost,
} from '@realflow/shared';

const supabase = createClient();

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Helper ────────────────────────────────────────────────────────────

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1/social-posts${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((errorData as Record<string, string>).error ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

// ─── List Social Posts ──────────────────────────────────────────────────

export function useSocialPosts(filters?: SocialPostFilters) {
  return useQuery({
    queryKey: ['social-posts', filters],
    queryFn: async () => {
      let query = supabase
        .from('social_posts')
        .select('*')
        .eq('is_deleted', false)
        .order('scheduled_at', { ascending: true });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.platform) {
        query = query.contains('platforms', [filters.platform]);
      }

      if (filters?.dateFrom) {
        query = query.gte('scheduled_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('scheduled_at', filters.dateTo);
      }

      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Array<Record<string, unknown>>;
    },
  });
}

// ─── Create Social Post ─────────────────────────────────────────────────

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: CreateSocialPost) => {
      return apiRequest<{ data: Record<string, unknown> }>('', {
        method: 'POST',
        body: JSON.stringify(post),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ─── Update Social Post ─────────────────────────────────────────────────

export function useUpdatePost(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateSocialPost) => {
      return apiRequest<{ data: Record<string, unknown> }>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ─── Publish Social Post ────────────────────────────────────────────────

export function usePublishPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest<{ data: Record<string, unknown> }>(`/${id}/publish`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ─── Delete Social Post ─────────────────────────────────────────────────

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest<{ success: boolean }>(`/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ─── Social Accounts ────────────────────────────────────────────────────

export function useSocialAccounts() {
  return useQuery({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return data as Array<Record<string, unknown>>;
    },
  });
}

// ─── Connect Social Account ────────────────────────────────────────────

export function useConnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { platform: SocialPlatform; authCode: string; redirectUri: string }) => {
      return apiRequest<{ data: Record<string, unknown> }>('/accounts/connect', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    },
  });
}

// ─── Social Analytics ───────────────────────────────────────────────────

export function useSocialAnalytics(postId?: string) {
  return useQuery({
    queryKey: ['social-analytics', postId],
    queryFn: async () => {
      if (postId) {
        // Get analytics for a specific post
        return apiRequest<{ data: Record<string, unknown> }>(`/${postId}/analytics`);
      }

      // Get aggregate analytics across all published posts
      const { data, error } = await supabase
        .from('social_posts')
        .select('id, platforms, analytics, platform_results, published_at, content, media_urls, status')
        .eq('status', 'published')
        .eq('is_deleted', false)
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return { data: data as Array<Record<string, unknown>> };
    },
    enabled: postId !== '',
  });
}

// ─── Auto-Generate Post from Property ───────────────────────────────────

export function useAutoGeneratePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AutoGeneratePost) => {
      return apiRequest<{ data: Record<string, unknown> }>(
        `/from-property/${params.propertyId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            platforms: params.platforms,
            tone: params.tone,
          }),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}
