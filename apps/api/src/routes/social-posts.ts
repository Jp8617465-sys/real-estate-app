import type { FastifyInstance } from 'fastify';
import {
  CreateSocialPostSchema,
  UpdateSocialPostSchema,
  ConnectSocialAccountSchema,
  AutoGeneratePostSchema,
  SocialPostFiltersSchema,
  PLATFORM_CHAR_LIMITS,
} from '@realflow/shared';
import type { SocialPlatform, PlatformPublishResult } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';
import { IntegrationRegistry } from '../services/integration-registry';
import { SocialPublishingService } from '@realflow/integrations';
import { productGuardHook } from '../plugins/product-guard';

/**
 * Social Posts API routes.
 *
 * Provides endpoints for:
 * - CRUD operations on social posts (multi-platform)
 * - Publishing posts to Facebook, Instagram, and LinkedIn
 * - Connected social accounts management
 * - Auto-generating posts from property listings
 * - Post analytics retrieval
 */
export async function socialPostRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', productGuardHook('social_publishing'));

  // ─── List Social Posts ──────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = SocialPostFiltersSchema.safeParse(request.query);
    const filters = parsed.success ? parsed.data : {};

    let query = supabase
      .from('social_posts')
      .select('*')
      .eq('is_deleted', false)
      .order('scheduled_at', { ascending: true });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.platform) {
      query = query.contains('platforms', [filters.platform]);
    }

    if (filters.dateFrom) {
      query = query.gte('scheduled_at', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('scheduled_at', filters.dateTo);
    }

    if (filters.propertyId) {
      query = query.eq('property_id', filters.propertyId);
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

    // Validate character limits per platform
    for (const platform of parsed.data.platforms) {
      const limit = PLATFORM_CHAR_LIMITS[platform];
      if (parsed.data.content.length > limit) {
        return reply.status(400).send({
          error: `Content exceeds ${platform} character limit of ${limit}`,
        });
      }
    }

    // Get current user
    const { data: userData } = await supabase.from('users').select('id').single();

    if (!userData) return reply.status(401).send({ error: 'User not found' });

    const status = parsed.data.scheduledAt ? 'scheduled' : 'draft';

    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        property_id: parsed.data.propertyId ?? null,
        platforms: parsed.data.platforms,
        content: parsed.data.content,
        media_urls: parsed.data.mediaUrls,
        status,
        scheduled_at: parsed.data.scheduledAt ?? null,
        created_by: userData.id,
        platform_results: [],
        retry_count: 0,
        max_retries: 3,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // ─── Update Social Post ─────────────────────────────────────────
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateSocialPostSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    // Only allow updates to draft or scheduled posts
    const { data: existing } = await supabase
      .from('social_posts')
      .select('status')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (!existing) {
      return reply.status(404).send({ error: 'Post not found' });
    }

    const existingStatus = existing.status as string;
    if (existingStatus !== 'draft' && existingStatus !== 'scheduled') {
      return reply.status(400).send({
        error: 'Only draft or scheduled posts can be updated',
      });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.content !== undefined) updates.content = parsed.data.content;
    if (parsed.data.mediaUrls !== undefined) updates.media_urls = parsed.data.mediaUrls;
    if (parsed.data.imageUrl !== undefined) {
      updates.media_urls = [parsed.data.imageUrl];
    }
    if (parsed.data.scheduledAt !== undefined) updates.scheduled_at = parsed.data.scheduledAt;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.platforms !== undefined) updates.platforms = parsed.data.platforms;
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

    // If the post is scheduled, cancel it
    const { data: post } = await supabase
      .from('social_posts')
      .select('status')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' });
    }

    const { error } = await supabase
      .from('social_posts')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        status: (post.status as string) === 'scheduled' ? 'draft' : post.status,
      })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });

  // ─── Publish a Post Immediately ─────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/publish', async (request, reply) => {
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

    const postRecord = post as Record<string, unknown>;
    const currentStatus = postRecord.status as string;

    if (currentStatus === 'published') {
      return reply.status(400).send({ error: 'Post is already published' });
    }

    if (currentStatus === 'publishing') {
      return reply.status(400).send({ error: 'Post is currently being published' });
    }

    // Mark as publishing
    await supabase
      .from('social_posts')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', id);

    // Get current user for integration lookup
    const createdBy = postRecord.created_by as string;
    const registry = new IntegrationRegistry(request, createdBy);
    const meta = await registry.getMetaClient();
    const linkedin = await registry.getLinkedInClient();

    const platforms = (postRecord.platforms as SocialPlatform[]) ?? [];
    const content = postRecord.content as string;
    const mediaUrls = (postRecord.media_urls as string[]) ?? [];

    // Verify required integrations are connected before publishing
    const needsMeta = platforms.some((p) => p === 'facebook' || p === 'instagram');
    const needsLinkedIn = platforms.some((p) => p === 'linkedin');

    if (needsMeta && !meta) {
      await supabase
        .from('social_posts')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', id);
      return reply.status(400).send({ error: 'Meta integration not connected' });
    }

    if (needsLinkedIn && !linkedin) {
      await supabase
        .from('social_posts')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', id);
      return reply.status(400).send({ error: 'LinkedIn integration not connected' });
    }

    const publishingService = new SocialPublishingService({
      meta: meta ?? undefined,
      linkedin: linkedin ?? undefined,
    });

    try {
      const result = await publishingService.publishToMultiplePlatforms({
        id,
        content,
        mediaUrls,
        platforms,
      });

      const { data: updatedPost, error: updateError } = await supabase
        .from('social_posts')
        .update({
          status: result.overallStatus,
          published_at: result.publishedAt ?? null,
          platform_results: result.platformResults,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) return reply.status(500).send({ error: updateError.message });
      return { data: updatedPost };
    } catch (err) {
      await supabase
        .from('social_posts')
        .update({
          status: 'failed',
          last_error: err instanceof Error ? err.message : 'Unknown publishing error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      const errorMessage = err instanceof Error ? err.message : 'Unknown publishing error';
      return reply.status(500).send({ error: errorMessage });
    }
  });

  // ─── Get Post Analytics ─────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id/analytics', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: post, error } = await supabase
      .from('social_posts')
      .select('id, analytics, platform_results, status, platforms, published_at')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error || !post) {
      return reply.status(404).send({ error: 'Post not found' });
    }

    return { data: post };
  });

  // ─── List Connected Social Accounts ─────────────────────────────
  fastify.get('/accounts', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: userData } = await supabase.from('users').select('id').single();

    if (!userData) return reply.status(401).send({ error: 'User not found' });

    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userData.id)
      .eq('is_active', true);

    if (error) return reply.status(500).send({ error: error.message });
    return { data: accounts ?? [] };
  });

  // ─── Connect Social Account (OAuth) ─────────────────────────────
  fastify.post('/accounts/connect', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = ConnectSocialAccountSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { data: userData } = await supabase.from('users').select('id').single();

    if (!userData) return reply.status(401).send({ error: 'User not found' });

    // The actual OAuth token exchange would happen here.
    // For now, store the connection details that the frontend OAuth flow provides.
    const { data, error } = await supabase
      .from('social_accounts')
      .insert({
        user_id: userData.id,
        platform: parsed.data.platform,
        account_name: 'Pending connection',
        access_token: parsed.data.authCode,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
        is_active: true,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // ─── Auto-Generate Post from Property ───────────────────────────
  fastify.post<{ Params: { propertyId: string } }>(
    '/from-property/:propertyId',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { propertyId } = request.params;
      const parsed = AutoGeneratePostSchema.safeParse({
        propertyId,
        ...(request.body as Record<string, unknown>),
      });

      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      // Get the property
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (propError || !property) {
        return reply.status(404).send({ error: 'Property not found' });
      }

      const prop = property as Record<string, unknown>;
      const address = prop.address as Record<string, string>;
      const bedrooms = prop.bedrooms as number;
      const bathrooms = prop.bathrooms as number;
      const carSpaces = prop.car_spaces as number;
      const propertyType = prop.property_type as string;
      const priceGuide = prop.price_guide as string | null;
      const description = prop.listing_description as string | null;
      const photos = (prop.photos as Array<Record<string, unknown>>) ?? [];

      // Build a listing-style post
      const streetLine = [address.streetNumber, address.streetName].filter(Boolean).join(' ');
      const locationLine = [address.suburb, address.state, address.postcode]
        .filter(Boolean)
        .join(', ');
      const features = `${bedrooms} bed | ${bathrooms} bath | ${carSpaces} car`;

      const toneMap: Record<string, string> = {
        professional: 'Just listed',
        casual: 'Check out this beauty',
        luxury: 'An exceptional offering',
        investment: 'Investment opportunity',
      };

      const opener = toneMap[parsed.data.tone] ?? 'Just listed';
      const priceText = priceGuide ? `\nPrice guide: ${priceGuide}` : '';

      const content = [
        `${opener} in ${address.suburb ?? 'your area'}!`,
        '',
        `${streetLine}, ${locationLine}`,
        `${propertyType} | ${features}`,
        priceText,
        '',
        description ? description.slice(0, 200) + (description.length > 200 ? '...' : '') : '',
        '',
        'Contact us for more information or to arrange an inspection.',
        '',
        '#realestate #property #forsale #australia',
        address.suburb ? `#${address.suburb.replace(/\s+/g, '')}` : '',
        address.state ? `#${address.state}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const mediaUrls = photos
        .filter((p) => p.url)
        .slice(0, 4)
        .map((p) => p.url as string);

      // Get current user
      const { data: userData } = await supabase.from('users').select('id').single();

      if (!userData) return reply.status(401).send({ error: 'User not found' });

      // Create the draft post
      const { data: post, error: postError } = await supabase
        .from('social_posts')
        .insert({
          property_id: propertyId,
          platforms: parsed.data.platforms,
          content,
          media_urls: mediaUrls,
          status: 'draft',
          created_by: userData.id,
          platform_results: [],
          retry_count: 0,
          max_retries: 3,
        })
        .select()
        .single();

      if (postError) return reply.status(500).send({ error: postError.message });
      return reply.status(201).send({ data: post });
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

    const results: Array<{
      id: string;
      status: string;
      platformResults?: PlatformPublishResult[];
      error?: string;
    }> = [];

    for (const post of duePosts ?? []) {
      const postRecord = post as Record<string, unknown>;
      const postId = postRecord.id as string;
      const createdBy = postRecord.created_by as string;

      const registry = new IntegrationRegistry(request, createdBy);
      const meta = await registry.getMetaClient();
      const linkedin = await registry.getLinkedInClient();

      const publishingService = new SocialPublishingService({
        meta: meta ?? undefined,
        linkedin: linkedin ?? undefined,
      });

      const platforms = (postRecord.platforms as SocialPlatform[]) ?? [];
      const content = postRecord.content as string;
      const mediaUrls = (postRecord.media_urls as string[]) ?? [];

      try {
        const result = await publishingService.publishToMultiplePlatforms({
          id: postId,
          content,
          mediaUrls,
          platforms,
        });

        await supabase
          .from('social_posts')
          .update({
            status: result.overallStatus,
            published_at: result.publishedAt ?? null,
            platform_results: result.platformResults,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);

        results.push({
          id: postId,
          status: result.overallStatus,
          platformResults: result.platformResults,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const retryCount = (postRecord.retry_count as number) ?? 0;
        const maxRetries = (postRecord.max_retries as number) ?? 3;

        const newStatus = retryCount < maxRetries ? 'scheduled' : 'failed';

        await supabase
          .from('social_posts')
          .update({
            status: newStatus,
            retry_count: retryCount + 1,
            last_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);

        results.push({ id: postId, status: newStatus, error: errorMessage });
      }
    }

    return { data: { processed: results.length, results } };
  });
}
