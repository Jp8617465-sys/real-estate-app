import type { FastifyInstance } from 'fastify';
import {
  GenerateReportRequestSchema,
  ConsolidationReportStatusSchema,
} from '@realflow/shared';
import { ResearchConsolidationEngine } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';
import { MarketDataService } from '../services/market-data-service';

export async function consolidationReportRoutes(fastify: FastifyInstance) {
  // List reports for a client
  fastify.get<{ Querystring: { clientId: string; type?: string } }>(
    '/',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { clientId, type } = request.query;

      if (!clientId) {
        return reply.status(400).send({ error: 'clientId is required' });
      }

      let query = supabase
        .from('consolidation_reports')
        .select('*')
        .eq('client_id', clientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) return reply.status(500).send({ error: error.message });

      return { data };
    },
  );

  // Get single report
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('consolidation_reports')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) return reply.status(404).send({ error: 'Report not found' });
    return { data };
  });

  // Generate a new consolidation report
  fastify.post('/generate', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = GenerateReportRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const req = parsed.data;

    // Fetch client brief
    const briefQuery = req.clientBriefId
      ? supabase.from('client_briefs').select('*').eq('id', req.clientBriefId).single()
      : supabase.from('client_briefs').select('*').eq('contact_id', req.clientId).is('is_deleted', false).order('created_at', { ascending: false }).limit(1).single();

    const { data: brief, error: briefError } = await briefQuery;
    if (briefError || !brief) {
      return reply.status(404).send({ error: 'Client brief not found' });
    }

    // Fetch property matches with properties
    let matchQuery = supabase
      .from('property_matches')
      .select('*, property:properties(*)')
      .eq('client_id', req.clientId);

    if (req.propertyIds && req.propertyIds.length > 0) {
      matchQuery = matchQuery.in('property_id', req.propertyIds);
    }

    const { data: matches } = await matchQuery;

    // Fetch inspections
    const { data: inspections } = await supabase
      .from('inspections')
      .select('*')
      .eq('client_id', req.clientId);

    // Fetch due diligence
    const { data: ddChecklists } = req.transactionId
      ? await supabase
          .from('due_diligence_checklists')
          .select('*, items:due_diligence_items(*)')
          .eq('transaction_id', req.transactionId)
      : { data: [] };

    // Fetch key dates
    const { data: keyDates } = req.transactionId
      ? await supabase
          .from('key_dates')
          .select('*')
          .eq('transaction_id', req.transactionId)
      : { data: [] };

    // Fetch offers
    const { data: offers } = await supabase
      .from('offers')
      .select('*')
      .eq('client_id', req.clientId);

    // Fetch market data for relevant suburbs from market_snapshots
    const marketDataService = new MarketDataService(supabase);
    const briefRequirements = brief.requirements as {
      suburbs?: Array<{ suburb: string; state: string }>;
    } | null;

    const targetSuburbs = briefRequirements?.suburbs ?? [];

    // Also extract suburbs from matched properties
    const propertySuburbs: Array<{ suburb: string; state: string }> = [];
    for (const match of matches ?? []) {
      const property = (match as Record<string, unknown>).property as {
        address?: { suburb?: string; state?: string };
      } | null;
      if (property?.address?.suburb && property?.address?.state) {
        propertySuburbs.push({
          suburb: property.address.suburb,
          state: property.address.state,
        });
      }
    }

    // Combine and deduplicate suburb list
    const allSuburbs = [...targetSuburbs, ...propertySuburbs];
    const uniqueSuburbMap = new Map<string, { suburb: string; state: string }>();
    for (const s of allSuburbs) {
      const key = `${s.suburb.toLowerCase()}|${s.state.toLowerCase()}`;
      if (!uniqueSuburbMap.has(key)) {
        uniqueSuburbMap.set(key, s);
      }
    }

    const marketData = req.includeMarketData
      ? await marketDataService.getSnapshotsForSuburbs(Array.from(uniqueSuburbMap.values()))
      : [];

    // Consolidate
    const content = ResearchConsolidationEngine.consolidate(
      {
        clientBrief: brief,
        propertyMatches: (matches ?? []) as Parameters<typeof ResearchConsolidationEngine.consolidate>[0]['propertyMatches'],
        inspections: inspections ?? [],
        dueDiligenceChecklists: (ddChecklists ?? []) as Parameters<typeof ResearchConsolidationEngine.consolidate>[0]['dueDiligenceChecklists'],
        keyDates: keyDates ?? [],
        offers: offers ?? [],
        marketData,
      },
      {
        reportType: req.type,
        includeMarketData: req.includeMarketData,
        includeDueDiligence: req.includeDueDiligence,
        includeInspections: req.includeInspections,
        propertyIds: req.propertyIds,
      },
    );

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000';

    // Save report
    const { data: report, error: saveError } = await supabase
      .from('consolidation_reports')
      .insert({
        client_id: req.clientId,
        client_brief_id: brief.id,
        transaction_id: req.transactionId,
        type: req.type,
        title: `${req.type.replace(/_/g, ' ')} — ${new Date().toLocaleDateString('en-AU')}`,
        status: 'ready',
        content,
        generated_by: 'automated',
        generated_at: new Date().toISOString(),
        created_by: userId,
      })
      .select()
      .single();

    if (saveError) return reply.status(500).send({ error: saveError.message });

    return reply.status(201).send({ data: report });
  });

  // Update report status (e.g., mark as sent to client)
  fastify.put<{ Params: { id: string }; Body: { status: string } }>(
    '/:id/status',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { id } = request.params;

      const statusParsed = ConsolidationReportStatusSchema.safeParse(request.body.status);
      if (!statusParsed.success) {
        return reply.status(400).send({ error: 'Invalid status' });
      }

      const updatePayload: Record<string, unknown> = {
        status: statusParsed.data,
        updated_at: new Date().toISOString(),
      };

      if (statusParsed.data === 'sent_to_client') {
        updatePayload.sent_to_client_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('consolidation_reports')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return { data };
    },
  );

  // Soft delete
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('consolidation_reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });
}
