import type { FastifyInstance } from 'fastify';
import {
  CreateSocialPostSchema,
  UpdateSocialPostSchema,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';
import { IntegrationRegistry } from '../services/integration-registry';

/**
 * Social Posts API routes.
 *
 * Provides endpoints for:
 * - CRUD operations on social posts
 * - Publishing posts to Facebook/Instagram via MetaSocialClient
 * - Scheduled post publishing
 */
export async function socialPostRoutes(fastify: FastifyInstance) {
  // ─── List Social Posts ──────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const queryParams = request.query as Record<string, string>;

    let query = supabase
      .from('social_posts')
      .select('*')
      .eq('is_deleted', false)
      .order('scheduled_at', { ascending: true });

    if (queryParams.status) {
      query = query.eq('status', queryParams.status);
    }

    if (queryParams.platform) {
      query = query.eq('platform', queryParams.platform);
    }

    if (queryParams.dateFrom) {
      query = query.gte('scheduled_at', queryParams.dateFrom);
    }

    if (queryParams.dateTo) {
      query = query.lte('scheduled_at', queryParams.dateTo);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Get Single Social Post ─────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) return reply.status(404).send({ error: 'Post not found' });
    return { data };
  });

  // ─── Create Social Post ─────────────────────────────────────────
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateSocialPostSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    // Get current user
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .single();

    if (!userData) return reply.status(401).send({ error: 'User not found' });

    const status = parsed.data.scheduledAt ? 'scheduled' : 'draft';

    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        property_id: parsed.data.propertyId ?? null,
        platform: parsed.data.platform,
        content: parsed.data.content,
        image_url: parsed.data.imageUrl ?? null,
        status,
        scheduled_at: parsed.data.scheduledAt ?? null,
        created_by: userData.id,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // ─── Update Social Post ─────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateSocialPostSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.content !== undefined) updates.content = parsed.data.content;
    if (parsed.data.imageUrl !== undefined) updates.image_url = parsed.data.imageUrl;
    if (parsed.data.scheduledAt !== undefined) updates.scheduled_at = parsed.data.scheduledAt;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('social_posts')
      .update(updates)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Soft Delete Social Post ────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('social_posts')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });

  // ─── Publish a Post Immediately ─────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/publish',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { id } = request.params;

      // Get the post
      const { data: post, error: fetchError } = await supabase
        .from('social_posts')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

      if (fetchError || !post) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Get current user for integration lookup
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .single();

      if (!userData) return reply.status(401).send({ error: 'User not found' });

      const registry = new IntegrationRegistry(request, userData.id);
      const meta = await registry.getMetaClient();

      if (!meta) {
        return reply.status(400).send({ error: 'Meta integration not connected' });
      }

      const postRecord = post as Record<string, unknown>;
      const platform = postRecord.platform as string;
      const content = postRecord.content as string;
      const imageUrl = postRecord.image_url as string | null;

      let externalPostId: string | undefined;

      try {
        if (platform === 'facebook') {
          const result = await meta.postToFacebook({
            message: content,
            photoUrl: imageUrl ?? undefined,
          });
          externalPostId = result.id;
        } else if (platform === 'instagram') {
          if (!imageUrl) {
            return reply.status(400).send({ error: 'Instagram posts require an image' });
          }
          const result = await meta.postToInstagram({
            imageUrl,
            caption: content,
          });
          externalPostId = result.id;
        } else {
          return reply.status(400).send({ error: `Publishing to ${platform} is not yet supported` });
        }

        // Update post status
        const { data: updatedPost, error: updateError } = await supabase
          .from('social_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            external_post_id: externalPostId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (updateError) return reply.status(500).send({ error: updateError.message });
        return { data: updatedPost };
      } catch (err) {
        // Mark as failed
        await supabase
          .from('social_posts')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        const errorMessage = err instanceof Error ? err.message : 'Unknown publishing error';
        return reply.status(500).send({ error: errorMessage });
      }
    },
  );

  // ─── Publish Scheduled Posts (cron endpoint) ────────────────────
  fastify.post('/publish-scheduled', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const now = new Date().toISOString();

    // Find all scheduled posts that are due
    const { data: duePosts, error: fetchError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('status', 'scheduled')
      .eq('is_deleted', false)
      .lte('scheduled_at', now);

    if (fetchError) return reply.status(500).send({ error: fetchError.message });

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const post of duePosts ?? []) {
      const postRecord = post as Record<string, unknown>;
      const postId = postRecord.id as string;
      const createdBy = postRecord.created_by as string;

      const registry = new IntegrationRegistry(request, createdBy);
      const meta = await registry.getMetaClient();

      if (!meta) {
        await supabase
          .from('social_posts')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', postId);
        results.push({ id: postId, status: 'failed', error: 'Meta integration not connected' });
        continue;
      }

      const platform = postRecord.platform as string;
      const content = postRecord.content as string;
      const imageUrl = postRecord.image_url as string | null;

      try {
        let externalPostId: string | undefined;

        if (platform === 'facebook') {
          const result = await meta.postToFacebook({
            message: content,
            photoUrl: imageUrl ?? undefined,
          });
          externalPostId = result.id;
        } else if (platform === 'instagram') {
          if (!imageUrl) {
            throw new Error('Instagram posts require an image');
          }
          const result = await meta.postToInstagram({
            imageUrl,
            caption: content,
          });
          externalPostId = result.id;
        }

        await supabase
          .from('social_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            external_post_id: externalPostId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);

        results.push({ id: postId, status: 'published' });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        await supabase
          .from('social_posts')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', postId);
        results.push({ id: postId, status: 'failed', error: errorMessage });
      }
    }

    return { data: { processed: results.length, results } };
  });
}
