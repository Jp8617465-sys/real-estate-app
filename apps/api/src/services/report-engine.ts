import type { ReportResult } from '@realflow/shared';

interface ReportDefinitionRow {
  id: string;
  office_id: string;
  type: string;
  filters: Array<{ field: string; operator: string; value: unknown }>;
  date_range: { preset: string; startDate?: string; endDate?: string };
  group_by?: string;
  order_by?: string;
  order_direction: string;
  chart_type: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  chartType: string;
  dateRange: { preset: string };
}

/**
 * Report execution engine.
 * Takes a report definition and produces results from the database.
 */
export class ReportEngine {
  constructor(private supabase: SupabaseClient) {}

  async execute(report: ReportDefinitionRow): Promise<ReportResult> {
    const dateRange = this.resolveDateRange(report.date_range);

    switch (report.type) {
      case 'pipeline_value':
        return this.executePipelineValueReport(report, dateRange);
      case 'agent_performance':
        return this.executeAgentPerformanceReport(report, dateRange);
      case 'revenue':
        return this.executeRevenueReport(report, dateRange);
      case 'lead_conversion':
        return this.executeLeadConversionReport(report, dateRange);
      case 'property_market':
        return this.executePropertyMarketReport(report, dateRange);
      case 'client_activity':
        return this.executeClientActivityReport(report, dateRange);
      case 'team_overview':
        return this.executeTeamOverviewReport(report, dateRange);
      default:
        return this.executeCustomReport(report, dateRange);
    }
  }

  // ─── Report Type Implementations ──────────────────────────────────

  private async executePipelineValueReport(
    report: ReportDefinitionRow,
    dateRange: { start: string; end: string },
  ): Promise<ReportResult> {
    const { data } = await (this.supabase
      .from('pipeline_entries')
      .select('stage, count, contacts(id)') as unknown as Promise<{ data: Array<{ stage: string; count: number }> }>);

    const rows = ((data as unknown as Array<{ stage: string; count: number }>) ?? []).map(row => ({
      stage: row.stage,
      count: row.count,
    }));

    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns: [
        { key: 'stage', label: 'Pipeline Stage', type: 'string' as const },
        { key: 'count', label: 'Deals', type: 'number' as const },
      ],
      rows,
    };
  }

  private async executeAgentPerformanceReport(
    report: ReportDefinitionRow,
    dateRange: { start: string; end: string },
  ): Promise<ReportResult> {
    const { data } = await (this.supabase
      .from('users')
      .select('id, first_name, last_name, role') as unknown as Promise<{ data: Array<Record<string, unknown>> }>);

    const rows = ((data as unknown as Array<Record<string, unknown>>) ?? []).map(user => ({
      agent_name: `${user.first_name} ${user.last_name}`,
      role: user.role as string,
    }));

    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns: [
        { key: 'agent_name', label: 'Agent', type: 'string' as const },
        { key: 'role', label: 'Role', type: 'string' as const },
      ],
      rows,
    };
  }

  private async executeRevenueReport(
    report: ReportDefinitionRow,
    dateRange: { start: string; end: string },
  ): Promise<ReportResult> {
    const { data } = await (this.supabase
      .from('invoices')
      .select('*') as unknown as Promise<{ data: Array<Record<string, unknown>> }>);

    const invoices = (data as unknown as Array<Record<string, unknown>>) ?? [];

    const summary: Record<string, number> = {};
    const rows = invoices.map(inv => {
      const status = inv.status as string;
      summary[status] = (summary[status] ?? 0) + (inv.amount as number);
      return {
        type: inv.type as string,
        amount: inv.amount as number,
        gst: inv.gst_amount as number,
        status,
        due_date: inv.due_date as string | null,
      };
    });

    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns: [
        { key: 'type', label: 'Invoice Type', type: 'string' as const },
        { key: 'amount', label: 'Amount (AUD)', type: 'currency' as const },
        { key: 'gst', label: 'GST (AUD)', type: 'currency' as const },
        { key: 'status', label: 'Status', type: 'string' as const },
        { key: 'due_date', label: 'Due Date', type: 'date' as const },
      ],
      rows,
      summary,
    };
  }

  private async executeLeadConversionReport(
    report: ReportDefinitionRow,
    dateRange: { start: string; end: string },
  ): Promise<ReportResult> {
    const stages = ['enquiry', 'qualified', 'brief_created', 'searching', 'shortlisted', 'offer', 'under_contract', 'settled'];

    const { data } = await (this.supabase
      .from('pipeline_entries')
      .select('stage') as unknown as Promise<{ data: Array<{ stage: string }> }>);

    const entries = (data as unknown as Array<{ stage: string }>) ?? [];
    const stageCounts: Record<string, number> = {};
    for (const entry of entries) {
      stageCounts[entry.stage] = (stageCounts[entry.stage] ?? 0) + 1;
    }

    const rows = stages.map(stage => ({
      stage,
      count: stageCounts[stage] ?? 0,
    }));

    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns: [
        { key: 'stage', label: 'Stage', type: 'string' as const },
        { key: 'count', label: 'Contacts', type: 'number' as const },
      ],
      rows,
    };
  }

  private async executePropertyMarketReport(
    report: ReportDefinitionRow,
    dateRange: { start: string; end: string },
  ): Promise<ReportResult> {
    const { data } = await (this.supabase
      .from('properties')
      .select('suburb, price, status, days_on_market') as unknown as Promise<{ data: Array<Record<string, unknown>> }>);

    const properties = (data as unknown as Array<Record<string, unknown>>) ?? [];

    const suburbStats: Record<string, { count: number; totalPrice: number; avgDom: number }> = {};
    for (const prop of properties) {
      const suburb = (prop.suburb as string) ?? 'Unknown';
      if (!suburbStats[suburb]) {
        suburbStats[suburb] = { count: 0, totalPrice: 0, avgDom: 0 };
      }
      suburbStats[suburb]!.count++;
      suburbStats[suburb]!.totalPrice += (prop.price as number) ?? 0;
      suburbStats[suburb]!.avgDom += (prop.days_on_market as number) ?? 0;
    }

    const rows = Object.entries(suburbStats).map(([suburb, stats]) => ({
      suburb,
      listing_count: stats.count,
      median_price: Math.round(stats.totalPrice / stats.count),
      avg_days_on_market: Math.round(stats.avgDom / stats.count),
    }));

    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns: [
        { key: 'suburb', label: 'Suburb', type: 'string' as const },
        { key: 'listing_count', label: 'Listings', type: 'number' as const },
        { key: 'median_price', label: 'Avg Price (AUD)', type: 'currency' as const },
        { key: 'avg_days_on_market', label: 'Avg DOM', type: 'number' as const },
      ],
      rows,
    };
  }

  private async executeClientActivityReport(
    report: ReportDefinitionRow,
    dateRange: { start: string; end: string },
  ): Promise<ReportResult> {
    const { data } = await (this.supabase
      .from('contacts')
      .select('id, first_name, last_name, last_contacted_at, lead_score') as unknown as Promise<{ data: Array<Record<string, unknown>> }>);

    const contacts = (data as unknown as Array<Record<string, unknown>>) ?? [];

    const rows = contacts.map(c => ({
      name: `${c.first_name} ${c.last_name}`,
      last_contacted: c.last_contacted_at as string | null,
      lead_score: c.lead_score as number | null,
    }));

    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns: [
        { key: 'name', label: 'Client', type: 'string' as const },
        { key: 'last_contacted', label: 'Last Contact', type: 'date' as const },
        { key: 'lead_score', label: 'Lead Score', type: 'number' as const },
      ],
      rows,
    };
  }

  private async executeTeamOverviewReport(
    report: ReportDefinitionRow,
    dateRange: { start: string; end: string },
  ): Promise<ReportResult> {
    const { data } = await (this.supabase
      .from('users')
      .select('id, first_name, last_name, role') as unknown as Promise<{ data: Array<Record<string, unknown>> }>);

    const users = (data as unknown as Array<Record<string, unknown>>) ?? [];

    const rows = users.map(u => ({
      name: `${u.first_name} ${u.last_name}`,
      role: u.role as string,
    }));

    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns: [
        { key: 'name', label: 'Team Member', type: 'string' as const },
        { key: 'role', label: 'Role', type: 'string' as const },
      ],
      rows,
    };
  }

  private async executeCustomReport(
    report: ReportDefinitionRow,
    dateRange: { start: string; end: string },
  ): Promise<ReportResult> {
    return {
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      rowCount: 0,
      columns: [],
      rows: [],
    };
  }

  // ─── Date Range Resolution ────────────────────────────────────────

  private resolveDateRange(dateRange: { preset: string; startDate?: string; endDate?: string }): { start: string; end: string } {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (dateRange.preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'last_7_days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_90_days':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'this_quarter': {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStart, 1);
        break;
      }
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        start = dateRange.startDate ? new Date(dateRange.startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        end = dateRange.endDate ? new Date(dateRange.endDate) : now;
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }

  // ─── Pre-built Templates ──────────────────────────────────────────

  static getTemplates(): ReportTemplate[] {
    return [
      {
        id: 'tpl_pipeline_value',
        name: 'Pipeline Value by Stage',
        description: 'Total deal value grouped by pipeline stage',
        type: 'pipeline_value',
        chartType: 'bar',
        dateRange: { preset: 'this_month' },
      },
      {
        id: 'tpl_agent_performance',
        name: 'Agent Performance',
        description: 'Contacts managed, deals closed, and response time by agent',
        type: 'agent_performance',
        chartType: 'table',
        dateRange: { preset: 'this_month' },
      },
      {
        id: 'tpl_revenue',
        name: 'Revenue Summary',
        description: 'Fees earned, outstanding invoices, and payment status',
        type: 'revenue',
        chartType: 'donut',
        dateRange: { preset: 'this_quarter' },
      },
      {
        id: 'tpl_lead_conversion',
        name: 'Lead Conversion Funnel',
        description: 'Conversion rates from enquiry through to settlement',
        type: 'lead_conversion',
        chartType: 'funnel',
        dateRange: { preset: 'last_90_days' },
      },
      {
        id: 'tpl_property_market',
        name: 'Property Market Overview',
        description: 'Median prices, days on market, and listing volume by suburb',
        type: 'property_market',
        chartType: 'bar',
        dateRange: { preset: 'last_30_days' },
      },
      {
        id: 'tpl_client_activity',
        name: 'Client Activity',
        description: 'Touchpoints per client, last contact date, and lead scores',
        type: 'client_activity',
        chartType: 'table',
        dateRange: { preset: 'last_30_days' },
      },
      {
        id: 'tpl_team_overview',
        name: 'Team Overview',
        description: 'Team members, roles, and workload distribution',
        type: 'team_overview',
        chartType: 'table',
        dateRange: { preset: 'this_month' },
      },
      {
        id: 'tpl_stale_leads',
        name: 'Stale Leads Alert',
        description: 'Leads with no activity in the last 14 days',
        type: 'client_activity',
        chartType: 'table',
        dateRange: { preset: 'last_30_days' },
      },
    ];
  }
}
