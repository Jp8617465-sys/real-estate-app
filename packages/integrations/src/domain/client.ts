import { z } from 'zod';
import { DomainAPIError } from '../errors';
import {
  type DomainListing,
  type DomainSearchResponse,
  type DomainAgentProfile,
  type DomainPropertyHistory,
  type DomainSalesResponse,
  type DomainAlertCriteria,
  type DomainAlertSubscription,
  type RateLimitConfig,
  type CacheConfig,
  DomainSearchResponseSchema,
  DomainListingSchema,
  DomainAgentProfileSchema,
  DomainPropertyHistorySchema,
  DomainSalesResponseSchema,
  DomainAlertSubscriptionSchema,
  DEFAULT_RATE_LIMIT,
  DEFAULT_CACHE_CONFIG,
} from './types';

// ─── Domain API Configuration ───────────────────────────────────────

const DomainConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  baseUrl: z.string().url().default('https://auth.domain.com.au'),
  apiBaseUrl: z.string().url().default('https://api.domain.com.au/v1'),
  scopes: z
    .array(z.string())
    .default(['api_listings_read', 'api_salesresults_read', 'api_agents_read']),
  rateLimit: z.custom<RateLimitConfig>().optional(),
  cache: z.custom<CacheConfig>().optional(),
});

type DomainConfigInput = z.input<typeof DomainConfigSchema>;
type DomainConfig = z.infer<typeof DomainConfigSchema>;

interface DomainTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ─── Cache Entry ────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ─── Rate Limiter State ─────────────────────────────────────────────

interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

/**
 * Client for the Domain.com.au API.
 * Handles OAuth2 client credentials flow and provides methods
 * for common operations (listings, sales data, suburb stats).
 *
 * Features:
 * - Token-bucket rate limiting to respect Domain API limits
 * - Response caching with configurable TTL per endpoint
 * - Zod validation on all API responses
 * - Comprehensive error handling with retry support
 *
 * API docs: https://developer.domain.com.au
 */
export class DomainClient {
  private config: DomainConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly rateLimitConfig: RateLimitConfig;
  private readonly cacheConfig: CacheConfig;
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  private rateLimiter: RateLimiterState;

  constructor(config: DomainConfigInput) {
    this.config = DomainConfigSchema.parse(config);
    this.rateLimitConfig = this.config.rateLimit ?? DEFAULT_RATE_LIMIT;
    this.cacheConfig = this.config.cache ?? DEFAULT_CACHE_CONFIG;
    this.rateLimiter = {
      tokens: this.rateLimitConfig.maxRequests,
      lastRefill: Date.now(),
    };
  }

  // ─── Authentication ─────────────────────────────────────────────────

  private async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/connect/token`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: this.config.scopes.join(' '),
        }),
      });

      if (!response.ok) {
        throw new DomainAPIError('Domain auth failed', response.status, response.statusText);
      }

      const data = (await response.json()) as DomainTokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

      return this.accessToken;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Rate Limiting ──────────────────────────────────────────────────

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.rateLimiter.lastRefill;

    // Refill tokens based on elapsed time
    if (elapsed >= this.rateLimitConfig.windowMs) {
      this.rateLimiter.tokens = this.rateLimitConfig.maxRequests;
      this.rateLimiter.lastRefill = now;
    } else {
      const refillRate = this.rateLimitConfig.maxRequests / this.rateLimitConfig.windowMs;
      const tokensToAdd = Math.floor(elapsed * refillRate);
      if (tokensToAdd > 0) {
        this.rateLimiter.tokens = Math.min(
          this.rateLimitConfig.maxRequests,
          this.rateLimiter.tokens + tokensToAdd,
        );
        this.rateLimiter.lastRefill = now;
      }
    }

    if (this.rateLimiter.tokens <= 0) {
      // Calculate wait time until next token is available
      const waitMs = Math.ceil(this.rateLimitConfig.windowMs / this.rateLimitConfig.maxRequests);
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      this.rateLimiter.tokens = 1;
      this.rateLimiter.lastRefill = Date.now();
    }

    this.rateLimiter.tokens--;
  }

  // ─── Caching ────────────────────────────────────────────────────────

  private getCacheTtl(path: string): number {
    if (!this.cacheConfig.enabled) return 0;

    for (const [pattern, ttl] of Object.entries(this.cacheConfig.ttlOverrides)) {
      if (path.includes(pattern)) return ttl;
    }
    return this.cacheConfig.defaultTtlMs;
  }

  private getCached<T>(cacheKey: string): T | undefined {
    const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.data;
  }

  private setCache<T>(cacheKey: string, data: T, ttlMs: number): void {
    if (ttlMs <= 0) return;

    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /** Clear all cached responses. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Clear cached responses matching a path pattern. */
  clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // ─── Core Request ───────────────────────────────────────────────────

  private async request<T>(path: string, options: RequestInit = {}, skipCache = false): Promise<T> {
    const cacheKey = `${options.method ?? 'GET'}:${path}:${options.body ?? ''}`;
    const ttl = this.getCacheTtl(path);

    // Check cache for GET-like requests (no body)
    if (!skipCache && !options.body) {
      const cached = this.getCached<T>(cacheKey);
      if (cached !== undefined) return cached;
    }

    // Rate limit
    await this.waitForRateLimit();

    const token = await this.authenticate();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (response.status === 429) {
        // Rate limited by Domain API — wait and retry once
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
        await new Promise<void>((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.request<T>(path, options, true);
      }

      if (!response.ok) {
        throw new DomainAPIError('Domain API error', response.status, response.statusText);
      }

      const data = (await response.json()) as T;

      // Cache the response
      if (!options.body) {
        this.setCache(cacheKey, data, ttl);
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Search Listings ──────────────────────────────────────────────────

  /**
   * Search residential listings by suburb and criteria.
   * Validates the response against DomainSearchResponseSchema.
   */
  async searchListings(params: {
    suburb: string;
    state: string;
    postcode: string;
    listingType?: 'Sale' | 'Rent' | 'Share' | 'Sold' | 'NewHomes';
    propertyTypes?: string[];
    minBedrooms?: number;
    maxBedrooms?: number;
    minBathrooms?: number;
    maxBathrooms?: number;
    minPrice?: number;
    maxPrice?: number;
    minLandArea?: number;
    maxLandArea?: number;
    pageSize?: number;
    pageNumber?: number;
    sortBy?: string;
  }): Promise<DomainSearchResponse> {
    const body = {
      listingType: params.listingType ?? 'Sale',
      locations: [
        {
          suburb: params.suburb,
          state: params.state,
          postCode: params.postcode,
        },
      ],
      propertyTypes: params.propertyTypes,
      minBedrooms: params.minBedrooms,
      maxBedrooms: params.maxBedrooms,
      minBathrooms: params.minBathrooms,
      maxBathrooms: params.maxBathrooms,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minLandArea: params.minLandArea,
      maxLandArea: params.maxLandArea,
      pageSize: params.pageSize ?? 20,
      pageNumber: params.pageNumber ?? 1,
      sort: params.sortBy ? { sortKey: params.sortBy } : undefined,
    };

    const raw = await this.request<unknown>('/listings/residential/_search', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return DomainSearchResponseSchema.parse(raw);
  }

  // ─── Get Listing Details ──────────────────────────────────────────────

  /**
   * Get full listing details by Domain listing ID.
   * Includes photos, floorplans, agent info, inspection times.
   */
  async getListingDetails(listingId: string): Promise<DomainListing> {
    const raw = await this.request<unknown>(`/listings/${listingId}`);
    return DomainListingSchema.parse(raw);
  }

  /**
   * Get a specific listing by its Domain ID (alias for backwards compatibility).
   */
  async getListing(listingId: string): Promise<DomainListing> {
    return this.getListingDetails(listingId);
  }

  // ─── Get Agent Profile ────────────────────────────────────────────────

  /**
   * Get agent profile from Domain.
   * Includes biography, sales stats, agency info.
   */
  async getAgentProfile(agentId: string): Promise<DomainAgentProfile> {
    const raw = await this.request<unknown>(`/agents/${agentId}`);
    return DomainAgentProfileSchema.parse(raw);
  }

  // ─── Get Property History ─────────────────────────────────────────────

  /**
   * Get price history and past sales for a property.
   * Returns a chronological list of events (sold, listed, rented, withdrawn).
   */
  async getPropertyHistory(propertyId: string): Promise<DomainPropertyHistory> {
    const raw = await this.request<unknown>(`/properties/${propertyId}`);
    return DomainPropertyHistorySchema.parse(raw);
  }

  // ─── Subscribe to Alerts ──────────────────────────────────────────────

  /**
   * Set up listing alerts that trigger webhooks when new listings match criteria.
   * Domain will POST to the provided webhookUrl when matching listings appear.
   */
  async subscribeToAlerts(
    criteria: DomainAlertCriteria,
    webhookUrl: string,
  ): Promise<DomainAlertSubscription> {
    const raw = await this.request<unknown>('/listings/alerts', {
      method: 'POST',
      body: JSON.stringify({
        ...criteria,
        webhookUrl,
      }),
    });

    return DomainAlertSubscriptionSchema.parse(raw);
  }

  /**
   * Unsubscribe from a listing alert by subscription ID.
   */
  async unsubscribeFromAlert(subscriptionId: string): Promise<void> {
    await this.request<unknown>(`/listings/alerts/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  // ─── Get Auction Results ──────────────────────────────────────────────

  /**
   * Get auction clearance results for a suburb within an optional date range.
   * Returns sold, passed-in, and withdrawn auction results.
   */
  async getAuctionResults(
    suburb: string,
    dateRange?: { from?: string; to?: string },
    state = 'NSW',
  ): Promise<DomainSalesResponse> {
    let path = `/salesResults/${encodeURIComponent(state)}/${encodeURIComponent(suburb)}`;

    const queryParts: string[] = [];
    if (dateRange?.from) queryParts.push(`from=${encodeURIComponent(dateRange.from)}`);
    if (dateRange?.to) queryParts.push(`to=${encodeURIComponent(dateRange.to)}`);
    if (queryParts.length > 0) path += `?${queryParts.join('&')}`;

    const raw = await this.request<unknown>(path);
    return DomainSalesResponseSchema.parse(raw);
  }

  /**
   * Get recent sales results for a suburb (backwards compatibility).
   */
  async getSalesResults(suburb: string, state: string): Promise<DomainSalesResponse> {
    return this.getAuctionResults(suburb, undefined, state);
  }

  // ─── Get Suburb Performance ───────────────────────────────────────────

  /**
   * Get suburb performance statistics.
   */
  async getSuburbPerformance(
    suburb: string,
    state: string,
    postcode: string,
    propertyType: 'house' | 'unit',
  ): Promise<unknown> {
    return this.request(
      `/suburbPerformanceStatistics/${encodeURIComponent(state)}/${encodeURIComponent(suburb)}/${postcode}?propertyCategory=${propertyType}`,
    );
  }
}
