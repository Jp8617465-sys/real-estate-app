import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSupabaseClient, createSupabaseServiceClient } from '../middleware/supabase';
import { MarketDataService, SuburbQuerySchema } from '../services/market-data-service';

// ─── Request Schemas ────────────────────────────────────────────────

const SuburbParamSchema = z.object({
  suburb: z.string().min(1),
});

const SuburbIdParamSchema = z.object({
  suburbId: z.string().min(1),
});

const SuburbQueryParamsSchema = z.object({
  state: z.string().min(1).default('NSW'),
  propertyType: z.enum(['house', 'unit']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(24),
});

const RefreshBodySchema = z.object({
  suburbs: z.array(SuburbQuerySchema).min(1).max(50),
});

// ─── Routes ─────────────────────────────────────────────────────────

export async function marketDataRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/market-data/:suburb
   * Get the latest market data for a suburb.
   * Query params: state (default NSW), propertyType (optional)
   */
  fastify.get<{
    Params: { suburb: string };
    Querystring: { state?: string; propertyType?: string };
  }>('/:suburb', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const paramParse = SuburbParamSchema.safeParse(request.params);
    if (!paramParse.success) {
      return reply.status(400).send({ error: 'Invalid suburb parameter' });
    }

    const queryParse = SuburbQueryParamsSchema.safeParse(request.query);
    if (!queryParse.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: queryParse.error.flatten().fieldErrors,
      });
    }

    const { suburb } = paramParse.data;
    const { state, propertyType } = queryParse.data;

    const service = new MarketDataService(supabase);
    const snapshot = await service.getLatestSnapshot(suburb, state, propertyType);

    if (!snapshot) {
      return reply.status(404).send({ error: 'No market data found for this suburb' });
    }

    return { data: snapshot };
  });

  /**
   * GET /api/market-data/snapshot/:suburbId
   * Get historical snapshots for a suburb.
   * suburbId format: "suburb-state" e.g. "mosman-nsw"
   * Query params: propertyType (optional), limit (default 24)
   */
  fastify.get<{
    Params: { suburbId: string };
    Querystring: { propertyType?: string; limit?: number };
  }>('/snapshot/:suburbId', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const paramParse = SuburbIdParamSchema.safeParse(request.params);
    if (!paramParse.success) {
      return reply.status(400).send({ error: 'Invalid suburbId parameter' });
    }

    const { suburbId } = paramParse.data;

    // Parse suburbId format: "suburb-state" e.g. "mosman-nsw"
    const lastDash = suburbId.lastIndexOf('-');
    if (lastDash <= 0) {
      return reply.status(400).send({
        error: 'suburbId must be in "suburb-state" format, e.g. "mosman-nsw"',
      });
    }

    const suburb = suburbId.substring(0, lastDash);
    const state = suburbId.substring(lastDash + 1).toUpperCase();

    const queryParse = SuburbQueryParamsSchema.safeParse(request.query);
    if (!queryParse.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: queryParse.error.flatten().fieldErrors,
      });
    }

    const { propertyType, limit } = queryParse.data;

    const service = new MarketDataService(supabase);
    const snapshots = await service.getHistoricalSnapshots(suburb, state, {
      propertyType,
      limit,
    });

    return { data: snapshots, total: snapshots.length };
  });

  /**
   * POST /api/market-data/refresh
   * Trigger a refresh for specific suburbs (admin only).
   * Body: { suburbs: [{ suburb, state, postcode, propertyType }] }
   */
  fastify.post('/refresh', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const bodyParse = RefreshBodySchema.safeParse(request.body);
    if (!bodyParse.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: bodyParse.error.flatten().fieldErrors,
      });
    }

    // Use service-role client to bypass RLS for writes to market_snapshots
    const serviceSupabase = createSupabaseServiceClient();
    const service = new MarketDataService(serviceSupabase);

    const result = await service.bulkFetchAndUpsert(bodyParse.data.suburbs, {
      delayMs: 500,
    });

    fastify.log.info(
      `[market-data/refresh] Refreshed ${result.succeeded}/${result.total} suburbs for user ${user.id}`,
    );

    return { data: result };
  });

  /**
   * POST /api/market-data/bulk-refresh
   * Refresh data for all active search suburbs.
   * Identifies suburbs from client briefs and pipeline properties.
   * Uses service-role client for writes.
   */
  fastify.post('/bulk-refresh', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Use service-role client for the actual data refresh
    const serviceSupabase = createSupabaseServiceClient();
    const service = new MarketDataService(serviceSupabase);

    const activeSuburbs = await service.getActiveSuburbs();

    if (activeSuburbs.length === 0) {
      return { data: { total: 0, succeeded: 0, failed: 0, results: [] } };
    }

    // Also fetch unit data by duplicating queries with unit propertyType
    const allQueries = [
      ...activeSuburbs,
      ...activeSuburbs.map((q) => ({ ...q, propertyType: 'unit' as const })),
    ];

    const result = await service.bulkFetchAndUpsert(allQueries, {
      delayMs: 500,
    });

    fastify.log.info(
      `[market-data/bulk-refresh] Refreshed ${result.succeeded}/${result.total} suburb+type combos for user ${user.id}`,
    );

    return { data: result };
  });
}
