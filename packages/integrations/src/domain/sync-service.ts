import { DomainClient } from './client';
import {
  type DomainListing,
  type DomainSearchResponse,
  DOMAIN_PROPERTY_TYPE_MAP,
  DOMAIN_LISTING_STATUS_MAP,
} from './types';

// ─── Sync Configuration ─────────────────────────────────────────────────────

export interface SyncConfig {
  /** Maximum listings to process per sync run */
  maxListingsPerSync: number;
  /** Delay between API calls in milliseconds (to respect rate limits) */
  delayBetweenCallsMs: number;
  /** Whether to perform a full sync (ignore lastSyncAt) */
  fullSync: boolean;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxListingsPerSync: 500,
  delayBetweenCallsMs: 200,
  fullSync: false,
};

// ─── Sync Result ────────────────────────────────────────────────────────────

export interface PropertySyncResult {
  listingsFound: number;
  listingsCreated: number;
  listingsUpdated: number;
  priceChangesDetected: number;
  statusChangesDetected: number;
  photosUpdated: number;
  errors: SyncError[];
  syncedAt: string;
}

export interface SyncError {
  listingId: string;
  error: string;
  phase: 'fetch' | 'map' | 'upsert';
}

// ─── Mapped Property (ready for database upsert) ───────────────────────────

export interface MappedProperty {
  domainListingId: string;
  addressStreetNumber: string;
  addressStreet: string;
  addressSuburb: string;
  addressState: string;
  addressPostcode: string;
  addressCountry: string;
  unitNumber: string | null;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  carSpaces: number;
  landSize: number | null;
  buildingSize: number | null;
  yearBuilt: number | null;
  listPrice: number | null;
  priceGuide: string | null;
  listingStatus: string;
  saleType: string;
  auctionDate: string | null;
  listingDescription: string | null;
  headline: string | null;
  photos: MappedPhoto[];
  floorPlans: string[];
  virtualTourUrl: string | null;
  features: string[];
  agents: MappedAgent[];
  dateListed: string | null;
  dateUpdated: string | null;
}

export interface MappedPhoto {
  url: string;
  caption: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface MappedAgent {
  agentId: string;
  name: string;
  email: string | null;
  phone: string | null;
  agencyName: string | null;
}

// ─── Price Change Record ────────────────────────────────────────────────────

export interface DetectedPriceChange {
  domainListingId: string;
  previousPrice: number | null;
  newPrice: number;
  changePercent: number | null;
  changeType: 'reduction' | 'increase' | 'price_guide_set';
}

// ─── Status Change Record ───────────────────────────────────────────────────

export interface DetectedStatusChange {
  domainListingId: string;
  previousStatus: string;
  newStatus: string;
}

// ─── Property Sync Service ──────────────────────────────────────────────────

/**
 * Service responsible for synchronising Domain.com.au listings
 * with the local RealFlow property database.
 *
 * Responsibilities:
 * - Fetch listings from Domain API
 * - Map Domain listing format to RealFlow property schema
 * - Handle photos/media URL extraction
 * - Detect price changes and status transitions
 * - Support both incremental and full sync modes
 */
export class PropertySyncService {
  private readonly client: DomainClient;
  private readonly config: SyncConfig;

  constructor(client: DomainClient, config?: Partial<SyncConfig>) {
    this.client = client;
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  // ─── Full Sync ──────────────────────────────────────────────────────────────

  /**
   * Perform a full sync for the given search criteria.
   * Fetches all pages of results and maps them to RealFlow format.
   */
  async syncListings(
    searchParams: Array<{
      suburb: string;
      state: string;
      postcode: string;
      minPrice?: number;
      maxPrice?: number;
      minBedrooms?: number;
      propertyTypes?: string[];
    }>,
    existingListings: Map<string, { listPrice: number | null; listingStatus: string }>,
  ): Promise<{
    properties: MappedProperty[];
    priceChanges: DetectedPriceChange[];
    statusChanges: DetectedStatusChange[];
    result: PropertySyncResult;
  }> {
    const result: PropertySyncResult = {
      listingsFound: 0,
      listingsCreated: 0,
      listingsUpdated: 0,
      priceChangesDetected: 0,
      statusChangesDetected: 0,
      photosUpdated: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    const allMapped: MappedProperty[] = [];
    const allPriceChanges: DetectedPriceChange[] = [];
    const allStatusChanges: DetectedStatusChange[] = [];
    const seenListingIds = new Set<string>();

    for (const params of searchParams) {
      if (allMapped.length >= this.config.maxListingsPerSync) break;

      try {
        const listings = await this.fetchAllPages(params);

        for (const listing of listings) {
          const listingId = String(listing.id ?? listing.listingId ?? '');
          if (!listingId || seenListingIds.has(listingId)) continue;
          seenListingIds.add(listingId);

          result.listingsFound++;
          if (allMapped.length >= this.config.maxListingsPerSync) break;

          try {
            const mapped = this.mapListing(listing);
            allMapped.push(mapped);

            const existing = existingListings.get(listingId);

            if (existing) {
              result.listingsUpdated++;

              // Detect price change
              const priceChange = this.detectPriceChange(
                listingId,
                existing.listPrice,
                mapped.listPrice,
              );
              if (priceChange) {
                allPriceChanges.push(priceChange);
                result.priceChangesDetected++;
              }

              // Detect status change
              const statusChange = this.detectStatusChange(
                listingId,
                existing.listingStatus,
                mapped.listingStatus,
              );
              if (statusChange) {
                allStatusChanges.push(statusChange);
                result.statusChangesDetected++;
              }
            } else {
              result.listingsCreated++;
            }
          } catch (err) {
            result.errors.push({
              listingId,
              error: err instanceof Error ? err.message : String(err),
              phase: 'map',
            });
          }
        }
      } catch (err) {
        result.errors.push({
          listingId: `search:${params.suburb}`,
          error: err instanceof Error ? err.message : String(err),
          phase: 'fetch',
        });
      }

      // Respect rate limits between suburb searches
      if (this.config.delayBetweenCallsMs > 0) {
        await this.delay(this.config.delayBetweenCallsMs);
      }
    }

    return {
      properties: allMapped,
      priceChanges: allPriceChanges,
      statusChanges: allStatusChanges,
      result,
    };
  }

  // ─── Incremental Sync ───────────────────────────────────────────────────────

  /**
   * Sync a single listing by its Domain ID.
   * Useful for webhook-triggered updates.
   */
  async syncSingleListing(
    domainListingId: string,
    existingListing?: { listPrice: number | null; listingStatus: string },
  ): Promise<{
    property: MappedProperty;
    priceChange: DetectedPriceChange | null;
    statusChange: DetectedStatusChange | null;
  }> {
    const listing = await this.client.getListingDetails(domainListingId);
    const mapped = this.mapListing(listing);

    let priceChange: DetectedPriceChange | null = null;
    let statusChange: DetectedStatusChange | null = null;

    if (existingListing) {
      priceChange = this.detectPriceChange(
        domainListingId,
        existingListing.listPrice,
        mapped.listPrice,
      );
      statusChange = this.detectStatusChange(
        domainListingId,
        existingListing.listingStatus,
        mapped.listingStatus,
      );
    }

    return { property: mapped, priceChange, statusChange };
  }

  // ─── Listing Mapping ────────────────────────────────────────────────────────

  /**
   * Map a Domain listing to the RealFlow property schema.
   * Handles all field transformations, type mapping, and media extraction.
   */
  mapListing(listing: DomainListing): MappedProperty {
    const address = listing.addressParts ?? {};
    const pricing = listing.priceDetails ?? {};
    const price = pricing.price ?? pricing.priceFrom ?? null;

    return {
      domainListingId: String(listing.id ?? listing.listingId ?? ''),
      addressStreetNumber: address.streetNumber ?? '',
      addressStreet: address.street ?? '',
      addressSuburb: address.suburb ?? '',
      addressState: address.state ?? '',
      addressPostcode: address.postCode ?? '',
      addressCountry: 'Australia',
      unitNumber: address.unitNumber ?? null,
      propertyType: this.mapPropertyType(listing.propertyTypes?.[0]),
      bedrooms: listing.bedrooms ?? 0,
      bathrooms: listing.bathrooms ?? 0,
      carSpaces: listing.carspaces ?? 0,
      landSize: listing.landAreaSqm ?? null,
      buildingSize: listing.buildingAreaSqm ?? null,
      yearBuilt: listing.yearBuilt ?? null,
      listPrice: price,
      priceGuide: price ? null : (pricing.displayPrice ?? listing.headline ?? null),
      listingStatus: this.mapListingStatus(listing.status),
      saleType: this.mapSaleType(listing.saleMode),
      auctionDate: listing.auctionSchedule?.time ?? null,
      listingDescription: listing.description ?? null,
      headline: listing.headline ?? null,
      photos: this.mapPhotos(listing.media),
      floorPlans: this.mapFloorPlans(listing.floorplans),
      virtualTourUrl: listing.virtualTourUrl ?? null,
      features: listing.features ?? [],
      agents: this.mapAgents(listing.agents),
      dateListed: listing.dateListed ?? null,
      dateUpdated: listing.dateUpdated ?? null,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async fetchAllPages(
    params: {
      suburb: string;
      state: string;
      postcode: string;
      minPrice?: number;
      maxPrice?: number;
      minBedrooms?: number;
      propertyTypes?: string[];
    },
  ): Promise<DomainListing[]> {
    const allListings: DomainListing[] = [];
    let pageNumber = 1;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore && allListings.length < this.config.maxListingsPerSync) {
      const response: DomainSearchResponse = await this.client.searchListings({
        suburb: params.suburb,
        state: params.state,
        postcode: params.postcode,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        minBedrooms: params.minBedrooms,
        propertyTypes: params.propertyTypes,
        pageSize,
        pageNumber,
      });

      const listings = response.listings ?? [];
      allListings.push(...listings);

      // Check if there are more pages
      const totalResults = response.totalResults ?? 0;
      hasMore = listings.length === pageSize && allListings.length < totalResults;
      pageNumber++;

      // Respect rate limits between pages
      if (hasMore && this.config.delayBetweenCallsMs > 0) {
        await this.delay(this.config.delayBetweenCallsMs);
      }
    }

    return allListings;
  }

  private mapPropertyType(domainType?: string): string {
    if (!domainType) return 'house';
    return DOMAIN_PROPERTY_TYPE_MAP[domainType] ?? 'house';
  }

  private mapListingStatus(domainStatus?: string): string {
    if (!domainStatus) return 'active';
    return DOMAIN_LISTING_STATUS_MAP[domainStatus] ?? 'active';
  }

  private mapSaleType(saleMode?: string): string {
    if (!saleMode) return 'private-treaty';
    const lower = saleMode.toLowerCase();
    if (lower === 'auction') return 'auction';
    if (lower === 'tender') return 'tender';
    if (lower.includes('expression')) return 'expression-of-interest';
    return 'private-treaty';
  }

  private mapPhotos(
    media?: Array<{ imageUrl: string; fullUrl?: string; category?: string; rank?: number }>,
  ): MappedPhoto[] {
    if (!media || media.length === 0) return [];

    return media
      .filter((m) => m.imageUrl)
      .map((m, index) => ({
        url: m.fullUrl ?? m.imageUrl,
        caption: m.category ?? null,
        sortOrder: m.rank ?? index,
        isPrimary: index === 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private mapFloorPlans(
    floorplans?: Array<{ imageUrl: string }>,
  ): string[] {
    if (!floorplans || floorplans.length === 0) return [];
    return floorplans.filter((f) => f.imageUrl).map((f) => f.imageUrl);
  }

  private mapAgents(
    agents?: Array<{
      agentId?: string | number;
      name?: string;
      email?: string;
      phone?: string;
      agencyName?: string;
    }>,
  ): MappedAgent[] {
    if (!agents || agents.length === 0) return [];

    return agents
      .filter((a) => a.agentId)
      .map((a) => ({
        agentId: String(a.agentId),
        name: a.name ?? '',
        email: a.email ?? null,
        phone: a.phone ?? null,
        agencyName: a.agencyName ?? null,
      }));
  }

  private detectPriceChange(
    listingId: string,
    previousPrice: number | null,
    newPrice: number | null,
  ): DetectedPriceChange | null {
    // No new price available
    if (newPrice === null) return null;

    // Price guide being set for the first time
    if (previousPrice === null) {
      return {
        domainListingId: listingId,
        previousPrice: null,
        newPrice,
        changePercent: null,
        changeType: 'price_guide_set',
      };
    }

    // No change
    if (previousPrice === newPrice) return null;

    const changePercent =
      Math.round(((newPrice - previousPrice) / previousPrice) * 10000) / 100;

    return {
      domainListingId: listingId,
      previousPrice,
      newPrice,
      changePercent,
      changeType: newPrice < previousPrice ? 'reduction' : 'increase',
    };
  }

  private detectStatusChange(
    listingId: string,
    previousStatus: string,
    newStatus: string,
  ): DetectedStatusChange | null {
    if (previousStatus === newStatus) return null;

    return {
      domainListingId: listingId,
      previousStatus,
      newStatus,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
