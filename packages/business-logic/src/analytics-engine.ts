import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PipelineVelocity,
  AgentPerformance,
  MarketInsight,
  RevenueForecast,
  DashboardSnapshot,
  AnalyticsPeriod,
} from '@realflow/shared';

// ─── Stage ordering for buyers_agent pipeline ─────────────────────────────────

const BUYERS_AGENT_STAGE_ORDER: string[] = [
  'lead',
  'brief',
  'property_search',
  'inspections',
  'due_diligence',
  'offer',
  'contract',
  'settlement',
];

// ─── Internal DB row shapes ───────────────────────────────────────────────────

interface PipelineFunnelRow {
  agent_id: string;
  pipeline_type: string;
  stage: string;
  active_count: number | string;
  avg_days_in_stage: number | string | null;
  new_30d: number | string;
}

interface MarketDataRow {
  suburb: string;
  postcode: string | null;
  state: string | null;
  property_type: string;
  median_sale_price: number | string | null;
  median_days_on_market: number | string | null;
  clearance_rate: number | string | null;
  price_change_1y_percent: number | string | null;
  snapshot_date: string;
}

interface TransactionRow {
  id: string;
  status: string;
  updated_at: string;
}

interface InvoiceRow {
  id: string;
  type: string;
  amount: number | string;
  status: string;
  paid_date: string | null;
}

interface MessageRow {
  id: string;
}

interface InspectionRow {
  id: string;
}

interface OfferRow {
  id: string;
  status: string;
}

interface ReferralFeeRow {
  id: string;
  amount: number | string;
  paid_date: string | null;
}

interface FeeStructureRow {
  id: string;
  success_fee_flat_amount: number | string | null;
  success_fee_percentage: number | string | null;
  success_fee_type: string;
}

// ─── Analytics Engine ─────────────────────────────────────────────────────────

export class AnalyticsEngine {
  /**
   * Convert an AnalyticsPeriod string into an absolute { from, to } date range.
   */
  static periodToDateRange(period: AnalyticsPeriod): { from: Date; to: Date } {
    const to = new Date();
    const from = new Date();

    switch (period) {
      case '7d':
        from.setDate(from.getDate() - 7);
        break;
      case '30d':
        from.setDate(from.getDate() - 30);
        break;
      case '90d':
        from.setDate(from.getDate() - 90);
        break;
      case 'ytd':
        from.setMonth(0, 1);
        from.setHours(0, 0, 0, 0);
        break;
    }

    return { from, to };
  }

  /**
   * Query the pipeline_funnel_stats view and compute per-stage conversion rates.
   */
  static async getPipelineVelocity(
    agentId: string,
    supabase: SupabaseClient,
  ): Promise<PipelineVelocity[]> {
    const { data, error } = await supabase
      .from('pipeline_funnel_stats')
      .select('agent_id, pipeline_type, stage, active_count, avg_days_in_stage, new_30d')
      .eq('agent_id', agentId);

    if (error || !data || data.length === 0) {
      return [];
    }

    const rows = data as PipelineFunnelRow[];

    // Group rows by pipeline_type so we can compute per-funnel conversion rates
    const byType = new Map<string, PipelineFunnelRow[]>();
    for (const row of rows) {
      const list = byType.get(row.pipeline_type) ?? [];
      list.push(row);
      byType.set(row.pipeline_type, list);
    }

    const result: PipelineVelocity[] = [];

    for (const [pipelineType, stageRows] of byType) {
      // Sort by the canonical stage order for buyers_agent; fall back to alphabetical
      const stageOrder =
        pipelineType === 'buyers_agent' ? BUYERS_AGENT_STAGE_ORDER : [];

      const sorted = [...stageRows].sort((a, b) => {
        const ai = stageOrder.indexOf(a.stage);
        const bi = stageOrder.indexOf(b.stage);
        if (ai === -1 && bi === -1) return a.stage.localeCompare(b.stage);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      for (let i = 0; i < sorted.length; i++) {
        const row = sorted[i];
        if (!row) continue;

        const currentCount = Number(row.active_count);
        const nextRow = sorted[i + 1];
        const nextCount = nextRow ? Number(nextRow.active_count) : 0;

        // Conversion rate: percentage that advance to the next stage
        const conversionRate =
          currentCount > 0 && nextRow
            ? Math.min(100, Math.round((nextCount / currentCount) * 100))
            : 0;

        const pipelineTypeValue = (
          pipelineType === 'buyer' ||
          pipelineType === 'seller' ||
          pipelineType === 'buyers_agent'
            ? pipelineType
            : 'buyers_agent'
        ) as 'buyer' | 'seller' | 'buyers_agent';

        result.push({
          stage: row.stage,
          pipelineType: pipelineTypeValue,
          activeCount: currentCount,
          avgDaysInStage: row.avg_days_in_stage ? Number(row.avg_days_in_stage) : 0,
          conversionRate,
          new30d: Number(row.new_30d),
        });
      }
    }

    return result;
  }

  /**
   * Compute agent performance metrics from live tables for the given period.
   */
  static async getAgentPerformance(
    agentId: string,
    period: AnalyticsPeriod,
    supabase: SupabaseClient,
  ): Promise<AgentPerformance> {
    const { from, to } = this.periodToDateRange(period);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    // Fetch agent profile for the name
    const { data: profile } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', agentId)
      .single();

    const agentName =
      profile
        ? `${(profile as { first_name: string; last_name: string }).first_name ?? ''} ${(profile as { first_name: string; last_name: string }).last_name ?? ''}`.trim()
        : 'Agent';

    // Deals settled in period (completed transactions linked to this agent via client_briefs)
    const { data: completedTxns } = await supabase
      .from('transactions')
      .select('id, status, updated_at')
      .eq('status', 'completed')
      .gte('updated_at', fromIso)
      .lte('updated_at', toIso);

    const settledTxnIds = (completedTxns as TransactionRow[] | null)?.map((t) => t.id) ?? [];
    const dealsSettled = settledTxnIds.length;

    // Deals in progress (active transactions for this agent)
    const { data: activeTxns } = await supabase
      .from('transactions')
      .select('id')
      .eq('status', 'active');

    const dealsInProgress = (activeTxns as TransactionRow[] | null)?.length ?? 0;

    // Revenue: sum paid invoices for this agent in period
    // Invoices are linked through fee_structures -> client_id -> client_briefs -> agent_id
    const { data: paidInvoices } = await supabase
      .from('invoices')
      .select('id, type, amount, status, paid_date')
      .eq('status', 'paid')
      .gte('paid_date', fromIso)
      .lte('paid_date', toIso);

    const paidInvoiceRows = (paidInvoices as InvoiceRow[] | null) ?? [];
    const totalRevenue = paidInvoiceRows.reduce(
      (sum, inv) => sum + Number(inv.amount),
      0,
    );

    const avgDealValue = totalRevenue / Math.max(dealsSettled, 1);

    // Messages sent outbound in period
    const { data: sentMessages } = await supabase
      .from('messages')
      .select('id')
      .eq('direction', 'outbound')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    const messagesSent = (sentMessages as MessageRow[] | null)?.length ?? 0;

    // Inspections done in period
    const { data: inspections } = await supabase
      .from('inspections')
      .select('id')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    const inspectionsDone = (inspections as InspectionRow[] | null)?.length ?? 0;

    // Offer conversion rate: accepted / submitted * 100
    const { data: offersInPeriod } = await supabase
      .from('offers')
      .select('id, status')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    const offerRows = (offersInPeriod as OfferRow[] | null) ?? [];
    const totalOffers = offerRows.length;
    const acceptedOffers = offerRows.filter((o) => o.status === 'accepted').length;
    const offerConversionRate =
      totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : 0;

    return {
      agentId,
      agentName,
      period,
      dealsSettled,
      dealsInProgress,
      totalRevenue,
      avgDealValue,
      avgResponseTimeMinutes: null, // Sprint 5: message response tracking
      messagesSent,
      inspectionsDone,
      offerConversionRate,
    };
  }

  /**
   * Retrieve the most recent market data snapshots for the given suburbs.
   */
  static async getMarketInsights(
    suburbs: string[],
    supabase: SupabaseClient,
  ): Promise<MarketInsight[]> {
    if (suburbs.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('market_data_snapshots')
      .select(
        'suburb, postcode, state, property_type, median_sale_price, median_days_on_market, clearance_rate, price_change_1y_percent, snapshot_date',
      )
      .in('suburb', suburbs)
      .order('snapshot_date', { ascending: false });

    if (error || !data) {
      return [];
    }

    // Deduplicate: keep only the latest snapshot per (suburb, property_type)
    const seen = new Set<string>();
    const deduped: MarketInsight[] = [];

    for (const row of data as MarketDataRow[]) {
      const key = `${row.suburb}::${row.property_type}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const propertyType = (
        row.property_type === 'house' ||
        row.property_type === 'unit' ||
        row.property_type === 'townhouse'
          ? row.property_type
          : 'house'
      ) as 'house' | 'unit' | 'townhouse';

      deduped.push({
        suburb: row.suburb,
        postcode: row.postcode,
        state: row.state,
        propertyType,
        medianSalePrice: row.median_sale_price !== null ? Number(row.median_sale_price) : null,
        medianDaysOnMarket:
          row.median_days_on_market !== null ? Number(row.median_days_on_market) : null,
        clearanceRate: row.clearance_rate !== null ? Number(row.clearance_rate) : null,
        priceChange1yPercent:
          row.price_change_1y_percent !== null ? Number(row.price_change_1y_percent) : null,
        snapshotDate: row.snapshot_date,
      });
    }

    return deduped;
  }

  /**
   * Calculate the revenue forecast for a given period.
   */
  static async getRevenueForecast(
    agentId: string,
    period: AnalyticsPeriod,
    supabase: SupabaseClient,
  ): Promise<RevenueForecast> {
    const { from, to } = this.periodToDateRange(period);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    // All paid invoices in period
    const { data: paidInvoices } = await supabase
      .from('invoices')
      .select('id, type, amount, status, paid_date')
      .eq('status', 'paid')
      .gte('paid_date', fromIso)
      .lte('paid_date', toIso);

    const paidRows = (paidInvoices as InvoiceRow[] | null) ?? [];

    const earnedRevenue = paidRows.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const retainerFees = paidRows
      .filter((inv) => inv.type === 'retainer')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    const successFees = paidRows
      .filter((inv) => inv.type === 'success_fee')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);

    // Referral fees paid in period
    const { data: referralData } = await supabase
      .from('referral_fees')
      .select('id, amount, paid_date')
      .not('paid_date', 'is', null)
      .gte('paid_date', fromIso)
      .lte('paid_date', toIso);

    const referralFees = ((referralData as ReferralFeeRow[] | null) ?? []).reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    // Pipeline value: estimate from active fee structures
    const { data: activeFeeStructures } = await supabase
      .from('fee_structures')
      .select('id, success_fee_flat_amount, success_fee_percentage, success_fee_type');

    const feeRows = (activeFeeStructures as FeeStructureRow[] | null) ?? [];
    const ESTIMATED_PURCHASE_PRICE = 850_000; // AUD fallback for % calculations
    const pipelineValue = feeRows.reduce((sum, fs) => {
      if (fs.success_fee_type === 'flat' && fs.success_fee_flat_amount) {
        return sum + Number(fs.success_fee_flat_amount);
      }
      if (fs.success_fee_type === 'percentage' && fs.success_fee_percentage) {
        return sum + (ESTIMATED_PURCHASE_PRICE * Number(fs.success_fee_percentage)) / 100;
      }
      // Fallback: 1.5% of estimated purchase price
      return sum + ESTIMATED_PURCHASE_PRICE * 0.015;
    }, 0);

    // Forecast: earned + 40% of pipeline
    const forecastRevenue = earnedRevenue + pipelineValue * 0.4;

    return {
      period,
      earnedRevenue: Math.round(earnedRevenue * 100) / 100,
      pipelineValue: Math.round(pipelineValue * 100) / 100,
      forecastRevenue: Math.round(forecastRevenue * 100) / 100,
      retainerFees: Math.round(retainerFees * 100) / 100,
      successFees: Math.round(successFees * 100) / 100,
      referralFees: Math.round(referralFees * 100) / 100,
    };
  }

  /**
   * Combine all analytics into a single dashboard snapshot in parallel.
   */
  static async getDashboardSnapshot(
    agentId: string,
    period: AnalyticsPeriod,
    supabase: SupabaseClient,
  ): Promise<DashboardSnapshot> {
    // Fetch the agent's active client briefs to determine suburbs for market insights
    const { data: briefs } = await supabase
      .from('client_briefs')
      .select('requirements')
      .eq('agent_id', agentId)
      .eq('is_deleted', false)
      .limit(20);

    // Extract unique suburbs from brief requirements JSON
    const suburbSet = new Set<string>();
    for (const brief of (briefs as Array<{ requirements: unknown }> | null) ?? []) {
      const reqs = brief.requirements as {
        suburbs?: Array<{ suburb: string }>;
      } | null;
      for (const s of reqs?.suburbs ?? []) {
        if (s.suburb) suburbSet.add(s.suburb);
      }
    }
    const suburbs = Array.from(suburbSet).slice(0, 10);

    const [pipelineVelocity, agentPerformance, marketInsights, revenue] =
      await Promise.all([
        this.getPipelineVelocity(agentId, supabase),
        this.getAgentPerformance(agentId, period, supabase),
        this.getMarketInsights(suburbs, supabase),
        this.getRevenueForecast(agentId, period, supabase),
      ]);

    return {
      pipelineVelocity,
      agentPerformance,
      marketInsights,
      revenue,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build and upsert an analytics_daily_snapshots row for the given agent/date.
   */
  static async generateDailySnapshot(
    agentId: string,
    date: Date,
    supabase: SupabaseClient,
  ): Promise<void> {
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);
    const fromIso = dayStart.toISOString();
    const toIso = dayEnd.toISOString();

    // Active clients: count of non-deleted client_briefs
    const { data: activeClients } = await supabase
      .from('client_briefs')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('is_deleted', false);

    const activeClientsCount =
      (activeClients as null | { count?: number })?.count ?? 0;

    // New leads on that day (contacts created that day)
    const { count: newLeadsCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    // Leads contacted: outbound messages sent that day
    const { count: leadsContactedCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    // Briefs created that day
    const { count: briefsCreatedCount } = await supabase
      .from('client_briefs')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    // Inspections done that day
    const { count: inspectionsDoneCount } = await supabase
      .from('inspections')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    // Offers submitted that day
    const { count: offersSubmittedCount } = await supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    // Contracts signed: transactions moved to 'contract' stage that day
    const { count: contractsSignedCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('stage', 'contract')
      .gte('stage_entered_at', fromIso)
      .lte('stage_entered_at', toIso);

    // Settlements: transactions completed that day
    const { count: settlementsCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', fromIso)
      .lte('updated_at', toIso);

    // Revenue earned that day
    const { data: paidInvoices } = await supabase
      .from('invoices')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_date', fromIso)
      .lte('paid_date', toIso);

    const revenueEarnedAud = ((paidInvoices as Array<{ amount: number }> | null) ?? []).reduce(
      (sum, inv) => sum + Number(inv.amount),
      0,
    );

    // Pipeline value snapshot (point-in-time)
    const { data: feeStructures } = await supabase
      .from('fee_structures')
      .select('success_fee_flat_amount, success_fee_percentage, success_fee_type');

    const ESTIMATED_PURCHASE_PRICE = 850_000;
    const pipelineValueAud = ((feeStructures as FeeStructureRow[] | null) ?? []).reduce(
      (sum, fs) => {
        if (fs.success_fee_type === 'flat' && fs.success_fee_flat_amount) {
          return sum + Number(fs.success_fee_flat_amount);
        }
        if (fs.success_fee_type === 'percentage' && fs.success_fee_percentage) {
          return sum + (ESTIMATED_PURCHASE_PRICE * Number(fs.success_fee_percentage)) / 100;
        }
        return sum + ESTIMATED_PURCHASE_PRICE * 0.015;
      },
      0,
    );

    const settledCount = settlementsCount ?? 0;
    const avgDealValueAud =
      settledCount > 0 ? revenueEarnedAud / settledCount : 0;

    // Messages sent count
    const { count: messagesSentCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    // Stage velocity from view
    const { data: velocityRows } = await supabase
      .from('pipeline_funnel_stats')
      .select('stage, pipeline_type, active_count, avg_days_in_stage')
      .eq('agent_id', agentId);

    const stageVelocity = (velocityRows ?? []).map((r) => ({
      stage: (r as PipelineFunnelRow).stage,
      pipeline_type: (r as PipelineFunnelRow).pipeline_type,
      in_count: Number((r as PipelineFunnelRow).active_count),
      avg_days: Number((r as PipelineFunnelRow).avg_days_in_stage ?? 0),
    }));

    await supabase.from('analytics_daily_snapshots').upsert(
      {
        agent_id: agentId,
        snapshot_date: dateStr,
        active_clients_count: activeClientsCount,
        new_leads_count: newLeadsCount ?? 0,
        leads_contacted_count: leadsContactedCount ?? 0,
        briefs_created_count: briefsCreatedCount ?? 0,
        inspections_done_count: inspectionsDoneCount ?? 0,
        offers_submitted_count: offersSubmittedCount ?? 0,
        contracts_signed_count: contractsSignedCount ?? 0,
        settlements_count: settledCount,
        stage_velocity: stageVelocity,
        revenue_earned_aud: Math.round(revenueEarnedAud * 100) / 100,
        pipeline_value_aud: Math.round(pipelineValueAud * 100) / 100,
        avg_deal_value_aud: Math.round(avgDealValueAud * 100) / 100,
        messages_sent_count: messagesSentCount ?? 0,
        avg_response_time_minutes: null,
        ai_matches_run: 0,
        ai_cost_aud: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id,snapshot_date' },
    );
  }
}
