import type { SocialPlatform, PlatformPublishResult, PostStatus } from '@realflow/shared';
import { MetaSocialClient } from '../meta/client';
import { LinkedInClient } from '../linkedin/client';

// ─── Types ───────────────────────────────────────────────────────────

interface PublishablePost {
  id: string;
  content: string;
  mediaUrls: string[];
  platforms: SocialPlatform[];
  propertyId?: string;
  link?: string;
}

interface PublishResult {
  overallStatus: PostStatus;
  platformResults: PlatformPublishResult[];
  publishedAt?: string;
}

interface ScheduledPostEntry {
  post: PublishablePost;
  scheduledAt: string;
  onPublish: (result: PublishResult) => Promise<void>;
}

interface PlatformClients {
  meta?: MetaSocialClient;
  linkedin?: LinkedInClient;
}

// ─── Publishing Service ──────────────────────────────────────────────

/**
 * Multi-channel social publishing service.
 *
 * Orchestrates publishing to Facebook, Instagram, and LinkedIn simultaneously.
 * Tracks per-platform status so partial failures are recorded accurately.
 *
 * Usage:
 *   const service = new SocialPublishingService({ meta, linkedin });
 *   const result = await service.publishToMultiplePlatforms(post);
 */
export class SocialPublishingService {
  private clients: PlatformClients;
  private scheduledPosts: Map<string, ScheduledPostEntry> = new Map();
  private schedulerTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(clients: PlatformClients) {
    this.clients = clients;
  }

  // ─── Single-Platform Publishing ───────────────────────────────────

  /**
   * Publish a post to Facebook via the Meta Graph API.
   * Supports text posts, photo posts, and link posts.
   */
  async publishToFacebook(post: PublishablePost): Promise<PlatformPublishResult> {
    if (!this.clients.meta) {
      return {
        platform: 'facebook',
        status: 'failed',
        errorMessage: 'Facebook integration not connected',
      };
    }

    try {
      const photoUrl = post.mediaUrls.length > 0 ? post.mediaUrls[0] : undefined;

      const result = await this.clients.meta.postToFacebook({
        message: post.content,
        photoUrl,
        link: post.link,
      });

      return {
        platform: 'facebook',
        status: 'published',
        externalPostId: result.id,
        publishedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        platform: 'facebook',
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Unknown Facebook publishing error',
      };
    }
  }

  /**
   * Publish a post to Instagram via the Meta Graph API.
   * Instagram requires at least one image. Supports single image and carousel posts.
   */
  async publishToInstagram(post: PublishablePost): Promise<PlatformPublishResult> {
    if (!this.clients.meta) {
      return {
        platform: 'instagram',
        status: 'failed',
        errorMessage: 'Instagram integration not connected',
      };
    }

    if (post.mediaUrls.length === 0) {
      return {
        platform: 'instagram',
        status: 'failed',
        errorMessage: 'Instagram posts require at least one image',
      };
    }

    try {
      const result = await this.clients.meta.postToInstagram({
        imageUrl: post.mediaUrls[0]!,
        caption: post.content,
      });

      return {
        platform: 'instagram',
        status: 'published',
        externalPostId: result.id,
        publishedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        platform: 'instagram',
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Unknown Instagram publishing error',
      };
    }
  }

  /**
   * Publish a post to LinkedIn.
   * Supports text, image, and article/link posts.
   */
  async publishToLinkedIn(post: PublishablePost): Promise<PlatformPublishResult> {
    if (!this.clients.linkedin) {
      return {
        platform: 'linkedin',
        status: 'failed',
        errorMessage: 'LinkedIn integration not connected',
      };
    }

    try {
      let result: { id: string };

      if (post.mediaUrls.length > 0) {
        result = await this.clients.linkedin.createImagePost({
          text: post.content,
          imageUrl: post.mediaUrls[0]!,
        });
      } else if (post.link) {
        result = await this.clients.linkedin.createArticlePost({
          text: post.content,
          articleUrl: post.link,
        });
      } else {
        result = await this.clients.linkedin.createTextPost({
          text: post.content,
        });
      }

      return {
        platform: 'linkedin',
        status: 'published',
        externalPostId: result.id,
        publishedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        platform: 'linkedin',
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Unknown LinkedIn publishing error',
      };
    }
  }

  // ─── Multi-Platform Publishing ────────────────────────────────────

  /**
   * Publish to all requested platforms simultaneously.
   * Returns per-platform results so partial failures are tracked independently.
   */
  async publishToMultiplePlatforms(post: PublishablePost): Promise<PublishResult> {
    const publishPromises = post.platforms.map((platform) => {
      switch (platform) {
        case 'facebook':
          return this.publishToFacebook(post);
        case 'instagram':
          return this.publishToInstagram(post);
        case 'linkedin':
          return this.publishToLinkedIn(post);
      }
    });

    const platformResults = await Promise.all(publishPromises);

    const allPublished = platformResults.every((r) => r.status === 'published');
    const allFailed = platformResults.every((r) => r.status === 'failed');

    const overallStatus: PostStatus = allPublished
      ? 'published'
      : allFailed
        ? 'failed'
        : 'published'; // Partial success counts as published

    return {
      overallStatus,
      platformResults,
      publishedAt: allFailed ? undefined : new Date().toISOString(),
    };
  }

  // ─── Scheduling ───────────────────────────────────────────────────

  /**
   * Schedule a post for future publishing.
   * The post will be published at the specified scheduledAt time.
   */
  schedulePost(
    post: PublishablePost,
    scheduledAt: string,
    onPublish: (result: PublishResult) => Promise<void>,
  ): void {
    const scheduledTime = new Date(scheduledAt).getTime();
    const now = Date.now();
    const delay = Math.max(0, scheduledTime - now);

    this.scheduledPosts.set(post.id, { post, scheduledAt, onPublish });

    const timer = setTimeout(async () => {
      const entry = this.scheduledPosts.get(post.id);
      if (!entry) return;

      const result = await this.publishToMultiplePlatforms(entry.post);
      await entry.onPublish(result);

      this.scheduledPosts.delete(post.id);
      this.schedulerTimers.delete(post.id);
    }, delay);

    this.schedulerTimers.set(post.id, timer);
  }

  /**
   * Cancel a previously scheduled post.
   * Returns true if the post was found and cancelled, false otherwise.
   */
  cancelScheduledPost(postId: string): boolean {
    const timer = this.schedulerTimers.get(postId);
    if (timer) {
      clearTimeout(timer);
      this.schedulerTimers.delete(postId);
    }

    const existed = this.scheduledPosts.has(postId);
    this.scheduledPosts.delete(postId);
    return existed;
  }

  /**
   * Get all currently scheduled post IDs.
   */
  getScheduledPostIds(): string[] {
    return Array.from(this.scheduledPosts.keys());
  }

  /**
   * Clean up all scheduled timers.
   * Call this when shutting down the service.
   */
  dispose(): void {
    for (const timer of this.schedulerTimers.values()) {
      clearTimeout(timer);
    }
    this.schedulerTimers.clear();
    this.scheduledPosts.clear();
  }
}
