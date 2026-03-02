import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AnalyticsPeriodSchema } from '@realflow/shared';
import { AnalyticsEngine } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

// ─── Query Schemas ─────────────────────────────────────────────────────────────

const PeriodQuerySchema = z.object({
  period: AnalyticsPeriodSchema.optional().default('30d'),
});

const PipelineVelocityQuerySchema = z.object({
  period: AnalyticsPeriodSchema.optional().default('30d'),
  pipelineType: z.enum(['buyer', 'seller', 'buyers_agent']).optional(),
});

const MarketInsightsQuerySchema = z.object({
  suburbs: z.string().min(1),
  propertyType: z.enum(['house', 'unit', 'townhouse']).optional(),
});

// ─── Helper: resolve authenticated user ID ────────────────────────────────────

async function resolveAgentId(
  supabase: ReturnType<typeof createSupabaseClient>,
): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function analyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/analytics/pipeline-velocity
   * Returns funnel stage data for the authenticated agent.
   * Query: period? (default '30d'), pipelineType?
   */
  fastify.get('/pipeline-velocity', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const agentId = await resolveAgentId(supabase);

    if (!agentId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = PipelineVelocityQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { pipelineType } = parsed.data;

    let velocity = await AnalyticsEngine.getPipelineVelocity(agentId, supabase);

    if (pipelineType) {
      velocity = velocity.filter((v) => v.pipelineType === pipelineType);
    }

    return { data: velocity };
  });

  /**
   * GET /api/v1/analytics/agent-performance
   * Returns KPI metrics for the authenticated agent over the given period.
   * Query: period? (default '30d')
   */
  fastify.get('/agent-performance', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const agentId = await resolveAgentId(supabase);

    if (!agentId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = PeriodQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const performance = await AnalyticsEngine.getAgentPerformance(
      agentId,
      parsed.data.period,
      supabase,
    );

    return { data: performance };
  });

  /**
   * GET /api/v1/analytics/market-insights
   * Returns market data for the requested suburbs.
   * Query: suburbs (comma-separated, required), propertyType?
   */
  fastify.get('/market-insights', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const agentId = await resolveAgentId(supabase);

    if (!agentId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = MarketInsightsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { suburbs: suburbsRaw, propertyType } = parsed.data;
    const suburbs = suburbsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (suburbs.length === 0) {
      return reply.status(400).send({ error: 'At least one suburb is required' });
    }

    let insights = await AnalyticsEngine.getMarketInsights(suburbs, supabase);

    if (propertyType) {
      insights = insights.filter((i) => i.propertyType === propertyType);
    }

    return { data: insights };
  });

  /**
   * GET /api/v1/analytics/revenue
   * Returns revenue forecast breakdown for the authenticated agent.
   * Query: period? (default '30d')
   */
  fastify.get('/revenue', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const agentId = await resolveAgentId(supabase);

    if (!agentId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = PeriodQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const forecast = await AnalyticsEngine.getRevenueForecast(
      agentId,
      parsed.data.period,
      supabase,
    );

    return { data: forecast };
  });

  /**
   * GET /api/v1/analytics/snapshot
   * Returns the full dashboard snapshot combining all analytics in a single call.
   * Target: <200ms — batches all sub-queries in parallel via getDashboardSnapshot.
   * Query: period? (default '30d')
   */
  fastify.get('/snapshot', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const agentId = await resolveAgentId(supabase);

    if (!agentId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = PeriodQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const snapshot = await AnalyticsEngine.getDashboardSnapshot(
      agentId,
      parsed.data.period,
      supabase,
    );

    return { data: snapshot };
  });
}
