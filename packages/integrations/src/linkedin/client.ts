import { z } from 'zod';
import { LinkedInAPIError } from '../errors';

// ─── Config ──────────────────────────────────────────────────────────

const LinkedInConfigSchema = z.object({
  accessToken: z.string().min(1),
  organisationId: z.string().optional(),
  apiVersion: z.string().default('202401'),
});

type LinkedInConfigInput = z.input<typeof LinkedInConfigSchema>;
type LinkedInConfig = z.infer<typeof LinkedInConfigSchema>;

// ─── OAuth Config ────────────────────────────────────────────────────

const LinkedInOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
});

type LinkedInOAuthConfig = z.infer<typeof LinkedInOAuthConfigSchema>;

// ─── Rate Limiting ───────────────────────────────────────────────────

interface RateLimitState {
  remaining: number;
  resetAt: number;
}

// ─── Response Types ──────────────────────────────────────────────────

interface LinkedInProfileResponse {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
}

interface LinkedInPostResponse {
  id: string;
}

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface LinkedInImageUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
        headers: Record<string, string>;
      };
    };
    asset: string;
  };
}

// ─── Scopes ──────────────────────────────────────────────────────────

const LINKEDIN_SCOPES = ['openid', 'profile', 'email', 'w_member_social'] as const;

const LINKEDIN_ORG_SCOPES = [
  ...LINKEDIN_SCOPES,
  'w_organization_social',
  'r_organization_social',
] as const;

/**
 * Client for LinkedIn API.
 * Handles personal and company page posting, OAuth2 flows, and profile retrieval.
 *
 * LinkedIn API uses the versioned REST API format.
 * Rate limits: 100 API calls per day per member, 1000 for company pages.
 */
export class LinkedInClient {
  private config: LinkedInConfig;
  private baseUrl = 'https://api.linkedin.com/v2';
  private rateLimit: RateLimitState = { remaining: 100, resetAt: 0 };

  constructor(config: LinkedInConfigInput) {
    this.config = LinkedInConfigSchema.parse(config);
  }

  // ─── OAuth2 Helpers ───────────────────────────────────────────────

  /**
   * Generate the OAuth2 authorisation URL for LinkedIn sign-in.
   */
  static getAuthorizeUrl(
    oauthConfig: LinkedInOAuthConfig,
    options?: { state?: string; includeOrgScopes?: boolean },
  ): string {
    const config = LinkedInOAuthConfigSchema.parse(oauthConfig);
    const scopes = options?.includeOrgScopes ? LINKEDIN_ORG_SCOPES : LINKEDIN_SCOPES;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: scopes.join(' '),
    });

    if (options?.state) {
      params.set('state', options.state);
    }

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange an authorisation code for access and refresh tokens.
   */
  static async exchangeCodeForToken(
    oauthConfig: LinkedInOAuthConfig,
    code: string,
  ): Promise<LinkedInTokenResponse> {
    const config = LinkedInOAuthConfigSchema.parse(oauthConfig);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    });

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new LinkedInAPIError('Token exchange failed', response.status, response.statusText);
    }

    return response.json() as Promise<LinkedInTokenResponse>;
  }

  /**
   * Refresh an expired access token using a refresh token.
   */
  static async refreshAccessToken(
    oauthConfig: LinkedInOAuthConfig,
    refreshToken: string,
  ): Promise<LinkedInTokenResponse> {
    const config = LinkedInOAuthConfigSchema.parse(oauthConfig);

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new LinkedInAPIError('Token refresh failed', response.status, response.statusText);
    }

    return response.json() as Promise<LinkedInTokenResponse>;
  }

  // ─── Profile ──────────────────────────────────────────────────────

  /**
   * Retrieve the authenticated user's profile information.
   */
  async getProfile(): Promise<LinkedInProfileResponse> {
    return this.request<LinkedInProfileResponse>('/userinfo', {
      baseUrlOverride: 'https://api.linkedin.com',
    });
  }

  // ─── Posting ──────────────────────────────────────────────────────

  /**
   * Create a text-only post on the authenticated user's profile.
   */
  async createTextPost(params: {
    text: string;
    visibility?: 'PUBLIC' | 'CONNECTIONS';
  }): Promise<LinkedInPostResponse> {
    const authorUrn = await this.getAuthorUrn();

    return this.request<LinkedInPostResponse>('/ugcPosts', {
      method: 'POST',
      body: {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: params.text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility ?? 'PUBLIC',
        },
      },
    });
  }

  /**
   * Create a post with an image on the authenticated user's profile.
   */
  async createImagePost(params: {
    text: string;
    imageUrl: string;
    title?: string;
    visibility?: 'PUBLIC' | 'CONNECTIONS';
  }): Promise<LinkedInPostResponse> {
    const authorUrn = await this.getAuthorUrn();

    // Step 1: Register image upload
    const uploadResponse = await this.registerImageUpload(authorUrn);
    const uploadUrl =
      uploadResponse.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl;
    const asset = uploadResponse.value.asset;

    // Step 2: Download the image and upload to LinkedIn
    const imageResponse = await fetch(params.imageUrl);
    if (!imageResponse.ok) {
      throw new LinkedInAPIError(
        'Failed to download image for LinkedIn upload',
        imageResponse.status,
        imageResponse.statusText,
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const uploadResult = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
    });

    if (!uploadResult.ok) {
      throw new LinkedInAPIError(
        'Failed to upload image to LinkedIn',
        uploadResult.status,
        uploadResult.statusText,
      );
    }

    // Step 3: Create the post with the uploaded media
    return this.request<LinkedInPostResponse>('/ugcPosts', {
      method: 'POST',
      body: {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: params.text },
            shareMediaCategory: 'IMAGE',
            media: [
              {
                status: 'READY',
                media: asset,
                title: { text: params.title ?? '' },
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility ?? 'PUBLIC',
        },
      },
    });
  }

  /**
   * Create a post with an article/link on the authenticated user's profile.
   */
  async createArticlePost(params: {
    text: string;
    articleUrl: string;
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    visibility?: 'PUBLIC' | 'CONNECTIONS';
  }): Promise<LinkedInPostResponse> {
    const authorUrn = await this.getAuthorUrn();

    return this.request<LinkedInPostResponse>('/ugcPosts', {
      method: 'POST',
      body: {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: params.text },
            shareMediaCategory: 'ARTICLE',
            media: [
              {
                status: 'READY',
                originalUrl: params.articleUrl,
                title: { text: params.title ?? '' },
                description: { text: params.description ?? '' },
                thumbnails: params.thumbnailUrl ? [{ resolvedUrl: params.thumbnailUrl }] : [],
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility ?? 'PUBLIC',
        },
      },
    });
  }

  /**
   * Post to a company/organisation page.
   * Requires w_organization_social scope and the organisationId to be configured.
   */
  async createCompanyPost(params: {
    text: string;
    imageUrl?: string;
    articleUrl?: string;
    visibility?: 'PUBLIC';
  }): Promise<LinkedInPostResponse> {
    if (!this.config.organisationId) {
      throw new Error('Organisation ID not configured for company page posting');
    }

    const authorUrn = `urn:li:organization:${this.config.organisationId}`;

    if (params.imageUrl) {
      // Register upload for organisation
      const uploadResponse = await this.registerImageUpload(authorUrn);
      const uploadUrl =
        uploadResponse.value.uploadMechanism[
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ].uploadUrl;
      const asset = uploadResponse.value.asset;

      const imageResponse = await fetch(params.imageUrl);
      if (!imageResponse.ok) {
        throw new LinkedInAPIError(
          'Failed to download image',
          imageResponse.status,
          imageResponse.statusText,
        );
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: imageBuffer,
      });

      return this.request<LinkedInPostResponse>('/ugcPosts', {
        method: 'POST',
        body: {
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: params.text },
              shareMediaCategory: 'IMAGE',
              media: [{ status: 'READY', media: asset }],
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': params.visibility ?? 'PUBLIC',
          },
        },
      });
    }

    if (params.articleUrl) {
      return this.request<LinkedInPostResponse>('/ugcPosts', {
        method: 'POST',
        body: {
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: params.text },
              shareMediaCategory: 'ARTICLE',
              media: [
                {
                  status: 'READY',
                  originalUrl: params.articleUrl,
                },
              ],
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': params.visibility ?? 'PUBLIC',
          },
        },
      });
    }

    // Text-only company post
    return this.request<LinkedInPostResponse>('/ugcPosts', {
      method: 'POST',
      body: {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: params.text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility ?? 'PUBLIC',
        },
      },
    });
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private async getAuthorUrn(): Promise<string> {
    const profile = await this.getProfile();
    return `urn:li:person:${profile.sub}`;
  }

  private async registerImageUpload(ownerUrn: string): Promise<LinkedInImageUploadResponse> {
    return this.request<LinkedInImageUploadResponse>('/assets?action=registerUpload', {
      method: 'POST',
      body: {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: ownerUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      },
    });
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      baseUrlOverride?: string;
    } = {},
  ): Promise<T> {
    // Rate limit check
    if (this.rateLimit.remaining <= 0 && Date.now() < this.rateLimit.resetAt) {
      throw new LinkedInAPIError('LinkedIn API rate limit exceeded', 429, 'Too Many Requests');
    }

    const baseUrl = options.baseUrlOverride ?? this.baseUrl;
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.accessToken}`,
      'LinkedIn-Version': this.config.apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Update rate limit state from response headers
    const remainingHeader = response.headers.get('x-ratelimit-remaining');
    const resetHeader = response.headers.get('x-ratelimit-reset');
    if (remainingHeader !== null) {
      this.rateLimit.remaining = parseInt(remainingHeader, 10);
    }
    if (resetHeader !== null) {
      this.rateLimit.resetAt = parseInt(resetHeader, 10) * 1000;
    }

    if (!response.ok) {
      throw new LinkedInAPIError('LinkedIn API error', response.status, response.statusText);
    }

    // Some endpoints return 201 with empty body
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }
}
