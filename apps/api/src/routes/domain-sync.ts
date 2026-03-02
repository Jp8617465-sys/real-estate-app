import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DomainSyncEngine } from '@realflow/business-logic';
import { DomainClient } from '@realflow/integrations';
import { CreateDomainSyncJobSchema } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

// ─── Shared engine instance ──────────────────────────────────────────────────

const engine = new DomainSyncEngine();

// ─── Domain search query schema ──────────────────────────────────────────────

const ListingsQuerySchema = z.object({
  suburb: z.string().min(1),
  state: z.string().default('NSW'),
  postcode: z.string().default(''),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
  pageNumber: z.coerce.number().int().positive().default(1),
});

const PriceChangesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const AuctionResultsQuerySchema = z.object({
  suburb: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function domainSyncRoutes(fastify: FastifyInstance) {
  // ─── GET /status ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/domain/status
   * Returns the current Domain integration status for the authenticated agent.
   */
  fastify.get('/status', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const agentId = user.id;

    // Last completed sync job
    const { data: lastJob } = await supabase
      .from('domain_sync_jobs')
      .select('completed_at, listings_imported')
      .eq('agent_id', agentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Price changes in last 24 hours
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: priceChanges24h } = await supabase
      .from('property_price_changes')
      .select('id', { count: 'exact', head: true })
      .gte('detected_at', since24h);

    // Auction results in last 7 days
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const { count: auctionResults7d } = await supabase
      .from('auction_results')
      .select('id', { count: 'exact', head: true })
      .gte('auction_date', since7d);

    // Next scheduled sync: check agent settings (use null if not configured)
    const { data: settings } = await supabase
      .from('agent_settings')
      .select('domain_sync_frequency')
      .eq('agent_id', agentId)
      .maybeSingle();

    const typedSettings = settings as { domain_sync_frequency?: string } | null;
    const connected =
      Boolean(process.env['DOMAIN_CLIENT_ID']) &&
      Boolean(process.env['DOMAIN_CLIENT_SECRET']);

    const data = {
      connected,
      lastSync: (lastJob as { completed_at?: string } | null)?.completed_at ?? null,
      listingsSynced: (lastJob as { listings_imported?: number } | null)?.listings_imported ?? 0,
      priceChanges24h: priceChanges24h ?? 0,
      auctionResults7d: auctionResults7d ?? 0,
      nextScheduledSync: typedSettings?.domain_sync_frequency
        ? computeNextSync(typedSettings.domain_sync_frequency)
        : null,
    };

    return { data };
  });

  // ─── POST /sync ─────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/domain/sync
   * Trigger a manual listing sync job for the authenticated agent.
   * Inserts a job row immediately, runs the sync, then updates the row.
   */
  fastify.post('/sync', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const agentId = user.id;

    // Parse body (syncType defaults to 'manual')
    const bodyParse = CreateDomainSyncJobSchema.safeParse(request.body ?? {});
    const syncType = bodyParse.success ? bodyParse.data.syncType : 'manual';

    // Insert the sync job row in 'running' state
    const { data: jobRow, error: jobError } = await supabase
      .from('domain_sync_jobs')
      .insert({
        agent_id: agentId,
        status: 'running',
        sync_type: syncType,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (jobError || !jobRow) {
      return reply.status(500).send({ error: 'Failed to create sync job' });
    }

    const jobId = (jobRow as { id: string }).id;

    // Run sync asynchronously — respond immediately then update the job
    setImmediate(async () => {
      try {
        const syncResult = await engine.syncListingsForAgent(agentId, supabase);

        await supabase
          .from('domain_sync_jobs')
          .update({
            status: 'completed',
            listings_found: syncResult.listingsFound,
            listings_imported: syncResult.listingsImported,
            matches_triggered: syncResult.matchesTriggered,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        fastify.log.error(`[domain/sync] Job ${jobId} failed: ${message}`);

        await supabase
          .from('domain_sync_jobs')
          .update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }
    });

    return reply.status(202).send({ data: { jobId, status: 'running' } });
  });

  // ─── GET /listings ──────────────────────────────────────────────────────────

  /**
   * GET /api/v1/domain/listings
   * Proxy to Domain.com.au residential listing search.
   * Query params: suburb, state, postcode, minPrice, maxPrice, bedrooms, pageSize, pageNumber
   */
  fastify.get('/listings', async (request, reply) => {
    const parse = ListingsQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parse.error.flatten().fieldErrors,
      });
    }

    const { suburb, state, postcode, minPrice, maxPrice, bedrooms, pageSize, pageNumber } =
      parse.data;

    const domainClient = new DomainClient({
      clientId: process.env['DOMAIN_CLIENT_ID'] ?? '',
      clientSecret: process.env['DOMAIN_CLIENT_SECRET'] ?? '',
    });

    try {
      const listings = await domainClient.searchListings({
        suburb,
        state,
        postcode,
        minPrice,
        maxPrice,
        minBedrooms: bedrooms,
        pageSize,
        pageNumber,
      });

      return { data: listings };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      fastify.log.error(`[domain/listings] Search error: ${message}`);
      return reply.status(502).send({ error: 'Domain API unavailable', detail: message });
    }
  });

  // ─── GET /listings/:domainId/match ──────────────────────────────────────────

  /**
   * GET /api/v1/domain/listings/:domainId/match
   * Retrieve a specific Domain listing and return property match scores
   * against the authenticated agent's active client briefs.
   */
  fastify.get<{ Params: { domainId: string } }>(
    '/listings/:domainId/match',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { domainId } = request.params;

      const domainClient = new DomainClient({
        clientId: process.env['DOMAIN_CLIENT_ID'] ?? '',
        clientSecret: process.env['DOMAIN_CLIENT_SECRET'] ?? '',
      });

      let listing: unknown;
      try {
        listing = await domainClient.getListing(domainId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(502).send({ error: 'Domain API unavailable', detail: message });
      }

      // Fetch property_matches for this domain listing if it exists in DB
      const { data: property } = await supabase
        .from('properties')
        .select('id')
        .eq('domain_listing_id', domainId)
        .eq('is_deleted', false)
        .maybeSingle();

      let matches: unknown[] = [];
      if (property) {
        const { data: matchRows } = await supabase
          .from('property_matches')
          .select(
            'id, brief_id, status, overall_score, score_breakdown, flags, created_at',
          )
          .eq('property_id', (property as { id: string }).id)
          .eq('is_deleted', false)
          .order('overall_score', { ascending: false });

        matches = matchRows ?? [];
      }

      return { data: { listing, matches } };
    },
  );

  // ─── POST /webhooks ─────────────────────────────────────────────────────────

  /**
   * POST /api/v1/domain/webhooks
   * Receives Domain.com.au webhook events.
   * Validates HMAC-SHA256 signature from x-domain-signature header.
   * Returns 200 immediately; processing is async.
   */
  fastify.post('/webhooks', async (request, reply) => {
    const signature = request.headers['x-domain-signature'];
    const secret = process.env['DOMAIN_WEBHOOK_SECRET'] ?? '';

    if (!signature || typeof signature !== 'string') {
      return reply.status(401).send({ error: 'Missing signature' });
    }

    // Compute expected HMAC-SHA256 over the raw body
    const rawBody = JSON.stringify(request.body);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    const isValid =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // Process asynchronously — do not block the response
    setImmediate(async () => {
      try {
        const event = request.body as { type?: string; listingId?: string };
        fastify.log.info(`[domain/webhook] Received event type=${event.type ?? 'unknown'}`);

        if (event.type === 'listing.priceUpdated' && event.listingId) {
          // Price update webhook — re-run price change detection can be targeted
          fastify.log.info(
            `[domain/webhook] Price update for listing ${event.listingId}`,
          );
        }
      } catch (err) {
        fastify.log.error(
          `[domain/webhook] Processing error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    return reply.status(200).send({ received: true });
  });

  // ─── GET /price-changes ─────────────────────────────────────────────────────

  /**
   * GET /api/v1/domain/price-changes
   * Returns recent price changes visible to the authenticated agent.
   * Query params: limit (default 20), offset (default 0)
   */
  fastify.get('/price-changes', async (request, reply) => {
    const parse = PriceChangesQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const { limit, offset } = parse.data;

    const supabase = createSupabaseClient(request);

    const { data, error, count } = await supabase
      .from('property_price_changes')
      .select(
        `id,
         property_id,
         domain_listing_id,
         previous_price,
         new_price,
         change_percent,
         change_type,
         notified_agent_ids,
         detected_at,
         properties (
           id,
           address_street_number,
           address_street,
           address_suburb,
           address_state,
           address_postcode
         )`,
        { count: 'exact' },
      )
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      fastify.log.error(`[domain/price-changes] Query error: ${error.message}`);
      return reply.status(500).send({ error: 'Failed to fetch price changes' });
    }

    return { data, total: count ?? 0, limit, offset };
  });

  // ─── GET /auction-results ───────────────────────────────────────────────────

  /**
   * GET /api/v1/domain/auction-results
   * Returns auction results filtered by suburb, date range.
   * Query params: suburb?, from?, to?, limit (default 20), offset (default 0)
   */
  fastify.get('/auction-results', async (request, reply) => {
    const parse = AuctionResultsQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const { suburb, from, to, limit, offset } = parse.data;

    const supabase = createSupabaseClient(request);

    let query = supabase
      .from('auction_results')
      .select(
        `id,
         property_id,
         domain_listing_id,
         suburb,
         postcode,
         state,
         auction_date,
         result,
         sold_price,
         reserve_price,
         registered_bidders,
         agent_name,
         agency_name,
         created_at`,
        { count: 'exact' },
      )
      .order('auction_date', { ascending: false });

    if (suburb) {
      query = query.ilike('suburb', `%${suburb}%`);
    }
    if (from) {
      query = query.gte('auction_date', from);
    }
    if (to) {
      query = query.lte('auction_date', to);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      fastify.log.error(`[domain/auction-results] Query error: ${error.message}`);
      return reply.status(500).send({ error: 'Failed to fetch auction results' });
    }

    return { data, total: count ?? 0, limit, offset };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute an approximate next sync datetime based on the stored frequency string.
 * Supported values: 'nightly', 'every_4_hours', 'manual'
 */
function computeNextSync(frequency: string): string | null {
  const now = new Date();

  if (frequency === 'nightly') {
    // Next midnight AEST (UTC+10)
    const next = new Date(now);
    next.setUTCHours(14, 0, 0, 0); // 14:00 UTC = midnight AEST
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }

  if (frequency === 'every_4_hours') {
    const next = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    return next.toISOString();
  }

  return null;
}
