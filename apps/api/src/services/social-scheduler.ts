/**
 * Social Post Scheduler
 *
 * Runs on a configurable interval (default 1 minute) and:
 * 1. Finds scheduled posts that are due for publishing
 * 2. Publishes them via the SocialPublishingService
 * 3. Retries failed publications up to max_retries
 * 4. Provides optimal posting time suggestions based on engagement data
 *
 * Called via setInterval in apps/api/src/index.ts after server start.
 * Also triggered by POST /api/v1/social-posts/publish-scheduled for manual runs.
 */

import { createClient } from '@supabase/supabase-js';
import type { SocialPlatform, PlatformPublishResult, OptimalPostingTime } from '@realflow/shared';
import { SocialPublishingService, MetaSocialClient, LinkedInClient } from '@realflow/integrations';
import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialSchedulerTickResult {
  postsProcessed: number;
  postsPublished: number;
  postsFailed: number;
  postsRetried: number;
  errors: string[];
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class SocialScheduler {
  private supabase;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;

  constructor(intervalMs = 60 * 1000) {
    this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.tick().catch((err: unknown) => {
        console.error('[SocialScheduler] tick error:', err instanceof Error ? err.message : err);
      });
    }, this.intervalMs);
    console.log(`[SocialScheduler] started (interval: ${this.intervalMs / 1000}s)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SocialScheduler] stopped');
    }
  }

  /**
   * Run one scheduler tick manually.
   */
  async tick(): Promise<SocialSchedulerTickResult> {
    const result: SocialSchedulerTickResult = {
      postsProcessed: 0,
      postsPublished: 0,
      postsFailed: 0,
      postsRetried: 0,
      errors: [],
    };

    // ─── 1. Process scheduled posts that are due ──────────────────────
    try {
      const dueResult = await this.processScheduledPosts();
      result.postsProcessed += dueResult.processed;
      result.postsPublished += dueResult.published;
      result.postsFailed += dueResult.failed;
      result.errors.push(...dueResult.errors);
    } catch (err) {
      result.errors.push(`scheduled posts: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // ─── 2. Retry failed posts that haven't exceeded max retries ─────
    try {
      const retryResult = await this.retryFailedPosts();
      result.postsRetried += retryResult.retried;
      result.postsPublished += retryResult.published;
      result.errors.push(...retryResult.errors);
    } catch (err) {
      result.errors.push(`retry failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    if (result.postsProcessed > 0 || result.postsRetried > 0) {
      console.log('[SocialScheduler] tick complete', result);
    }

    return result;
  }

  /**
   * Get optimal posting time suggestions based on historical engagement data.
   * Analyses published posts to find time slots with the highest engagement.
   */
  async getOptimalPostingTimes(
    userId: string,
    platform?: SocialPlatform,
  ): Promise<OptimalPostingTime[]> {
    let query = this.supabase
      .from('social_posts')
      .select('platforms, published_at, analytics')
      .eq('created_by', userId)
      .eq('status', 'published')
      .eq('is_deleted', false)
      .not('published_at', 'is', null);

    if (platform) {
      query = query.contains('platforms', [platform]);
    }

    const { data: posts } = await query;

    if (!posts || posts.length === 0) {
      return this.getDefaultOptimalTimes(platform);
    }

    // Aggregate engagement by day-of-week and hour
    const timeSlots: Map<string, { total: number; count: number; platform: SocialPlatform }> = new Map();

    for (const post of posts) {
      const postRecord = post as Record<string, unknown>;
      const publishedAt = postRecord.published_at as string;
      const analytics = postRecord.analytics as Record<string, number> | null;
      const platforms = postRecord.platforms as SocialPlatform[];

      if (!publishedAt) continue;

      const date = new Date(publishedAt);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const engagement = analytics
        ? (analytics.engagement ?? 0) + (analytics.clicks ?? 0) + (analytics.shares ?? 0)
        : 0;

      for (const p of platforms) {
        const key = `${p}:${dayOfWeek}:${hour}`;
        const existing = timeSlots.get(key);
        if (existing) {
          existing.total += engagement;
          existing.count += 1;
        } else {
          timeSlots.set(key, { total: engagement, count: 1, platform: p });
        }
      }
    }

    const suggestions: OptimalPostingTime[] = [];
    for (const [key, data] of timeSlots.entries()) {
      const [platformStr, dayStr, hourStr] = key.split(':');
      suggestions.push({
        platform: platformStr as SocialPlatform,
        dayOfWeek: parseInt(dayStr!, 10),
        hour: parseInt(hourStr!, 10),
        engagementScore: data.count > 0 ? data.total / data.count : 0,
      });
    }

    // Sort by engagement score descending
    return suggestions.sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 10);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async processScheduledPosts(): Promise<{
    processed: number;
    published: number;
    failed: number;
    errors: string[];
  }> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    let published = 0;
    let failed = 0;

    const { data: duePosts } = await this.supabase
      .from('social_posts')
      .select('*')
      .eq('status', 'scheduled')
      .eq('is_deleted', false)
      .lte('scheduled_at', now);

    if (!duePosts || duePosts.length === 0) {
      return { processed: 0, published: 0, failed: 0, errors: [] };
    }

    for (const post of duePosts) {
      const postRecord = post as Record<string, unknown>;
      const postId = postRecord.id as string;

      try {
        // Mark as publishing
        await this.supabase
          .from('social_posts')
          .update({ status: 'publishing', updated_at: new Date().toISOString() })
          .eq('id', postId);

        const publishingService = await this.createPublishingServiceForUser(
          postRecord.created_by as string,
        );

        const result = await publishingService.publishToMultiplePlatforms({
          id: postId,
          content: postRecord.content as string,
          mediaUrls: (postRecord.media_urls as string[]) ?? [],
          platforms: (postRecord.platforms as SocialPlatform[]) ?? [],
        });

        await this.supabase
          .from('social_posts')
          .update({
            status: result.overallStatus,
            published_at: result.publishedAt ?? null,
            platform_results: result.platformResults,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);

        if (result.overallStatus === 'published') {
          published++;
        } else {
          failed++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Post ${postId}: ${msg}`);
        failed++;

        await this.supabase
          .from('social_posts')
          .update({
            status: 'failed',
            last_error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);
      }
    }

    return { processed: duePosts.length, published, failed, errors };
  }

  private async retryFailedPosts(): Promise<{
    retried: number;
    published: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let published = 0;

    // Find failed posts that haven't exceeded max retries
    // Only retry posts that failed more than 5 minutes ago to avoid rapid retries
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: failedPosts } = await this.supabase
      .from('social_posts')
      .select('*')
      .eq('status', 'failed')
      .eq('is_deleted', false)
      .lt('updated_at', fiveMinutesAgo)
      .not('scheduled_at', 'is', null); // Only retry posts that were intentionally scheduled

    if (!failedPosts || failedPosts.length === 0) {
      return { retried: 0, published: 0, errors: [] };
    }

    const retryable = failedPosts.filter((post) => {
      const record = post as Record<string, unknown>;
      const retryCount = (record.retry_count as number) ?? 0;
      const maxRetries = (record.max_retries as number) ?? 3;
      return retryCount < maxRetries;
    });

    for (const post of retryable) {
      const postRecord = post as Record<string, unknown>;
      const postId = postRecord.id as string;
      const retryCount = (postRecord.retry_count as number) ?? 0;

      try {
        await this.supabase
          .from('social_posts')
          .update({
            status: 'publishing',
            retry_count: retryCount + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);

        const publishingService = await this.createPublishingServiceForUser(
          postRecord.created_by as string,
        );

        const result = await publishingService.publishToMultiplePlatforms({
          id: postId,
          content: postRecord.content as string,
          mediaUrls: (postRecord.media_urls as string[]) ?? [],
          platforms: (postRecord.platforms as SocialPlatform[]) ?? [],
        });

        await this.supabase
          .from('social_posts')
          .update({
            status: result.overallStatus,
            published_at: result.publishedAt ?? null,
            platform_results: result.platformResults,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);

        if (result.overallStatus === 'published') {
          published++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Retry post ${postId}: ${msg}`);

        await this.supabase
          .from('social_posts')
          .update({
            status: 'failed',
            last_error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);
      }
    }

    return { retried: retryable.length, published, errors };
  }

  private async createPublishingServiceForUser(userId: string): Promise<SocialPublishingService> {
    // Get Meta tokens
    const { data: metaToken } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'meta')
      .single();

    let meta: MetaSocialClient | undefined;
    if (metaToken) {
      const { data: metaConnection } = await this.supabase
        .from('integration_connections')
        .select('*')
        .eq('user_id', userId)
        .in('provider', ['facebook', 'instagram'])
        .eq('is_active', true)
        .single();

      const metaConfig = (metaConnection?.config ?? {}) as Record<string, string>;
      meta = new MetaSocialClient({
        pageAccessToken: metaToken.access_token as string,
        pageId: metaConfig.pageId ?? '',
        instagramAccountId: metaConfig.instagramAccountId,
      });
    }

    // Get LinkedIn tokens
    const { data: linkedinToken } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'linkedin')
      .single();

    let linkedin: LinkedInClient | undefined;
    if (linkedinToken) {
      const { data: linkedinConnection } = await this.supabase
        .from('integration_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'linkedin')
        .eq('is_active', true)
        .single();

      const linkedinConfig = (linkedinConnection?.config ?? {}) as Record<string, string>;
      linkedin = new LinkedInClient({
        accessToken: linkedinToken.access_token as string,
        organisationId: linkedinConfig.organisationId,
      });
    }

    return new SocialPublishingService({ meta, linkedin });
  }

  /**
   * Return default optimal posting times for the Australian market
   * when there is insufficient historical data.
   */
  private getDefaultOptimalTimes(platform?: SocialPlatform): OptimalPostingTime[] {
    const defaults: OptimalPostingTime[] = [];
    const platforms: SocialPlatform[] = platform ? [platform] : ['facebook', 'instagram', 'linkedin'];

    // Australian peak engagement times (AEST):
    // Weekdays: 7-8am (commute), 12-1pm (lunch), 7-8pm (evening)
    // Weekends: 9-10am, 5-6pm
    const weekdaySlots = [
      { hour: 7, score: 85 },
      { hour: 12, score: 90 },
      { hour: 19, score: 95 },
    ];

    const weekendSlots = [
      { hour: 9, score: 80 },
      { hour: 17, score: 75 },
    ];

    for (const p of platforms) {
      // Weekdays (Monday=1 to Friday=5)
      for (let day = 1; day <= 5; day++) {
        for (const slot of weekdaySlots) {
          defaults.push({
            platform: p,
            dayOfWeek: day,
            hour: slot.hour,
            engagementScore: slot.score,
          });
        }
      }

      // Weekends (Saturday=6, Sunday=0)
      for (const day of [0, 6]) {
        for (const slot of weekendSlots) {
          defaults.push({
            platform: p,
            dayOfWeek: day,
            hour: slot.hour,
            engagementScore: slot.score,
          });
        }
      }
    }

    return defaults.sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 10);
  }
}

// Singleton instance
let _socialScheduler: SocialScheduler | null = null;

export function getSocialScheduler(): SocialScheduler {
  if (!_socialScheduler) {
    _socialScheduler = new SocialScheduler();
  }
  return _socialScheduler;
}
