import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';
import { fromDbSchema } from '@realflow/business-logic';
import {
  AIMessageDraftRequestSchema,
  AIEmailSignalsRequestSchema,
  AINarrativeRequestSchema,
} from '@realflow/shared';
import {
  getAIPropertyMatchingService,
  getAILeadScoringService,
  getAICacheStats,
  isAIEnabled,
  getAnthropicClientOrNull,
  checkAIRateLimit,
} from '../services/ai-service-factory';

/** Rejects unauthenticated requests before AI endpoints that don't do a DB lookup. */
function requireAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!request.headers.authorization?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * Extract the Supabase user ID (sub claim) from the Bearer JWT without a
 * full signature verification pass — Supabase has already validated the token.
 * Returns null if the token is malformed.
 */
function extractUserIdFromToken(request: FastifyRequest): string | null {
  const token = request.headers.authorization?.slice(7);
  if (!token) return null;
  try {
    const parts = token.split('.');
    const payloadB64 = parts[1];
    if (!payloadB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Enforce per-user AI rate limit (20 req/min).
 * Returns false and sends 429 if the limit is exceeded.
 */
function enforceAIRateLimit(request: FastifyRequest, reply: FastifyReply): boolean {
  const userId = extractUserIdFromToken(request) ?? request.ip;
  if (!checkAIRateLimit(userId)) {
    reply.status(429).send({ error: 'Too many AI requests. Please wait a moment before retrying.' });
    return false;
  }
  return true;
}

// Typed shapes for Supabase projection results
interface ContactProjection {
  first_name: string | null;
  last_name: string | null;
  source: string | null;
  pipeline_stage: string | null;
}
interface ActivityProjection {
  title: string | null;
}

export async function aiRoutes(fastify: FastifyInstance) {
  // ─── Status ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/ai/status
   * Returns whether AI is enabled and cache statistics.
   */
  fastify.get('/status', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    return { enabled: isAIEnabled(), cacheStats: getAICacheStats() };
  });

  // ─── Analyze Match ───────────────────────────────────────────────

  /**
   * POST /api/v1/ai/analyze-match
   * Score a property against a client brief with AI-enhanced feature analysis.
   * Degrades gracefully to rule-based scoring if AI is unavailable.
   *
   * Body: { propertyId: string; clientBriefId: string }
   */
  fastify.post<{
    Body: { propertyId: string; clientBriefId: string };
  }>('/analyze-match', async (request, reply) => {
    if (!enforceAIRateLimit(request, reply)) return;

    const { propertyId, clientBriefId } = request.body ?? {};

    if (!propertyId || !clientBriefId) {
      return reply.status(400).send({ error: 'propertyId and clientBriefId are required' });
    }

    const supabase = createSupabaseClient(request);

    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .eq('is_deleted', false)
      .single();

    if (propError || !property) {
      return reply.status(404).send({ error: 'Property not found' });
    }

    const { data: briefData, error: briefError } = await supabase
      .from('client_briefs')
      .select('*')
      .eq('id', clientBriefId)
      .eq('is_deleted', false)
      .single();

    if (briefError || !briefData) {
      return reply.status(404).send({ error: 'Client brief not found' });
    }

    const brief = fromDbSchema(briefData);
    const service = getAIPropertyMatchingService();
    const result = await service.scoreProperty(property, brief);

    return { data: result };
  });

  // ─── Score Lead ──────────────────────────────────────────────────

  /**
   * POST /api/v1/ai/score-lead
   * Calculate an AI-enhanced lead score for a contact.
   * Degrades gracefully to rule-based scoring without enquiry text or AI.
   *
   * Body: { contactId: string; enquiryText?: string }
   */
  fastify.post<{
    Body: { contactId: string; enquiryText?: string };
  }>('/score-lead', async (request, reply) => {
    if (!enforceAIRateLimit(request, reply)) return;

    const { contactId, enquiryText } = request.body ?? {};

    if (!contactId) {
      return reply.status(400).send({ error: 'contactId is required' });
    }

    const supabase = createSupabaseClient(request);

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('is_deleted', false)
      .single();

    if (contactError || !contact) {
      return reply.status(404).send({ error: 'Contact not found' });
    }

    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50);

    const service = getAILeadScoringService();
    const result = await service.enhancedScore(contact, activities ?? [], enquiryText);

    return { data: result };
  });

  // ─── Refine Brief ────────────────────────────────────────────────

  /**
   * POST /api/v1/ai/refine-brief
   * Suggest improvements to a client brief based on requirements and search history.
   * Returns 503 if AI is not configured (no meaningful fallback for this endpoint).
   *
   * Body: { clientBriefId: string }
   */
  fastify.post<{
    Body: { clientBriefId: string };
  }>('/refine-brief', async (request, reply) => {
    if (!enforceAIRateLimit(request, reply)) return;
    if (!isAIEnabled()) {
      return reply.status(503).send({ error: 'AI service not configured' });
    }

    const { clientBriefId } = request.body ?? {};

    if (!clientBriefId) {
      return reply.status(400).send({ error: 'clientBriefId is required' });
    }

    const supabase = createSupabaseClient(request);

    const { data: briefData, error: briefError } = await supabase
      .from('client_briefs')
      .select('*')
      .eq('id', clientBriefId)
      .eq('is_deleted', false)
      .single();

    if (briefError || !briefData) {
      return reply.status(404).send({ error: 'Client brief not found' });
    }

    const brief = fromDbSchema(briefData);

    // Fetch rejection history for search context
    const { data: rejectedMatches } = await supabase
      .from('property_matches')
      .select('overall_score, rejection_reason')
      .eq('client_brief_id', clientBriefId)
      .eq('status', 'rejected');

    const searchHistory = rejectedMatches && rejectedMatches.length > 0
      ? {
          rejectedProperties: rejectedMatches.length,
          averageScore: Math.round(
            rejectedMatches.reduce((sum, m) => sum + ((m.overall_score as number) ?? 0), 0) /
            rejectedMatches.length,
          ),
          commonRejectionReasons: rejectedMatches
            .map(m => m.rejection_reason)
            .filter((r): r is string => r !== null && r !== undefined),
        }
      : undefined;

    const anthropic = getAnthropicClientOrNull();
    if (!anthropic) {
      return reply.status(503).send({ error: 'AI service not configured' });
    }

    const result = await anthropic.suggestBriefRefinements({
      brief: {
        mustHaves: brief.requirements.mustHaves,
        niceToHaves: brief.requirements.niceToHaves,
        dealBreakers: brief.requirements.dealBreakers,
        suburbs: brief.requirements.suburbs.map(s => s.suburb),
        propertyTypes: brief.requirements.propertyTypes,
        budget: {
          min: brief.budget.min,
          max: brief.budget.max,
        },
      },
      searchHistory,
    });

    return {
      data: {
        clientBriefId,
        suggestions: result.suggestions,
        completenessScore: result.completenessScore,
        missingFields: result.missingFields,
        tokenUsage: result.tokenUsage,
      },
    };
  });

  // ─── Draft Message ───────────────────────────────────────────────

  /**
   * POST /api/v1/ai/draft-message
   * Draft a channel-appropriate message (email/SMS/WhatsApp) for a given contact and intent.
   * Returns 503 if AI is not configured.
   *
   * Body: { contactId: string; channel: 'email' | 'sms' | 'whatsapp'; intent: string; toneHint?: 'formal' | 'friendly' | 'professional' }
   */
  fastify.post('/draft-message', async (request, reply) => {
    if (!enforceAIRateLimit(request, reply)) return;

    const anthropic = getAnthropicClientOrNull();
    if (!anthropic) {
      return reply.status(503).send({ error: 'AI service not configured' });
    }

    const parsed = AIMessageDraftRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { contactId, channel, intent, toneHint } = parsed.data;
    const supabase = createSupabaseClient(request);

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('first_name, last_name, source, pipeline_stage')
      .eq('id', contactId)
      .eq('is_deleted', false)
      .single();

    if (contactError || !contact) {
      return reply.status(404).send({ error: 'Contact not found' });
    }

    const { data: activities } = await supabase
      .from('activities')
      .select('title')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5);

    const c = contact as ContactProjection;
    const acts = (activities ?? []) as ActivityProjection[];

    const result = await anthropic.draftMessage({
      channel,
      intent,
      toneHint,
      contactContext: {
        name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(),
        source: c.source ?? undefined,
        pipelineStage: c.pipeline_stage ?? undefined,
        recentActivities: acts.map(a => a.title ?? '').filter(Boolean),
      },
    });

    return {
      data: {
        subject: result.subject,
        body: result.body,
        suggestedTone: result.suggestedTone,
        alternativePhrasing: result.alternativePhrasing,
        tokenUsage: result.tokenUsage,
      },
    };
  });

  // ─── Extract Email Signals ───────────────────────────────────────

  /**
   * POST /api/v1/ai/extract-email-signals
   * Extract lead qualification signals from an inbound email body.
   * Returns 503 if AI is not configured (no meaningful fallback).
   *
   * Body: { subject: string; body: string; fromEmail?: string; classifiedType?: string }
   */
  fastify.post('/extract-email-signals', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!enforceAIRateLimit(request, reply)) return;

    const anthropic = getAnthropicClientOrNull();
    if (!anthropic) {
      return reply.status(503).send({ error: 'AI service not configured' });
    }

    const parsed = AIEmailSignalsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { subject, body, fromEmail, classifiedType } = parsed.data;

    const result = await anthropic.extractEmailSignals({
      subject,
      body,
      fromEmail,
      classifiedType,
    });

    return {
      data: {
        intent: result.intent,
        urgency: result.urgency,
        budgetMin: result.budgetMin,
        budgetMax: result.budgetMax,
        financeStatus: result.financeStatus,
        estimatedTimeline: result.estimatedTimeline,
        propertyPreferences: result.propertyPreferences,
        signals: result.signals,
        overallConfidence: result.overallConfidence,
        tokenUsage: result.tokenUsage,
      },
    };
  });

  // ─── Search Narrative ────────────────────────────────────────────

  /**
   * POST /api/v1/ai/narrative
   * Generate a plain-prose search progress update for a client.
   * Pulls their brief summary + top shortlisted properties automatically.
   * Returns 503 if AI is not configured.
   *
   * Body: { clientId: string; propertyIds?: string[] }
   */
  fastify.post('/narrative', async (request, reply) => {
    if (!enforceAIRateLimit(request, reply)) return;

    const anthropic = getAnthropicClientOrNull();
    if (!anthropic) {
      return reply.status(503).send({ error: 'AI service not configured' });
    }

    const parsed = AINarrativeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { clientId, propertyIds } = parsed.data;
    const supabase = createSupabaseClient(request);

    // Fetch contact name
    const { data: contact } = await supabase
      .from('contacts')
      .select('first_name, last_name')
      .eq('id', clientId)
      .eq('is_deleted', false)
      .single();

    if (!contact) {
      return reply.status(404).send({ error: 'Client not found' });
    }

    // Fetch latest brief for summary
    const { data: brief } = await supabase
      .from('client_briefs')
      .select('budget, requirements')
      .eq('contact_id', clientId)
      .is('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Fetch top shortlisted matches (optionally filtered by propertyIds)
    let matchQuery = supabase
      .from('property_matches')
      .select('overall_score, status, agent_notes, property:properties(address)')
      .eq('client_id', clientId)
      .not('status', 'eq', 'rejected')
      .order('overall_score', { ascending: false })
      .limit(8);

    if (propertyIds && propertyIds.length > 0) {
      matchQuery = matchQuery.in('property_id', propertyIds);
    }

    const { data: matches } = await matchQuery;

    // Count total reviewed (all statuses)
    const { count: totalSearched } = await supabase
      .from('property_matches')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);

    const c = contact as { first_name: string | null; last_name: string | null };
    const briefData = brief as Record<string, unknown> | null;

    const briefSummary = briefData
      ? (() => {
          const budget = briefData.budget as Record<string, number> | null;
          const reqs = briefData.requirements as Record<string, unknown> | null;
          const suburbs = (reqs?.suburbs as Array<Record<string, string>> | null)
            ?.map(s => s.suburb)
            .filter(Boolean)
            .join(', ');
          return [
            budget ? `Budget: $${budget.min?.toLocaleString()}–$${budget.max?.toLocaleString()} AUD` : null,
            suburbs ? `Suburbs: ${suburbs}` : null,
          ].filter(Boolean).join(', ');
        })()
      : 'Brief not yet completed';

    const result = await anthropic.generateSearchNarrative({
      clientName: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'your client',
      briefSummary,
      properties: (matches ?? []).map((m: Record<string, unknown>) => {
        const prop = m.property as Record<string, unknown> | null;
        const addr = prop?.address as Record<string, string> | null;
        return {
          address: addr
            ? `${addr.street_address ?? ''}, ${addr.suburb ?? ''} ${addr.state ?? ''}`.trim()
            : 'Address not available',
          score: (m.overall_score as number) ?? 0,
          status: (m.status as string) ?? 'unknown',
          notes: (m.agent_notes as string | null) ?? undefined,
        };
      }),
      totalSearched: totalSearched ?? 0,
    });

    return {
      data: {
        clientId,
        narrative: result.narrative,
        tokenUsage: result.tokenUsage,
      },
    };
  });
}
