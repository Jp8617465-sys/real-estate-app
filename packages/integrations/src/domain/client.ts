import { z } from 'zod';
import { DomainAPIError } from '../errors';

// ─── Domain API Configuration ───────────────────────────────────────
const DomainConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  baseUrl: z.string().url().default('https://auth.domain.com.au'),
  apiBaseUrl: z.string().url().default('https://api.domain.com.au/v1'),
  scopes: z.array(z.string()).default(['api_listings_read', 'api_salesresults_read']),
});

type DomainConfig = z.infer<typeof DomainConfigSchema>;

interface DomainTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Client for the Domain.com.au API.
 * Handles OAuth2 client credentials flow and provides methods
 * for common operations (listings, sales data, suburb stats).
 *
 * API docs: https://developer.domain.com.au
 */
export class DomainClient {
  private config: DomainConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: DomainConfig) {
    this.config = DomainConfigSchema.parse(config);
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const response = await fetch(`${this.config.baseUrl}/v1/connect/token`, {
      method: 'POST',
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
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.authenticate();

    const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new DomainAPIError('Domain API error', response.status, response.statusText);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search residential listings by suburb and criteria.
   */
  async searchListings(params: {
    suburb: string;
    state: string;
    postcode: string;
    propertyTypes?: string[];
    minBedrooms?: number;
    maxBedrooms?: number;
    minPrice?: number;
    maxPrice?: number;
    pageSize?: number;
    pageNumber?: number;
  }): Promise<unknown> {
    return this.request('/listings/residential/_search', {
      method: 'POST',
      body: JSON.stringify({
        listingType: 'Sale',
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
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        pageSize: params.pageSize ?? 20,
        pageNumber: params.pageNumber ?? 1,
      }),
    });
  }

  /**
   * Get a specific listing by its Domain ID.
   */
  async getListing(listingId: string): Promise<unknown> {
    return this.request(`/listings/${listingId}`);
  }

  /**
   * Get recent sales results for a suburb.
   */
  async getSalesResults(suburb: string, state: string): Promise<unknown> {
    return this.request(
      `/salesResults/${encodeURIComponent(state)}/${encodeURIComponent(suburb)}`,
    );
  }

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
