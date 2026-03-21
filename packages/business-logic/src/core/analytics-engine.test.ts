import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsEngine } from './analytics-engine';
import type { AnalyticsPeriod } from '@realflow/shared';

// ─── Supabase Mock Factory ────────────────────────────────────────────────────

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'eq',
    'neq',
    'gte',
    'lte',
    'in',
    'not',
    'order',
    'limit',
    'single',
    'upsert',
    'insert',
    'update',
  ];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // Terminal promise
  (chain as { then: unknown }).then = undefined;
  Object.assign(chain, resolvedValue);
  return chain;
}

function makeSupabase(fromImpl: (table: string) => unknown) {
  return { from: vi.fn().mockImplementation(fromImpl) };
}

// ─── periodToDateRange ────────────────────────────────────────────────────────

describe('AnalyticsEngine.periodToDateRange', () => {
  it('returns a range exactly 7 days for "7d"', () => {
    const { from, to } = AnalyticsEngine.periodToDateRange('7d');
    const diffMs = to.getTime() - from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it('returns a range exactly 30 days for "30d"', () => {
    const { from, to } = AnalyticsEngine.periodToDateRange('30d');
    const diffMs = to.getTime() - from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('returns a range exactly 90 days for "90d"', () => {
    const { from, to } = AnalyticsEngine.periodToDateRange('90d');
    const diffMs = to.getTime() - from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(90, 0);
  });

  it('returns Jan 1 of current year for "ytd"', () => {
    const { from } = AnalyticsEngine.periodToDateRange('ytd');
    expect(from.getMonth()).toBe(0);
    expect(from.getDate()).toBe(1);
    expect(from.getHours()).toBe(0);
  });

  it('"ytd" to date is approximately now', () => {
    const { to } = AnalyticsEngine.periodToDateRange('ytd');
    const now = Date.now();
    expect(Math.abs(to.getTime() - now)).toBeLessThan(5000);
  });
});

// ─── getPipelineVelocity ──────────────────────────────────────────────────────

describe('AnalyticsEngine.getPipelineVelocity', () => {
  const agentId = '00000000-0000-0000-0000-000000000001';

  it('returns empty array when DB error occurs', async () => {
    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    expect(result).toEqual([]);
  });

  it('returns empty array when no rows exist', async () => {
    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    expect(result).toEqual([]);
  });

  it('maps view rows to PipelineVelocity shape', async () => {
    const rows = [
      {
        agent_id: agentId,
        pipeline_type: 'buyers_agent',
        stage: 'lead',
        active_count: 10,
        avg_days_in_stage: 3.5,
        new_30d: 4,
      },
      {
        agent_id: agentId,
        pipeline_type: 'buyers_agent',
        stage: 'brief',
        active_count: 6,
        avg_days_in_stage: 7,
        new_30d: 2,
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    expect(result).toHaveLength(2);
    expect(result[0].stage).toBe('lead');
    expect(result[0].activeCount).toBe(10);
    expect(result[0].avgDaysInStage).toBe(3.5);
    expect(result[0].new30d).toBe(4);
    expect(result[0].pipelineType).toBe('buyers_agent');
  });

  it('computes conversionRate as ratio of next-to-current count', async () => {
    const rows = [
      {
        agent_id: agentId,
        pipeline_type: 'buyers_agent',
        stage: 'lead',
        active_count: 10,
        avg_days_in_stage: 2,
        new_30d: 0,
      },
      {
        agent_id: agentId,
        pipeline_type: 'buyers_agent',
        stage: 'brief',
        active_count: 5,
        avg_days_in_stage: 2,
        new_30d: 0,
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    // lead → brief: 5/10 = 50%
    expect(result[0].conversionRate).toBe(50);
    // brief (last stage): 0%
    expect(result[1].conversionRate).toBe(0);
  });

  it('caps conversionRate at 100', async () => {
    const rows = [
      {
        agent_id: agentId,
        pipeline_type: 'buyers_agent',
        stage: 'lead',
        active_count: 2,
        avg_days_in_stage: 1,
        new_30d: 0,
      },
      {
        agent_id: agentId,
        pipeline_type: 'buyers_agent',
        stage: 'brief',
        active_count: 10,
        avg_days_in_stage: 1,
        new_30d: 0,
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    expect(result[0].conversionRate).toBe(100);
  });
});

// ─── getAgentPerformance ──────────────────────────────────────────────────────

describe('AnalyticsEngine.getAgentPerformance', () => {
  const agentId = '00000000-0000-0000-0000-000000000002';

  function buildSupabase(overrides: Partial<Record<string, unknown[]>>) {
    const defaults: Record<string, unknown[]> = {
      users: [{ first_name: 'Jane', last_name: 'Smith' }],
      transactions_completed: [],
      transactions_active: [],
      invoices: [],
      messages: [],
      inspections: [],
      offers: [],
      ...overrides,
    };

    let callIndex = 0;
    const callMap = [
      () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: defaults.users[0] ?? null, error: null }),
      }),
      () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: defaults.transactions_completed, error: null }),
      }),
      () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: defaults.transactions_active, error: null }),
      }),
      () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: defaults.invoices, error: null }),
      }),
      () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: defaults.messages, error: null }),
      }),
      () => ({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: defaults.inspections, error: null }),
      }),
      () => ({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: defaults.offers, error: null }),
      }),
    ];

    return makeSupabase(() => {
      const fn = callMap[callIndex % callMap.length];
      callIndex++;
      return fn();
    });
  }

  it('returns zeros for an agent with no data', async () => {
    const supabase = buildSupabase({});
    const result = await AnalyticsEngine.getAgentPerformance(agentId, '30d', supabase as never);

    expect(result.dealsSettled).toBe(0);
    expect(result.dealsInProgress).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.messagesSent).toBe(0);
    expect(result.inspectionsDone).toBe(0);
    expect(result.offerConversionRate).toBe(0);
    expect(result.avgResponseTimeMinutes).toBeNull();
  });

  it('correctly sums paid invoice amounts as totalRevenue', async () => {
    const supabase = buildSupabase({
      invoices: [
        { id: '1', type: 'retainer', amount: 2000, status: 'paid', paid_date: '2026-01-15' },
        { id: '2', type: 'success_fee', amount: 15000, status: 'paid', paid_date: '2026-01-20' },
      ],
    });

    const result = await AnalyticsEngine.getAgentPerformance(agentId, '30d', supabase as never);
    expect(result.totalRevenue).toBe(17000);
  });

  it('calculates avgDealValue as totalRevenue / dealsSettled', async () => {
    const supabase = buildSupabase({
      transactions_completed: [{ id: 't1', status: 'completed', updated_at: '2026-01-10' }],
      invoices: [
        { id: '1', type: 'success_fee', amount: 20000, status: 'paid', paid_date: '2026-01-20' },
      ],
    });

    const result = await AnalyticsEngine.getAgentPerformance(agentId, '30d', supabase as never);
    expect(result.dealsSettled).toBe(1);
    expect(result.avgDealValue).toBe(20000);
  });

  it('computes offerConversionRate as accepted/total * 100', async () => {
    const supabase = buildSupabase({
      offers: [
        { id: 'o1', status: 'accepted' },
        { id: 'o2', status: 'accepted' },
        { id: 'o3', status: 'rejected' },
        { id: 'o4', status: 'pending' },
      ],
    });

    const result = await AnalyticsEngine.getAgentPerformance(agentId, '30d', supabase as never);
    expect(result.offerConversionRate).toBe(50); // 2/4 = 50%
  });

  it('returns agentId and period in the response', async () => {
    const supabase = buildSupabase({});
    const result = await AnalyticsEngine.getAgentPerformance(agentId, '7d', supabase as never);
    expect(result.agentId).toBe(agentId);
    expect(result.period).toBe('7d');
  });

  it('builds agentName from user profile', async () => {
    const supabase = buildSupabase({ users: [{ first_name: 'John', last_name: 'Doe' }] });
    const result = await AnalyticsEngine.getAgentPerformance(agentId, '30d', supabase as never);
    expect(result.agentName).toBe('John Doe');
  });
});

// ─── getMarketInsights ────────────────────────────────────────────────────────

describe('AnalyticsEngine.getMarketInsights', () => {
  it('returns empty array for empty suburbs list', async () => {
    const supabase = makeSupabase(() => ({}));
    const result = await AnalyticsEngine.getMarketInsights([], supabase as never);
    expect(result).toEqual([]);
  });

  it('returns empty array on DB error', async () => {
    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB fail' } }),
    }));

    const result = await AnalyticsEngine.getMarketInsights(['Bondi'], supabase as never);
    expect(result).toEqual([]);
  });

  it('maps DB rows to MarketInsight shape', async () => {
    const rows = [
      {
        suburb: 'Bondi',
        postcode: '2026',
        state: 'NSW',
        property_type: 'house',
        median_sale_price: 2500000,
        median_days_on_market: 22,
        clearance_rate: 78.5,
        price_change_1y_percent: 4.2,
        snapshot_date: '2026-02-01',
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getMarketInsights(['Bondi'], supabase as never);
    expect(result).toHaveLength(1);
    expect(result[0].suburb).toBe('Bondi');
    expect(result[0].medianSalePrice).toBe(2500000);
    expect(result[0].clearanceRate).toBe(78.5);
    expect(result[0].priceChange1yPercent).toBe(4.2);
  });

  it('deduplicates rows keeping only the latest per suburb+type', async () => {
    const rows = [
      {
        suburb: 'Bondi',
        postcode: '2026',
        state: 'NSW',
        property_type: 'house',
        median_sale_price: 2600000,
        median_days_on_market: 20,
        clearance_rate: 80,
        price_change_1y_percent: 5,
        snapshot_date: '2026-02-01',
      },
      {
        suburb: 'Bondi',
        postcode: '2026',
        state: 'NSW',
        property_type: 'house',
        median_sale_price: 2500000,
        median_days_on_market: 22,
        clearance_rate: 78,
        price_change_1y_percent: 4,
        snapshot_date: '2026-01-01',
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getMarketInsights(['Bondi'], supabase as never);
    expect(result).toHaveLength(1);
    expect(result[0].medianSalePrice).toBe(2600000);
  });

  it('handles null price fields gracefully', async () => {
    const rows = [
      {
        suburb: 'Newtown',
        postcode: '2042',
        state: 'NSW',
        property_type: 'unit',
        median_sale_price: null,
        median_days_on_market: null,
        clearance_rate: null,
        price_change_1y_percent: null,
        snapshot_date: '2026-02-01',
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getMarketInsights(['Newtown'], supabase as never);
    expect(result[0].medianSalePrice).toBeNull();
    expect(result[0].clearanceRate).toBeNull();
  });
});

// ─── getRevenueForecast ───────────────────────────────────────────────────────

describe('AnalyticsEngine.getRevenueForecast', () => {
  const agentId = '00000000-0000-0000-0000-000000000003';

  function buildRevenueSupabase(opts: {
    invoices?: unknown[];
    referralFees?: unknown[];
    feeStructures?: unknown[];
  }) {
    let callIndex = 0;
    const callMap = [
      () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: opts.invoices ?? [], error: null }),
      }),
      () => ({
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: opts.referralFees ?? [], error: null }),
      }),
      () => ({
        select: vi.fn().mockResolvedValue({ data: opts.feeStructures ?? [], error: null }),
      }),
    ];

    return makeSupabase(() => {
      const fn = callMap[callIndex % callMap.length];
      callIndex++;
      return fn();
    });
  }

  it('returns all zeros when no data exists', async () => {
    const supabase = buildRevenueSupabase({});
    const result = await AnalyticsEngine.getRevenueForecast(agentId, '30d', supabase as never);
    expect(result.earnedRevenue).toBe(0);
    expect(result.pipelineValue).toBe(0);
    expect(result.forecastRevenue).toBe(0);
    expect(result.retainerFees).toBe(0);
    expect(result.successFees).toBe(0);
    expect(result.referralFees).toBe(0);
  });

  it('separates retainer and success fees correctly', async () => {
    const supabase = buildRevenueSupabase({
      invoices: [
        { id: '1', type: 'retainer', amount: 3000, status: 'paid', paid_date: '2026-01-10' },
        { id: '2', type: 'success_fee', amount: 18000, status: 'paid', paid_date: '2026-01-20' },
      ],
    });

    const result = await AnalyticsEngine.getRevenueForecast(agentId, '30d', supabase as never);
    expect(result.retainerFees).toBe(3000);
    expect(result.successFees).toBe(18000);
    expect(result.earnedRevenue).toBe(21000);
  });

  it('sums referral fees from referral_fees table', async () => {
    const supabase = buildRevenueSupabase({
      referralFees: [
        { id: 'r1', amount: 1500, paid_date: '2026-01-05' },
        { id: 'r2', amount: 2500, paid_date: '2026-01-12' },
      ],
    });

    const result = await AnalyticsEngine.getRevenueForecast(agentId, '30d', supabase as never);
    expect(result.referralFees).toBe(4000);
  });

  it('computes forecastRevenue = earned + pipelineValue * 0.4', async () => {
    const supabase = buildRevenueSupabase({
      invoices: [
        { id: '1', type: 'success_fee', amount: 10000, status: 'paid', paid_date: '2026-01-01' },
      ],
      feeStructures: [
        {
          id: 'fs1',
          success_fee_type: 'flat',
          success_fee_flat_amount: 20000,
          success_fee_percentage: null,
        },
      ],
    });

    const result = await AnalyticsEngine.getRevenueForecast(agentId, '30d', supabase as never);
    expect(result.earnedRevenue).toBe(10000);
    expect(result.pipelineValue).toBe(20000);
    expect(result.forecastRevenue).toBe(10000 + 20000 * 0.4);
  });

  it('returns the period on the result', async () => {
    const supabase = buildRevenueSupabase({});
    const result = await AnalyticsEngine.getRevenueForecast(agentId, 'ytd', supabase as never);
    expect(result.period).toBe('ytd');
  });
});

// ─── getDashboardSnapshot ─────────────────────────────────────────────────────

describe('AnalyticsEngine.getDashboardSnapshot', () => {
  const agentId = '00000000-0000-0000-0000-000000000004';

  it('returns a DashboardSnapshot with all required keys', async () => {
    // Provide minimal mocked responses for each table call
    let call = 0;
    const supabase = makeSupabase((table: string) => {
      call++;
      // client_briefs (suburb extraction)
      if (table === 'client_briefs' && call === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      // pipeline_funnel_stats
      if (table === 'pipeline_funnel_stats') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      // users
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { first_name: 'Test', last_name: 'Agent' },
            error: null,
          }),
        };
      }
      // market_data_snapshots
      if (table === 'market_data_snapshots') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      // Default: return empty data for all other tables
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        then: undefined,
        data: [],
        error: null,
        [Symbol.toPrimitive]: undefined,
      };
    });

    // Patch the resolved values on the chain termination
    const patchedSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const base = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'client_briefs') {
          base.limit = vi.fn().mockResolvedValue({ data: [], error: null });
          base.eq = vi.fn().mockReturnThis();
        } else if (table === 'pipeline_funnel_stats') {
          base.eq = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === 'users') {
          base.single = vi.fn().mockResolvedValue({
            data: { first_name: 'Test', last_name: 'Agent' },
            error: null,
          });
        } else if (table === 'market_data_snapshots') {
          base.order = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === 'fee_structures') {
          // fee_structures query terminates at select() with no further chaining
          base.select = vi.fn().mockResolvedValue({ data: [], error: null });
        } else {
          // transactions, invoices, messages, inspections, offers, referral_fees
          base.lte = vi.fn().mockResolvedValue({ data: [], error: null });
          base.order = vi.fn().mockResolvedValue({ data: [], error: null });
        }

        return base;
      }),
    };

    const result = await AnalyticsEngine.getDashboardSnapshot(
      agentId,
      '30d',
      patchedSupabase as never,
    );

    expect(result).toHaveProperty('pipelineVelocity');
    expect(result).toHaveProperty('agentPerformance');
    expect(result).toHaveProperty('marketInsights');
    expect(result).toHaveProperty('revenue');
    expect(result).toHaveProperty('generatedAt');
    expect(Array.isArray(result.pipelineVelocity)).toBe(true);
    expect(Array.isArray(result.marketInsights)).toBe(true);
    expect(typeof result.generatedAt).toBe('string');
  });

  it('generatedAt is a valid ISO datetime string', async () => {
    const patchedSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const base = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };
        if (table === 'client_briefs') {
          base.limit = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === 'pipeline_funnel_stats') {
          base.eq = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === 'users') {
          base.single = vi.fn().mockResolvedValue({
            data: { first_name: 'A', last_name: 'B' },
            error: null,
          });
        } else if (table === 'market_data_snapshots') {
          base.order = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === 'fee_structures') {
          base.select = vi.fn().mockResolvedValue({ data: [], error: null });
        } else {
          base.lte = vi.fn().mockResolvedValue({ data: [], error: null });
        }
        return base;
      }),
    };

    const result = await AnalyticsEngine.getDashboardSnapshot(
      agentId,
      '7d',
      patchedSupabase as never,
    );
    expect(() => new Date(result.generatedAt)).not.toThrow();
    expect(new Date(result.generatedAt).getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('AnalyticsEngine edge cases', () => {
  it('getAgentPerformance: avgDealValue defaults to totalRevenue when dealsSettled=0', async () => {
    const agentId = '00000000-0000-0000-0000-000000000005';
    let callIndex = 0;
    const callResults = [
      { data: { first_name: 'Edge', last_name: 'Case' }, error: null },
      { data: [], error: null }, // completed txns
      { data: [], error: null }, // active txns
      {
        data: [
          { id: '1', type: 'success_fee', amount: 5000, status: 'paid', paid_date: '2026-01-01' },
        ],
        error: null,
      }, // invoices
      { data: [], error: null }, // messages
      { data: [], error: null }, // inspections
      { data: [], error: null }, // offers
    ];

    const supabase = makeSupabase(() => {
      const result = callResults[callIndex] ?? { data: [], error: null };
      callIndex++;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue(result),
        single: vi.fn().mockResolvedValue(result),
      };
    });

    const perf = await AnalyticsEngine.getAgentPerformance(agentId, '30d', supabase as never);
    expect(perf.dealsSettled).toBe(0);
    // avgDealValue = totalRevenue / max(0, 1) = 5000 / 1 = 5000
    expect(perf.avgDealValue).toBe(5000);
  });

  it('getRevenueForecast: percentage-based fee structures use 1.5% fallback correctly', async () => {
    const agentId = '00000000-0000-0000-0000-000000000006';
    let callIndex = 0;
    const callResults = [
      { data: [], error: null }, // invoices
      { data: [], error: null }, // referral_fees
      {
        data: [
          {
            id: 'fs1',
            success_fee_type: 'percentage',
            success_fee_flat_amount: null,
            success_fee_percentage: 1.5,
          },
        ],
        error: null,
      }, // fee_structures
    ];

    const supabase = makeSupabase(() => {
      const result = callResults[callIndex] ?? { data: [], error: null };
      const index = callIndex;
      callIndex++;
      if (index === 2) {
        // fee_structures: query terminates at select() with no further chaining
        return { select: vi.fn().mockResolvedValue(result) };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue(result),
      };
    });

    const forecast = await AnalyticsEngine.getRevenueForecast(agentId, '30d', supabase as never);
    // 1.5% of $850,000 = $12,750
    expect(forecast.pipelineValue).toBe(12750);
    expect(forecast.forecastRevenue).toBeCloseTo(12750 * 0.4, 0);
  });

  it('getPipelineVelocity: unknown pipeline_type defaults to buyers_agent', async () => {
    const agentId = '00000000-0000-0000-0000-000000000007';
    const rows = [
      {
        agent_id: agentId,
        pipeline_type: 'unknown_type',
        stage: 'stage_a',
        active_count: 3,
        avg_days_in_stage: 1,
        new_30d: 1,
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    expect(result[0].pipelineType).toBe('buyers_agent');
  });

  it('getMarketInsights: multiple suburbs returns one entry per suburb+type combination', async () => {
    const rows = [
      {
        suburb: 'Bondi',
        postcode: '2026',
        state: 'NSW',
        property_type: 'house',
        median_sale_price: 2500000,
        median_days_on_market: 20,
        clearance_rate: 80,
        price_change_1y_percent: 5,
        snapshot_date: '2026-02-01',
      },
      {
        suburb: 'Manly',
        postcode: '2095',
        state: 'NSW',
        property_type: 'unit',
        median_sale_price: 1200000,
        median_days_on_market: 30,
        clearance_rate: 70,
        price_change_1y_percent: 3,
        snapshot_date: '2026-02-01',
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getMarketInsights(['Bondi', 'Manly'], supabase as never);
    expect(result).toHaveLength(2);
    const suburbs = result.map((r) => r.suburb);
    expect(suburbs).toContain('Bondi');
    expect(suburbs).toContain('Manly');
  });

  it('maps unknown property_type to house', async () => {
    const rows = [
      {
        suburb: 'Pyrmont',
        postcode: '2009',
        state: 'NSW',
        property_type: 'rural', // not house/unit/townhouse
        median_sale_price: 900000,
        median_days_on_market: 25,
        clearance_rate: 65,
        price_change_1y_percent: 2.5,
        snapshot_date: '2026-02-01',
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getMarketInsights(['Pyrmont'], supabase as never);
    expect(result[0].propertyType).toBe('house');
  });
});

// ─── generateDailySnapshot ────────────────────────────────────────────────────

describe('AnalyticsEngine.generateDailySnapshot', () => {
  const agentId = '00000000-0000-0000-0000-000000000008';

  function buildDailySnapshotSupabase(opts: {
    activeClients?: number;
    newLeads?: number;
    leadsContacted?: number;
    briefsCreated?: number;
    inspections?: number;
    offers?: number;
    contracts?: number;
    settlements?: number;
    revenue?: number;
    messages?: number;
  } = {}) {
    // Build a supabase mock where every query returns reasonable counts/data
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const base = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };

        if (table === 'client_briefs') {
          // count query
          const countResult = { data: null, count: opts.activeClients ?? 3, error: null };
          base.lte = vi.fn().mockResolvedValue(countResult);
          base.eq = vi.fn().mockReturnThis();
          // head count query resolves via lte
          return {
            ...base,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue(countResult),
          };
        }

        if (table === 'contacts') {
          return {
            ...base,
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ count: opts.newLeads ?? 2, data: null, error: null }),
          };
        }

        if (table === 'messages') {
          return {
            ...base,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ count: opts.leadsContacted ?? 5, data: null, error: null }),
          };
        }

        if (table === 'inspections') {
          return {
            ...base,
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ count: opts.inspections ?? 1, data: null, error: null }),
          };
        }

        if (table === 'offers') {
          return {
            ...base,
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ count: opts.offers ?? 0, data: null, error: null }),
          };
        }

        if (table === 'transactions') {
          return {
            ...base,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ count: opts.settlements ?? 0, data: null, error: null }),
          };
        }

        if (table === 'invoices') {
          return {
            ...base,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }

        if (table === 'fee_structures') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }

        if (table === 'pipeline_funnel_stats') {
          return {
            ...base,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }

        if (table === 'analytics_daily_snapshots') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        }

        return base;
      }),
    };

    return supabase;
  }

  it('completes without throwing for a standard date', async () => {
    const supabase = buildDailySnapshotSupabase();
    const testDate = new Date('2026-03-01');

    await expect(
      AnalyticsEngine.generateDailySnapshot(agentId, testDate, supabase as never)
    ).resolves.toBeUndefined();
  });

  it('handles fee structures with flat fee type', async () => {
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const base = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockResolvedValue({ count: 0, data: null, error: null }),
          not: vi.fn().mockReturnThis(),
        };

        if (table === 'fee_structures') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 'fs1', success_fee_type: 'flat', success_fee_flat_amount: 15000, success_fee_percentage: null },
              ],
              error: null,
            }),
          };
        }

        if (table === 'invoices') {
          return {
            ...base,
            lte: vi.fn().mockResolvedValue({ data: [{ amount: 5000 }], error: null }),
          };
        }

        if (table === 'analytics_daily_snapshots') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        }

        if (table === 'pipeline_funnel_stats') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }

        return base;
      }),
    };

    await expect(
      AnalyticsEngine.generateDailySnapshot(agentId, new Date('2026-03-01'), supabase as never)
    ).resolves.toBeUndefined();
  });

  it('handles fee structures with percentage fee type', async () => {
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const base = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockResolvedValue({ count: 0, data: null, error: null }),
        };

        if (table === 'fee_structures') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 'fs2', success_fee_type: 'percentage', success_fee_flat_amount: null, success_fee_percentage: 2.0 },
              ],
              error: null,
            }),
          };
        }

        if (table === 'invoices') {
          return { ...base, lte: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }

        if (table === 'analytics_daily_snapshots') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        }

        if (table === 'pipeline_funnel_stats') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }

        return base;
      }),
    };

    await expect(
      AnalyticsEngine.generateDailySnapshot(agentId, new Date('2026-03-01'), supabase as never)
    ).resolves.toBeUndefined();
  });
});

// ─── getPipelineVelocity with seller/buyer pipeline types ─────────────────────

describe('AnalyticsEngine.getPipelineVelocity — pipeline type mapping', () => {
  const agentId = '00000000-0000-0000-0000-000000000009';

  it('accepts "seller" pipeline type', async () => {
    const rows = [
      {
        agent_id: agentId,
        pipeline_type: 'seller',
        stage: 'appraisal',
        active_count: 5,
        avg_days_in_stage: 3,
        new_30d: 2,
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    expect(result[0].pipelineType).toBe('seller');
  });

  it('accepts "buyer" pipeline type', async () => {
    const rows = [
      {
        agent_id: agentId,
        pipeline_type: 'buyer',
        stage: 'searching',
        active_count: 8,
        avg_days_in_stage: 14,
        new_30d: 3,
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    expect(result[0].pipelineType).toBe('buyer');
  });

  it('handles stages not in BUYERS_AGENT_STAGE_ORDER sorted alphabetically', async () => {
    const rows = [
      {
        agent_id: agentId,
        pipeline_type: 'seller',
        stage: 'zzz_custom',
        active_count: 3,
        avg_days_in_stage: null,
        new_30d: 1,
      },
      {
        agent_id: agentId,
        pipeline_type: 'seller',
        stage: 'aaa_stage',
        active_count: 7,
        avg_days_in_stage: 2,
        new_30d: 0,
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    expect(result).toHaveLength(2);
    // Alphabetically sorted: aaa_stage comes before zzz_custom
    expect(result[0].stage).toBe('aaa_stage');
    expect(result[1].stage).toBe('zzz_custom');
    // Last stage has 0 conversionRate, zero avgDaysInStage when null
    expect(result[1].avgDaysInStage).toBe(0);
  });

  it('handles mixed ordered/unordered stages in buyers_agent pipeline', async () => {
    const rows = [
      {
        agent_id: agentId,
        pipeline_type: 'buyers_agent',
        stage: 'custom_unknown_stage',
        active_count: 2,
        avg_days_in_stage: 1,
        new_30d: 0,
      },
      {
        agent_id: agentId,
        pipeline_type: 'buyers_agent',
        stage: 'lead',
        active_count: 10,
        avg_days_in_stage: 3,
        new_30d: 5,
      },
    ];

    const supabase = makeSupabase(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));

    const result = await AnalyticsEngine.getPipelineVelocity(agentId, supabase as never);
    // 'lead' is at index 0 in BUYERS_AGENT_STAGE_ORDER, 'custom_unknown_stage' is -1 so goes last
    expect(result[0].stage).toBe('lead');
    expect(result[1].stage).toBe('custom_unknown_stage');
  });
});
