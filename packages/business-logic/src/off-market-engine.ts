import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OffMarketProperty,
  OffMarketMatch,
  OffMarketStats,
  CreateOffMarketProperty,
  UpdateOffMarketProperty,
} from '@realflow/shared';

// ─── Internal DB Row Shapes ───────────────────────────────────────────────────

interface OffMarketPropertyRow {
  id: string;
  agent_id: string;
  office_id: string;
  address_line1: string;
  suburb: string;
  state: string;
  postcode: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  car_spaces: number | null;
  land_size_sqm: number | null;
  asking_price: number | null;
  source: string;
  source_name: string | null;
  agent_notes: string | null;
  visibility: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface OffMarketMatchRow {
  id: string;
  off_market_id: string;
  client_brief_id: string;
  match_score: number;
  status: string;
  sent_to_client_at: string | null;
  created_at: string;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapProperty(row: OffMarketPropertyRow): OffMarketProperty {
  return {
    id: row.id,
    agentId: row.agent_id,
    officeId: row.office_id,
    addressLine1: row.address_line1,
    suburb: row.suburb,
    state: row.state as OffMarketProperty['state'],
    postcode: row.postcode,
    propertyType: row.property_type as OffMarketProperty['propertyType'],
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    carSpaces: row.car_spaces,
    landSizeSqm: row.land_size_sqm,
    askingPrice: row.asking_price,
    source: row.source as OffMarketProperty['source'],
    sourceName: row.source_name,
    agentNotes: row.agent_notes,
    visibility: row.visibility as OffMarketProperty['visibility'],
    status: row.status as OffMarketProperty['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapMatch(row: OffMarketMatchRow): OffMarketMatch {
  return {
    id: row.id,
    offMarketId: row.off_market_id,
    clientBriefId: row.client_brief_id,
    matchScore: row.match_score,
    status: row.status as OffMarketMatch['status'],
    sentToClientAt: row.sent_to_client_at,
    createdAt: row.created_at,
  };
}

// ─── Scoring Helper ───────────────────────────────────────────────────────────

interface BriefForScoring {
  id: string;
  requirements: {
    locations?: { suburbs?: string[] };
    bedrooms?: { min?: number; max?: number };
    bathrooms?: { min?: number };
    budget?: { max?: number; min?: number };
    propertyTypes?: string[];
  };
}

function scoreOffMarketAgainstBrief(
  property: OffMarketProperty,
  brief: BriefForScoring,
): number {
  const r = brief.requirements;
  let score = 0;
  let totalWeight = 0;

  // Price match (30 points)
  if (property.askingPrice && r.budget) {
    totalWeight += 30;
    if (r.budget.max && property.askingPrice <= r.budget.max) {
      const pctOver = Math.max(0, (property.askingPrice - (r.budget.min ?? 0)) / r.budget.max);
      score += 30 * (1 - pctOver * 0.5);
    }
  }

  // Location match (25 points)
  if (r.locations?.suburbs && r.locations.suburbs.length > 0) {
    totalWeight += 25;
    const match = r.locations.suburbs.some(
      s => s.toLowerCase() === property.suburb.toLowerCase(),
    );
    if (match) score += 25;
  }

  // Size match — bedrooms (20 points)
  if (r.bedrooms) {
    totalWeight += 20;
    const beds = property.bedrooms ?? 0;
    const min = r.bedrooms.min ?? 0;
    const max = r.bedrooms.max ?? 99;
    if (beds >= min && beds <= max) score += 20;
    else if (beds === min - 1) score += 10;
  }

  // Property type match (15 points)
  if (r.propertyTypes && r.propertyTypes.length > 0) {
    totalWeight += 15;
    if (r.propertyTypes.includes(property.propertyType)) score += 15;
  }

  // Bathroom match (10 points)
  if (r.bathrooms?.min !== undefined && property.bathrooms !== null) {
    totalWeight += 10;
    if (property.bathrooms >= r.bathrooms.min) score += 10;
  }

  if (totalWeight === 0) return 50; // no criteria → neutral score
  return Math.round((score / totalWeight) * 100);
}

// ─── Off-Market Engine ────────────────────────────────────────────────────────

export class OffMarketEngine {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Create a new off-market property and immediately match it against
   * the agent's active client briefs.
   */
  async create(
    data: CreateOffMarketProperty,
    agentId: string,
    officeId: string,
  ): Promise<{ property: OffMarketProperty; matches: OffMarketMatch[] }> {
    const { data: row, error } = await this.db
      .from('off_market_properties')
      .insert({
        agent_id: agentId,
        office_id: officeId,
        address_line1: data.addressLine1,
        suburb: data.suburb,
        state: data.state,
        postcode: data.postcode,
        property_type: data.propertyType,
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        car_spaces: data.carSpaces ?? null,
        land_size_sqm: data.landSizeSqm ?? null,
        asking_price: data.askingPrice ?? null,
        source: data.source,
        source_name: data.sourceName ?? null,
        agent_notes: data.agentNotes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create off-market property: ${error.message}`);

    const property = mapProperty(row as OffMarketPropertyRow);
    const matches = await this.matchAgainstBriefs(property.id, agentId);
    return { property, matches };
  }

  /**
   * Update an existing off-market property.
   */
  async update(
    propertyId: string,
    data: UpdateOffMarketProperty,
    agentId: string,
  ): Promise<OffMarketProperty> {
    const updatePayload: Record<string, unknown> = {};
    if (data.addressLine1 !== undefined) updatePayload.address_line1 = data.addressLine1;
    if (data.suburb !== undefined) updatePayload.suburb = data.suburb;
    if (data.state !== undefined) updatePayload.state = data.state;
    if (data.postcode !== undefined) updatePayload.postcode = data.postcode;
    if (data.propertyType !== undefined) updatePayload.property_type = data.propertyType;
    if (data.bedrooms !== undefined) updatePayload.bedrooms = data.bedrooms;
    if (data.bathrooms !== undefined) updatePayload.bathrooms = data.bathrooms;
    if (data.carSpaces !== undefined) updatePayload.car_spaces = data.carSpaces;
    if (data.landSizeSqm !== undefined) updatePayload.land_size_sqm = data.landSizeSqm;
    if (data.askingPrice !== undefined) updatePayload.asking_price = data.askingPrice;
    if (data.source !== undefined) updatePayload.source = data.source;
    if (data.sourceName !== undefined) updatePayload.source_name = data.sourceName;
    if (data.agentNotes !== undefined) updatePayload.agent_notes = data.agentNotes;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.visibility !== undefined) updatePayload.visibility = data.visibility;
    updatePayload.updated_at = new Date().toISOString();

    const { data: row, error } = await this.db
      .from('off_market_properties')
      .update(updatePayload)
      .eq('id', propertyId)
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`Failed to update off-market property: ${error.message}`);
    return mapProperty(row as OffMarketPropertyRow);
  }

  /**
   * Soft-delete an off-market property.
   */
  async softDelete(propertyId: string, agentId: string): Promise<void> {
    const { error } = await this.db
      .from('off_market_properties')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', propertyId)
      .eq('agent_id', agentId)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete off-market property: ${error.message}`);
  }

  /**
   * Match an off-market property against all active client briefs for the agent.
   * Upserts match records; returns matches with score >= threshold.
   */
  async matchAgainstBriefs(
    propertyId: string,
    agentId: string,
    threshold = 30,
  ): Promise<OffMarketMatch[]> {
    // Fetch the property
    const { data: propRow, error: propErr } = await this.db
      .from('off_market_properties')
      .select('*')
      .eq('id', propertyId)
      .single();
    if (propErr) throw new Error(`Property not found: ${propErr.message}`);
    const property = mapProperty(propRow as OffMarketPropertyRow);

    // Fetch active briefs for this agent
    const { data: briefs, error: briefErr } = await this.db
      .from('client_briefs')
      .select('id, requirements')
      .eq('is_deleted', false)
      .not('requirements', 'is', null);

    if (briefErr) throw new Error(`Failed to fetch briefs: ${briefErr.message}`);

    const scoredMatches = (briefs as BriefForScoring[])
      .map(brief => ({
        brief,
        score: scoreOffMarketAgainstBrief(property, brief),
      }))
      .filter(m => m.score >= threshold);

    if (scoredMatches.length === 0) return [];

    // Upsert match records
    const inserts = scoredMatches.map(m => ({
      off_market_id: propertyId,
      client_brief_id: m.brief.id,
      match_score: m.score,
      status: 'new',
    }));

    const { data: matchRows, error: matchErr } = await this.db
      .from('off_market_matches')
      .upsert(inserts, { onConflict: 'off_market_id,client_brief_id', ignoreDuplicates: false })
      .select();

    if (matchErr) throw new Error(`Failed to save matches: ${matchErr.message}`);
    return (matchRows as OffMarketMatchRow[]).map(mapMatch);
  }

  /**
   * Promote a match to portal visibility. The client will see this property in their portal.
   */
  async sendToClient(offMarketId: string, clientBriefId: string): Promise<OffMarketMatch> {
    const now = new Date().toISOString();

    const { data, error } = await this.db
      .from('off_market_matches')
      .update({ status: 'sent_to_client', sent_to_client_at: now })
      .eq('off_market_id', offMarketId)
      .eq('client_brief_id', clientBriefId)
      .select()
      .single();

    if (error) throw new Error(`Failed to send to client: ${error.message}`);

    // Also update property visibility
    await this.db
      .from('off_market_properties')
      .update({ visibility: 'sent_to_client' })
      .eq('id', offMarketId);

    return mapMatch(data as OffMarketMatchRow);
  }

  /**
   * Retract a match from portal visibility.
   */
  async retractFromClient(offMarketId: string, clientBriefId: string): Promise<OffMarketMatch> {
    const { data, error } = await this.db
      .from('off_market_matches')
      .update({ status: 'new', sent_to_client_at: null })
      .eq('off_market_id', offMarketId)
      .eq('client_brief_id', clientBriefId)
      .select()
      .single();

    if (error) throw new Error(`Failed to retract from client: ${error.message}`);

    // Check if any other matches are still sent_to_client
    const { data: remaining } = await this.db
      .from('off_market_matches')
      .select('id')
      .eq('off_market_id', offMarketId)
      .eq('status', 'sent_to_client');

    if (!remaining || remaining.length === 0) {
      await this.db
        .from('off_market_properties')
        .update({ visibility: 'agent_only' })
        .eq('id', offMarketId);
    }

    return mapMatch(data as OffMarketMatchRow);
  }

  /**
   * Get matches for a specific off-market property.
   */
  async getMatches(propertyId: string): Promise<OffMarketMatch[]> {
    const { data, error } = await this.db
      .from('off_market_matches')
      .select('*')
      .eq('off_market_id', propertyId)
      .order('match_score', { ascending: false });

    if (error) throw new Error(`Failed to get matches: ${error.message}`);
    return (data as OffMarketMatchRow[]).map(mapMatch);
  }

  /**
   * List off-market properties for an agent.
   */
  async list(
    agentId: string,
    options?: { status?: OffMarketProperty['status']; limit?: number; offset?: number },
  ): Promise<OffMarketProperty[]> {
    let query = this.db
      .from('off_market_properties')
      .select('*')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 50);

    if (options?.status) query = query.eq('status', options.status);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list off-market properties: ${error.message}`);
    return (data as OffMarketPropertyRow[]).map(mapProperty);
  }

  /**
   * Get a single off-market property by ID.
   */
  async getById(propertyId: string): Promise<OffMarketProperty> {
    const { data, error } = await this.db
      .from('off_market_properties')
      .select('*')
      .eq('id', propertyId)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(`Off-market property not found: ${error.message}`);
    return mapProperty(data as OffMarketPropertyRow);
  }

  /**
   * Get off-market vs on-market success rate statistics for an agent.
   */
  async getSuccessStats(agentId: string): Promise<OffMarketStats> {
    const { data: offMarket, error: omErr } = await this.db
      .from('off_market_properties')
      .select('status')
      .eq('agent_id', agentId)
      .is('deleted_at', null);

    if (omErr) throw new Error(`Failed to get off-market stats: ${omErr.message}`);

    const offRows = offMarket as { status: string }[];
    const totalOffMarket = offRows.length;
    const offMarketClosed = offRows.filter(r => r.status === 'sold').length;

    // On-market = transactions with a property, excluding off-market
    const { data: onMarket, error: txErr } = await this.db
      .from('transactions')
      .select('current_stage')
      .eq('assigned_agent_id', agentId)
      .eq('is_deleted', false);

    if (txErr) throw new Error(`Failed to get on-market stats: ${txErr.message}`);

    const txRows = onMarket as { current_stage: string }[];
    const totalOnMarket = txRows.length;
    const onMarketClosed = txRows.filter(r => r.current_stage === 'settlement').length;

    return {
      totalOffMarket,
      totalOnMarket,
      offMarketClosed,
      onMarketClosed,
      offMarketSuccessRate:
        totalOffMarket > 0 ? Math.round((offMarketClosed / totalOffMarket) * 100) : 0,
      onMarketSuccessRate:
        totalOnMarket > 0 ? Math.round((onMarketClosed / totalOnMarket) * 100) : 0,
    };
  }
}
