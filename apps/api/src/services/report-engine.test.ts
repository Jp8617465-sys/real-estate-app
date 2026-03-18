import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportEngine } from './report-engine';

// ─── Mock Supabase ─────────────────────────────────────────────────

function createMockSupabase(selectResult: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue(selectResult),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

describe('ReportEngine', () => {
  describe('getTemplates', () => {
    it('returns 8 pre-built templates', () => {
      const templates = ReportEngine.getTemplates();
      expect(templates).toHaveLength(8);
      expect(templates.map(t => t.type)).toContain('pipeline_value');
      expect(templates.map(t => t.type)).toContain('revenue');
      expect(templates.map(t => t.type)).toContain('lead_conversion');
    });

    it('each template has required fields', () => {
      const templates = ReportEngine.getTemplates();
      for (const template of templates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.type).toBeDefined();
        expect(template.chartType).toBeDefined();
        expect(template.dateRange).toBeDefined();
      }
    });
  });

  describe('execute', () => {
    it('executes a pipeline_value report', async () => {
      const supabase = createMockSupabase({ data: [{ stage: 'enquiry', count: 5 }], error: null });
      const engine = new ReportEngine(supabase);

      const result = await engine.execute({
        id: 'report-1',
        office_id: 'office-1',
        type: 'pipeline_value',
        filters: [],
        date_range: { preset: 'last_30_days' },
        chart_type: 'bar',
        order_direction: 'desc',
      });

      expect(result.reportId).toBe('report-1');
      expect(result.generatedAt).toBeDefined();
      expect(result.columns.length).toBeGreaterThan(0);
    });

    it('executes a revenue report', async () => {
      const supabase = createMockSupabase({
        data: [
          { type: 'retainer', amount: 2500, gst_amount: 250, status: 'paid', due_date: null },
        ],
        error: null,
      });
      const engine = new ReportEngine(supabase);

      const result = await engine.execute({
        id: 'report-2',
        office_id: 'office-1',
        type: 'revenue',
        filters: [],
        date_range: { preset: 'this_quarter' },
        chart_type: 'donut',
        order_direction: 'desc',
      });

      expect(result.columns.find(c => c.key === 'amount')).toBeDefined();
    });

    it('executes a lead_conversion report', async () => {
      const supabase = createMockSupabase({
        data: [
          { stage: 'enquiry' },
          { stage: 'enquiry' },
          { stage: 'qualified' },
        ],
        error: null,
      });
      const engine = new ReportEngine(supabase);

      const result = await engine.execute({
        id: 'report-3',
        office_id: 'office-1',
        type: 'lead_conversion',
        filters: [],
        date_range: { preset: 'last_90_days' },
        chart_type: 'funnel',
        order_direction: 'desc',
      });

      expect(result.rows.length).toBe(8); // 8 pipeline stages
    });

    it('returns empty result for custom type with no data', async () => {
      const supabase = createMockSupabase({ data: [], error: null });
      const engine = new ReportEngine(supabase);

      const result = await engine.execute({
        id: 'report-4',
        office_id: 'office-1',
        type: 'custom',
        filters: [],
        date_range: { preset: 'last_30_days' },
        chart_type: 'table',
        order_direction: 'desc',
      });

      expect(result.rowCount).toBe(0);
    });
  });

  describe('date range resolution', () => {
    it('resolves today correctly', async () => {
      const supabase = createMockSupabase({ data: [], error: null });
      const engine = new ReportEngine(supabase);

      // Indirectly test via execute — just ensure it doesn't throw
      const result = await engine.execute({
        id: 'report-5',
        office_id: 'office-1',
        type: 'custom',
        filters: [],
        date_range: { preset: 'today' },
        chart_type: 'table',
        order_direction: 'desc',
      });

      expect(result.generatedAt).toBeDefined();
    });

    it('resolves custom date range', async () => {
      const supabase = createMockSupabase({ data: [], error: null });
      const engine = new ReportEngine(supabase);

      const result = await engine.execute({
        id: 'report-6',
        office_id: 'office-1',
        type: 'custom',
        filters: [],
        date_range: {
          preset: 'custom',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-03-01T00:00:00.000Z',
        },
        chart_type: 'table',
        order_direction: 'desc',
      });

      expect(result.generatedAt).toBeDefined();
    });
  });
});
