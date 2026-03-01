import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PropertyAnalysisService } from '@realflow/integrations';
import { createSupabaseClient } from '../middleware/supabase';

const AI_CONFIG = {
  provider: 'anthropic' as const,
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  model: process.env.AI_MODEL ?? 'claude-sonnet-4-20250514',
};

function getAIService(): PropertyAnalysisService {
  if (!AI_CONFIG.apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new PropertyAnalysisService(AI_CONFIG);
}

// ─── Request Schemas ───────────────────────────────────────────────

const AnalyzePropertyRequestSchema = z.object({
  propertyId: z.string().uuid(),
  clientBriefId: z.string().uuid(),
});

const ConsolidateRequestSchema = z.object({
  clientId: z.string().uuid(),
  propertyIds: z.array(z.string().uuid()).optional(),
});

const RefineBriefRequestSchema = z.object({
  clientBriefId: z.string().uuid(),
  clientFeedback: z.string().optional(),
});

const DraftMessageRequestSchema = z.object({
  recipient: z.enum(['client', 'selling_agent', 'solicitor', 'broker']),
  purpose: z.string().min(1),
  context: z.string().min(1),
  tone: z.enum(['formal', 'friendly', 'urgent']).optional(),
});

export async function aiAnalysisRoutes(fastify: FastifyInstance) {
  // AI-enhanced property description analysis
  fastify.post('/property', async (request, reply) => {
    const parsed = AnalyzePropertyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const supabase = createSupabaseClient(request);
    const { propertyId, clientBriefId } = parsed.data;

    // Fetch property
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      return reply.status(404).send({ error: 'Property not found' });
    }

    // Fetch client brief
    const { data: brief, error: briefError } = await supabase
      .from('client_briefs')
      .select('*')
      .eq('id', clientBriefId)
      .single();

    if (briefError || !brief) {
      return reply.status(404).send({ error: 'Client brief not found' });
    }

    const aiService = getAIService();

    const analysis = await aiService.analyzePropertyDescription({
      propertyId,
      description: property.description ?? '',
      address: `${property.address?.street_address}, ${property.address?.suburb}`,
      listingPrice: property.list_price,
      mustHaves: brief.requirements?.must_haves ?? [],
      dealBreakers: brief.requirements?.deal_breakers ?? [],
      niceToHaves: brief.requirements?.nice_to_haves ?? [],
      budgetMin: brief.budget?.min ?? 0,
      budgetMax: brief.budget?.max ?? 0,
      propertyTypes: brief.requirements?.property_types ?? [],
      clientBriefId,
    });

    // Save AI analysis as an insight
    await supabase
      .from('ai_insights')
      .insert({
        type: 'property_analysis',
        target_type: 'property',
        target_id: propertyId,
        client_brief_id: clientBriefId,
        content: analysis,
        confidence: analysis.overallSentiment === 'positive' ? 'high' : 'medium',
      });

    return { data: analysis };
  });

  // AI-powered research consolidation with narrative
  fastify.post('/consolidate', async (request, reply) => {
    const parsed = ConsolidateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const supabase = createSupabaseClient(request);
    const { clientId, propertyIds } = parsed.data;

    // Fetch client brief
    const { data: brief, error: briefError } = await supabase
      .from('client_briefs')
      .select('*')
      .eq('contact_id', clientId)
      .is('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (briefError || !brief) {
      return reply.status(404).send({ error: 'Client brief not found' });
    }

    // Fetch contact name
    const { data: contact } = await supabase
      .from('contacts')
      .select('first_name, last_name')
      .eq('id', clientId)
      .single();

    const clientName = contact
      ? `${contact.first_name} ${contact.last_name}`
      : 'Client';

    // Fetch property matches with properties
    let matchQuery = supabase
      .from('property_matches')
      .select('*, property:properties(*)')
      .eq('client_id', clientId)
      .order('overall_score', { ascending: false });

    if (propertyIds && propertyIds.length > 0) {
      matchQuery = matchQuery.in('property_id', propertyIds);
    }

    const { data: matches } = await matchQuery;

    // Build properties for AI
    const properties = (matches ?? []).map((m: Record<string, unknown>) => {
      const prop = m.property as Record<string, unknown> | null;
      const addr = prop?.address as Record<string, string> | null;
      return {
        address: addr
          ? `${addr.street_address}, ${addr.suburb} ${addr.state}`
          : 'Unknown',
        score: m.overall_score as number,
        notes: (m.agent_notes as string) ?? 'No notes',
      };
    });

    const aiService = getAIService();

    const report = await aiService.generateConsolidationReport({
      clientName,
      briefSummary: `Budget: $${brief.budget?.min ?? 0}-$${brief.budget?.max ?? 0}, Suburbs: ${(brief.requirements?.suburbs ?? []).map((s: Record<string, unknown>) => s.suburb).join(', ')}`,
      properties,
      marketData: 'Market data not yet integrated — use rule-based consolidation engine for structured data.',
      ddStatus: 'See structured DD data from consolidation engine.',
    });

    return { data: report };
  });

  // AI brief refinement suggestions
  fastify.post('/refine-brief', async (request, reply) => {
    const parsed = RefineBriefRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const supabase = createSupabaseClient(request);
    const { clientBriefId, clientFeedback } = parsed.data;

    const { data: brief, error: briefError } = await supabase
      .from('client_briefs')
      .select('*')
      .eq('id', clientBriefId)
      .single();

    if (briefError || !brief) {
      return reply.status(404).send({ error: 'Client brief not found' });
    }

    // Fetch property match history
    const { data: matches } = await supabase
      .from('property_matches')
      .select('overall_score, status, agent_notes')
      .eq('client_brief_id', clientBriefId)
      .order('matched_at', { ascending: false })
      .limit(20);

    const matchSummary = (matches ?? [])
      .map((m: Record<string, unknown>) =>
        `Score: ${m.overall_score}, Status: ${m.status}${m.agent_notes ? `, Notes: ${m.agent_notes}` : ''}`)
      .join('\n');

    const aiService = getAIService();

    const refinement = await aiService.refineBrief({
      currentBrief: JSON.stringify(brief, null, 2),
      searchHistory: matchSummary || 'No properties matched yet.',
      clientFeedback: clientFeedback ?? 'No specific feedback provided.',
    });

    return { data: refinement };
  });

  // AI-drafted message
  fastify.post('/draft-message', async (request, reply) => {
    const parsed = DraftMessageRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const aiService = getAIService();

    const message = await aiService.draftMessage(parsed.data);

    return { data: message };
  });
}
