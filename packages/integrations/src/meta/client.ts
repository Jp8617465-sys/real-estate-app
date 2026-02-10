import { z } from 'zod';

const MetaConfigSchema = z.object({
  pageAccessToken: z.string(),
  pageId: z.string(),
  instagramAccountId: z.string().optional(),
  apiVersion: z.string().default('v19.0'),
});

type MetaConfig = z.infer<typeof MetaConfigSchema>;

/**
 * Client for Meta (Facebook + Instagram) Graph API.
 * Handles posting listings to Facebook Pages and Instagram Business accounts,
 * and ingesting leads from Facebook Lead Ads.
 */
export class MetaSocialClient {
  private config: MetaConfig;
  private baseUrl: string;

  constructor(config: MetaConfig) {
    this.config = MetaConfigSchema.parse(config);
    this.baseUrl = `https://graph.facebook.com/${this.config.apiVersion}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('access_token', this.config.pageAccessToken);

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Meta API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Post a listing to the Facebook Page.
   */
  async postToFacebook(params: {
    message: string;
    link?: string;
    photoUrl?: string;
  }): Promise<{ id: string }> {
    if (params.photoUrl) {
      return this.request(`/${this.config.pageId}/photos`, {
        method: 'POST',
        body: JSON.stringify({
          message: params.message,
          url: params.photoUrl,
        }),
      });
    }

    return this.request(`/${this.config.pageId}/feed`, {
      method: 'POST',
      body: JSON.stringify({
        message: params.message,
        link: params.link,
      }),
    });
  }

  /**
   * Post a listing to Instagram (requires Instagram Business account).
   * Instagram posting is a two-step process: create media container, then publish.
   */
  async postToInstagram(params: {
    imageUrl: string;
    caption: string;
  }): Promise<{ id: string }> {
    if (!this.config.instagramAccountId) {
      throw new Error('Instagram account ID not configured');
    }

    // Step 1: Create media container
    const container = await this.request<{ id: string }>(
      `/${this.config.instagramAccountId}/media`,
      {
        method: 'POST',
        body: JSON.stringify({
          image_url: params.imageUrl,
          caption: params.caption,
        }),
      },
    );

    // Step 2: Publish the container
    return this.request(`/${this.config.instagramAccountId}/media_publish`, {
      method: 'POST',
      body: JSON.stringify({
        creation_id: container.id,
      }),
    });
  }

  /**
   * Retrieve leads from a Facebook Lead Ad form.
   */
  async getLeadAdLeads(formId: string): Promise<unknown> {
    return this.request(`/${formId}/leads`);
  }

  /**
   * Get page conversations (for DM inbox integration).
   */
  async getConversations(limit = 25): Promise<unknown> {
    return this.request(`/${this.config.pageId}/conversations?limit=${limit}`);
  }

  /**
   * Send a message in an existing Facebook Page conversation.
   * Used for replying to DMs from the unified inbox.
   */
  async sendPageMessage(conversationId: string, message: string): Promise<{ id: string }> {
    return this.request<{ id: string }>(`/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }
}
