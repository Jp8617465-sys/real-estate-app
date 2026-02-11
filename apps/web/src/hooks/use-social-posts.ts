import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateSocialPost, UpdateSocialPost, SocialPost } from '@realflow/shared';

const supabase = createClient();

interface DateRange {
  from: string;
  to: string;
}

// ─── List Social Posts ──────────────────────────────────────────────────

export function useSocialPosts(dateRange?: DateRange, platform?: string) {
  return useQuery({
    queryKey: ['social-posts', dateRange, platform],
    queryFn: async () => {
      let query = supabase
        .from('social_posts')
        .select('*')
        .eq('is_deleted', false)
        .order('scheduled_at', { ascending: true });

      if (dateRange?.from) {
        query = query.gte('scheduled_at', dateRange.from);
      }

      if (dateRange?.to) {
        query = query.lte('scheduled_at', dateRange.to);
      }

      if (platform && platform !== 'all') {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Array<Record<string, unknown>>;
    },
  });
}

// ─── Create Social Post ─────────────────────────────────────────────────

export function useCreateSocialPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: CreateSocialPost) => {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .single();

      if (!userData) throw new Error('User not found');

      const status = post.scheduledAt ? 'scheduled' : 'draft';

      const { data, error } = await supabase
        .from('social_posts')
        .insert({
          property_id: post.propertyId ?? null,
          platform: post.platform,
          content: post.content,
          image_url: post.imageUrl ?? null,
          status,
          scheduled_at: post.scheduledAt ?? null,
          created_by: userData.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ─── Update Social Post ─────────────────────────────────────────────────

export function useUpdateSocialPost(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateSocialPost) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.content !== undefined) updatePayload.content = updates.content;
      if (updates.imageUrl !== undefined) updatePayload.image_url = updates.imageUrl;
      if (updates.scheduledAt !== undefined) updatePayload.scheduled_at = updates.scheduledAt;
      if (updates.status !== undefined) updatePayload.status = updates.status;
      updatePayload.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('social_posts')
        .update(updatePayload)
        .eq('id', id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ─── Publish Social Post ────────────────────────────────────────────────

export function usePublishSocialPost(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Call the API publish endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1/social-posts/${id}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error((errorData as Record<string, string>).error ?? 'Publish failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ─── Delete Social Post ─────────────────────────────────────────────────

export function useDeleteSocialPost(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('social_posts')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}
