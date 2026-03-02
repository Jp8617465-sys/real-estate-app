import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainClient } from '@realflow/integrations';
import type { PriceChange, DomainAuctionResult as AuctionResult } from '@realflow/shared';

// ─── Domain API shape helpers ──────────────────────────────────────────────

interface DomainListingLocation {
  suburb?: string;
  state?: string;
  postCode?: string;
  displayableAddress?: string;
  streetNumber?: string;
  street?: string;
}

interface DomainListingPricing {
  price?: number;
  priceFrom?: number;
  priceTo?: number;
}

interface DomainListing {
  id?: string | number;
  listingId?: string | number;
  addressParts?: DomainListingLocation;
  priceDetails?: DomainListingPricing;
  propertyTypes?: string[];
  bedrooms?: number;
  bathrooms?: number;
  carspaces?: number;
  landAreaSqm?: number;
  headline?: string;
  description?: string;
  listingType?: string;
  saleMode?: string;
  auctionSchedule?: { time?: string };
}

interface DomainSearchResponse {
  listings?: DomainListing[];
  totalResults?: number;
}

interface DomainSalesResult {
  id?: string | number;
  domainListingId?: string | number;
  suburb?: string;
  postcode?: string;
  state?: string;
  auctionDate?: string;
  result?: string;
  soldPrice?: number;
  reservePrice?: number;
  registeredBidders?: number;
  agentName?: string;
  agencyName?: string;
}

interface DomainSalesResponse {
  salesResults?: DomainSalesResult[];
  results?: DomainSalesResult[];
}

// ─── Brief shape from DB ────────────────────────────────────────────────────

interface ClientBriefRow {
  id: string;
  budget_min: number;
  budget_max: number;
  bedrooms_min: number | null;
  property_types: string[] | null;
  suburbs: Array<{ suburb: string; state?: string; postcode?: string }>;
}

// ─── Search params returned by buildSearchParams ────────────────────────────

export interface DomainSearchParams {
  suburb: string;
  state: string;
  postcode: string;
  minPrice: number;
  maxPrice: number;
  minBedrooms?: number;
  propertyTypes?: string[];
}

// ─── Sync counts ────────────────────────────────────────────────────────────

export interface SyncResult {
  listingsFound: number;
  listingsImported: number;
  matchesTriggered: number;
}

// ─── Domain Sync Engine ─────────────────────────────────────────────────────

/**
 * Orchestrates all Domain.com.au data synchronisation operations:
 * - Listing sync against active client briefs
 * - Price change detection
 * - Auction result ingestion
 */
export class DomainSyncEngine {
  private readonly domain: DomainClient;

  /**
   * @param domain Optional DomainClient instance (inject for testing).
   *               When omitted, a client is created from environment variables.
   */
  constructor(domain?: DomainClient) {
    this.domain = domain ?? new DomainClient({
      clientId: process.env['DOMAIN_CLIENT_ID'] ?? '',
      clientSecret: process.env['DOMAIN_CLIENT_SECRET'] ?? '',
    });
  }

  // ─── buildSearchParams ─────────────────────────────────────────────────────

  /**
   * Convert a client brief's location/budget fields into a set of
   * Domain API search parameter objects — one per suburb preference.
   */
  buildSearchParams(brief: {
    suburbs: Array<{ suburb: string; state?: string; postcode?: string }>;
    budgetMin: number;
    budgetMax: number;
    minBedrooms?: number;
    propertyTypes?: string[];
  }): DomainSearchParams[] {
    return brief.suburbs.map((s) => {
      const params: DomainSearchParams = {
        suburb: s.suburb,
        state: s.state ?? 'NSW',
        postcode: s.postcode ?? '',
        minPrice: brief.budgetMin,
        maxPrice: brief.budgetMax,
      };

      if (brief.minBedrooms !== undefined && brief.minBedrooms > 0) {
        params.minBedrooms = brief.minBedrooms;
      }

      if (brief.propertyTypes && brief.propertyTypes.length > 0) {
        params.propertyTypes = brief.propertyTypes;
      }

      return params;
    });
  }

  // ─── syncListingsForAgent ──────────────────────────────────────────────────

  /**
   * Main sync operation:
   * 1. Load active client briefs for the agent.
   * 2. Derive unique suburb/budget search combos.
   * 3. Fetch listings from Domain.
   * 4. Upsert into `properties` keyed on `domain_listing_id`.
   * 5. Create `property_matches` records.
   * 6. Return counts.
   *
   * Failures from the Domain API are caught and logged — they do not propagate.
   */
  async syncListingsForAgent(
    agentId: string,
    supabase: SupabaseClient,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      listingsFound: 0,
      listingsImported: 0,
      matchesTriggered: 0,
    };

    // 1. Fetch active client briefs for this agent
    const { data: briefs, error: briefsError } = await supabase
      .from('client_briefs')
      .select('id, budget_min, budget_max, bedrooms_min, property_types, suburbs')
      .eq('created_by', agentId)
      .eq('is_deleted', false);

    if (briefsError) {
      console.error('[DomainSyncEngine] Failed to fetch client briefs:', briefsError.message);
      return result;
    }

    if (!briefs || briefs.length === 0) {
      return result;
    }

    // 2. Build deduplicated search param sets across all briefs
    const allSearchParams: DomainSearchParams[] = [];
    const seenKeys = new Set<string>();

    for (const brief of briefs as ClientBriefRow[]) {
      const suburbs: Array<{ suburb: string; state?: string; postcode?: string }> =
        Array.isArray(brief.suburbs) ? brief.suburbs : [];

      const params = this.buildSearchParams({
        suburbs,
        budgetMin: brief.budget_min,
        budgetMax: brief.budget_max,
        minBedrooms: brief.bedrooms_min ?? undefined,
        propertyTypes: brief.property_types ?? undefined,
      });

      for (const p of params) {
        const key = `${p.suburb}|${p.state}|${p.minPrice}|${p.maxPrice}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allSearchParams.push(p);
        }
      }
    }

    // 3. Fetch listings from Domain, upsert to DB
    const allListings: DomainListing[] = [];

    for (const params of allSearchParams) {
      try {
        const raw = await this.domain.searchListings({
          suburb: params.suburb,
          state: params.state,
          postcode: params.postcode,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          minBedrooms: params.minBedrooms,
          propertyTypes: params.propertyTypes,
          pageSize: 50,
        });

        const response = raw as DomainSearchResponse;
        const listings = response.listings ?? [];
        allListings.push(...listings);
      } catch (err) {
        console.error(
          `[DomainSyncEngine] Domain API error for ${params.suburb}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    result.listingsFound = allListings.length;

    if (allListings.length === 0) {
      return result;
    }

    // 4. Upsert into `properties`
    for (const listing of allListings) {
      const domainId = String(listing.id ?? listing.listingId ?? '');
      if (!domainId) continue;

      const address = listing.addressParts ?? {};
      const pricing = listing.priceDetails ?? {};
      const price = pricing.price ?? pricing.priceFrom ?? null;

      const propertyRow = {
        domain_listing_id: domainId,
        assigned_agent_id: agentId,
        address_street_number: address.streetNumber ?? '',
        address_street: address.street ?? '',
        address_suburb: address.suburb ?? '',
        address_state: address.state ?? '',
        address_postcode: address.postCode ?? '',
        address_country: 'Australia',
        property_type: this.mapPropertyType(listing.propertyTypes?.[0]),
        bedrooms: listing.bedrooms ?? 0,
        bathrooms: listing.bathrooms ?? 0,
        car_spaces: listing.carspaces ?? 0,
        land_size: listing.landAreaSqm ?? null,
        list_price: price,
        price_guide: price ? null : (listing.headline ?? null),
        listing_status: 'for-sale',
        sale_type: listing.saleMode === 'auction' ? 'auction' : 'private-treaty',
        auction_date: listing.auctionSchedule?.time ?? null,
        listing_description: listing.description ?? null,
        photos: JSON.stringify([]),
        floor_plans: JSON.stringify([]),
        interested_buyer_ids: JSON.stringify([]),
        comparables: JSON.stringify([]),
        portal_views: 0,
        enquiry_count: 0,
        inspection_count: 0,
        is_deleted: false,
      };

      const { error: upsertError } = await supabase
        .from('properties')
        .upsert(propertyRow, { onConflict: 'domain_listing_id' });

      if (upsertError) {
        console.error(
          `[DomainSyncEngine] Upsert error for listing ${domainId}:`,
          upsertError.message,
        );
        continue;
      }

      result.listingsImported++;

      // 5. Create property_matches for relevant briefs
      const { data: insertedProperty } = await supabase
        .from('properties')
        .select('id')
        .eq('domain_listing_id', domainId)
        .single();

      if (!insertedProperty) continue;

      const propertyId = (insertedProperty as { id: string }).id;

      for (const brief of briefs as ClientBriefRow[]) {
        const { error: matchError } = await supabase
          .from('property_matches')
          .upsert(
            {
              property_id: propertyId,
              brief_id: brief.id,
              status: 'new',
              overall_score: 0,
              score_breakdown: JSON.stringify({}),
              flags: JSON.stringify([]),
              is_deleted: false,
            },
            { onConflict: 'property_id,brief_id' },
          );

        if (!matchError) {
          result.matchesTriggered++;
        }
      }
    }

    return result;
  }

  // ─── detectPriceChanges ────────────────────────────────────────────────────

  /**
   * For each property owned by the agent that has a domain_listing_id,
   * re-fetch current price from Domain and persist any changes to
   * `property_price_changes`. Returns the newly inserted records.
   */
  async detectPriceChanges(
    agentId: string,
    supabase: SupabaseClient,
  ): Promise<PriceChange[]> {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('id, domain_listing_id, list_price')
      .eq('assigned_agent_id', agentId)
      .eq('is_deleted', false)
      .not('domain_listing_id', 'is', null);

    if (error) {
      console.error('[DomainSyncEngine] Failed to fetch properties:', error.message);
      return [];
    }

    if (!properties || properties.length === 0) {
      return [];
    }

    const changes: PriceChange[] = [];

    for (const property of properties as Array<{
      id: string;
      domain_listing_id: string;
      list_price: number | null;
    }>) {
      try {
        const raw = await this.domain.getListing(property.domain_listing_id);
        const listing = raw as DomainListing & { priceDetails?: DomainListingPricing };

        const pricing = listing.priceDetails ?? {};
        const currentPrice = pricing.price ?? pricing.priceFrom ?? null;

        if (currentPrice === null) continue;

        const previousPrice = property.list_price;

        // No prior price — treat as price guide being set
        if (previousPrice === null) {
          const { data: inserted, error: insertError } = await supabase
            .from('property_price_changes')
            .insert({
              property_id: property.id,
              domain_listing_id: property.domain_listing_id,
              previous_price: null,
              new_price: currentPrice,
              change_percent: null,
              change_type: 'price_guide_set',
              notified_agent_ids: [],
            })
            .select()
            .single();

          if (!insertError && inserted) {
            changes.push(this.mapPriceChangeRow(inserted));
          }
          continue;
        }

        if (currentPrice === previousPrice) continue;

        const changePercent =
          Math.round(((currentPrice - previousPrice) / previousPrice) * 10000) / 100;
        const changeType = currentPrice < previousPrice ? 'reduction' : 'increase';

        // Update stored price
        await supabase
          .from('properties')
          .update({ list_price: currentPrice })
          .eq('id', property.id);

        const { data: inserted, error: insertError } = await supabase
          .from('property_price_changes')
          .insert({
            property_id: property.id,
            domain_listing_id: property.domain_listing_id,
            previous_price: previousPrice,
            new_price: currentPrice,
            change_percent: changePercent,
            change_type: changeType,
            notified_agent_ids: [],
          })
          .select()
          .single();

        if (!insertError && inserted) {
          changes.push(this.mapPriceChangeRow(inserted));
        }
      } catch (err) {
        console.error(
          `[DomainSyncEngine] Price check error for listing ${property.domain_listing_id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return changes;
  }

  // ─── ingestAuctionResults ──────────────────────────────────────────────────

  /**
   * Pull recent sales/auction results from Domain for the given suburbs,
   * upsert into `auction_results`, and return the persisted records.
   */
  async ingestAuctionResults(
    suburbs: string[],
    supabase: SupabaseClient,
  ): Promise<AuctionResult[]> {
    if (suburbs.length === 0) return [];

    const allResults: AuctionResult[] = [];

    for (const suburb of suburbs) {
      try {
        const raw = await this.domain.getSalesResults(suburb, 'NSW');
        const response = raw as DomainSalesResponse;
        const salesResults: DomainSalesResult[] = response.salesResults ?? response.results ?? [];

        for (const sale of salesResults) {
          const auctionDate = sale.auctionDate
            ? sale.auctionDate.substring(0, 10)
            : new Date().toISOString().substring(0, 10);

          const result = this.mapAuctionResult(sale.result);

          const { data: inserted, error: upsertError } = await supabase
            .from('auction_results')
            .upsert(
              {
                domain_listing_id: sale.domainListingId
                  ? String(sale.domainListingId)
                  : null,
                suburb: sale.suburb ?? suburb,
                postcode: sale.postcode ?? null,
                state: sale.state ?? 'NSW',
                auction_date: auctionDate,
                result,
                sold_price: sale.soldPrice ?? null,
                reserve_price: sale.reservePrice ?? null,
                registered_bidders: sale.registeredBidders ?? null,
                agent_name: sale.agentName ?? null,
                agency_name: sale.agencyName ?? null,
                raw_data: JSON.stringify(sale),
              },
              { onConflict: 'domain_listing_id,auction_date', ignoreDuplicates: true },
            )
            .select()
            .single();

          if (!upsertError && inserted) {
            allResults.push(this.mapAuctionResultRow(inserted));
          }
        }
      } catch (err) {
        console.error(
          `[DomainSyncEngine] Auction results error for ${suburb}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return allResults;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private mapPropertyType(domainType?: string): string {
    const map: Record<string, string> = {
      House: 'house',
      Townhouse: 'townhouse',
      Apartment: 'apartment',
      Unit: 'unit',
      Villa: 'villa',
      Land: 'land',
      Rural: 'rural',
      'Semi-Detached': 'semi-detached',
      Terrace: 'terrace',
    };
    return map[domainType ?? ''] ?? 'house';
  }

  private mapAuctionResult(
    raw?: string,
  ): 'sold' | 'passed_in' | 'withdrawn' | 'sold_prior' {
    const lower = (raw ?? '').toLowerCase();
    if (lower.includes('sold_prior') || lower.includes('sold prior')) return 'sold_prior';
    if (lower.includes('sold')) return 'sold';
    if (lower.includes('passed') || lower.includes('no_sale')) return 'passed_in';
    if (lower.includes('withdrawn')) return 'withdrawn';
    return 'passed_in';
  }

  private mapPriceChangeRow(row: Record<string, unknown>): PriceChange {
    return {
      id: String(row['id']),
      propertyId: row['property_id'] ? String(row['property_id']) : null,
      domainListingId: String(row['domain_listing_id']),
      previousPrice: row['previous_price'] ? Number(row['previous_price']) : null,
      newPrice: Number(row['new_price']),
      changePercent: row['change_percent'] ? Number(row['change_percent']) : 0,
      changeType: row['change_type'] as PriceChange['changeType'],
      notifiedAgentIds: (row['notified_agent_ids'] as string[]) ?? [],
      detectedAt: String(row['detected_at']),
    };
  }

  private mapAuctionResultRow(row: Record<string, unknown>): AuctionResult {
    return {
      id: String(row['id']),
      propertyId: row['property_id'] ? String(row['property_id']) : null,
      domainListingId: row['domain_listing_id'] ? String(row['domain_listing_id']) : null,
      suburb: String(row['suburb']),
      postcode: row['postcode'] ? String(row['postcode']) : null,
      state: row['state'] ? String(row['state']) : null,
      auctionDate: String(row['auction_date']),
      result: row['result'] as AuctionResult['result'],
      soldPrice: row['sold_price'] ? Number(row['sold_price']) : null,
      reservePrice: row['reserve_price'] ? Number(row['reserve_price']) : null,
      registeredBidders: row['registered_bidders'] ? Number(row['registered_bidders']) : null,
      agentName: row['agent_name'] ? String(row['agent_name']) : null,
      agencyName: row['agency_name'] ? String(row['agency_name']) : null,
      createdAt: String(row['created_at']),
    };
  }
}
