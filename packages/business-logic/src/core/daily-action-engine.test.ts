import { describe, it, expect, vi } from 'vitest';
import { scoreCandidate, generateDailyActions } from './daily-action-engine';
import type { DailyActionCandidate } from '@realflow/shared';

// ─── scoreCandidate ───────────────────────────────────────────────────────────

describe('scoreCandidate', () => {
  it('sums all score components', () => {
    const candidate: Omit<DailyActionCandidate, 'compositeScore' | 'subtitle'> = {
      category: 'call',
      title: 'Test',
      urgencyScore: 100,
      recencyPenalty: 50,
      deadlineProximity: 75,
      leadScore: 30,
    };
    expect(scoreCandidate(candidate)).toBe(255);
  });

  it('returns 0 when all components are 0', () => {
    const candidate: Omit<DailyActionCandidate, 'compositeScore' | 'subtitle'> = {
      category: 'general',
      title: 'Test',
      urgencyScore: 0,
      recencyPenalty: 0,
      deadlineProximity: 0,
      leadScore: 0,
    };
    expect(scoreCandidate(candidate)).toBe(0);
  });

  it('overdue urgent task scores highest', () => {
    const overdueUrgent: Omit<DailyActionCandidate, 'compositeScore' | 'subtitle'> = {
      category: 'call',
      title: 'Overdue urgent',
      urgencyScore: 100,
      recencyPenalty: 0,
      deadlineProximity: 0,
      leadScore: 0,
    };
    const dueToday: Omit<DailyActionCandidate, 'compositeScore' | 'subtitle'> = {
      category: 'call',
      title: 'Due today',
      urgencyScore: 60,
      recencyPenalty: 0,
      deadlineProximity: 0,
      leadScore: 0,
    };
    expect(scoreCandidate(overdueUrgent)).toBeGreaterThan(scoreCandidate(dueToday));
  });

  it('key date 3 days scores 75', () => {
    const candidate: Omit<DailyActionCandidate, 'compositeScore' | 'subtitle'> = {
      category: 'key_date',
      title: 'Finance approval due',
      urgencyScore: 0,
      recencyPenalty: 0,
      deadlineProximity: 75,
      leadScore: 0,
    };
    expect(scoreCandidate(candidate)).toBe(75);
  });

  it('stale contact + high lead score is prioritised', () => {
    const staleHighScore: Omit<DailyActionCandidate, 'compositeScore' | 'subtitle'> = {
      category: 'follow_up',
      title: 'Follow up Jane',
      urgencyScore: 0,
      recencyPenalty: 65,
      deadlineProximity: 0,
      leadScore: 26,
    };
    const staleLowScore: Omit<DailyActionCandidate, 'compositeScore' | 'subtitle'> = {
      category: 'follow_up',
      title: 'Follow up John',
      urgencyScore: 0,
      recencyPenalty: 50,
      deadlineProximity: 0,
      leadScore: 5,
    };
    expect(scoreCandidate(staleHighScore)).toBeGreaterThan(scoreCandidate(staleLowScore));
  });
});

// ─── generateDailyActions ─────────────────────────────────────────────────────

function makeMockSupabase(overdue = 2, keyDates = 1, staleContacts = 1) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tenDaysAgo = new Date(today);
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const tasksData = Array.from({ length: overdue }, (_, i) => ({
    id: `task-${i}`,
    title: `Overdue task ${i}`,
    type: 'call',
    priority: 'urgent',
    due_date: yesterday.toISOString(),
    contact_id: `contact-${i}`,
    transaction_id: null,
    status: 'pending',
  }));

  const keyDatesData = Array.from({ length: keyDates }, (_, i) => ({
    id: `kd-${i}`,
    title: `Finance approval ${i}`,
    type: 'finance_approval',
    due_date: threeDaysLater.toISOString(),
    transaction_id: `tx-${i}`,
    status: 'upcoming',
  }));

  const contactsData = Array.from({ length: staleContacts }, (_, i) => ({
    id: `contact-stale-${i}`,
    first_name: 'Jane',
    last_name: `Smith ${i}`,
    lead_score: 87,
    last_activity_at: tenDaysAgo.toISOString(),
    assigned_agent_id: 'agent-1',
  }));

  // Track delete call
  const deleteCalled = { value: false };
  const upsertCalled = { rows: [] as Record<string, unknown>[] };

  const makeQueryBuilder = (data: Record<string, unknown>[]) => {
    const qb = {
      select: () => qb,
      eq: () => qb,
      lte: () => qb,
      gte: () => qb,
      in: () => qb,
      order: () => qb,
      limit: () => qb,
      delete: () => {
        deleteCalled.value = true;
        return qb;
      },
      upsert: (rows: Record<string, unknown>[]) => {
        upsertCalled.rows = rows;
        return qb;
      },
      then: (resolve: (r: { data: Record<string, unknown>[]; error: null }) => void) => {
        resolve({ data, error: null });
      },
    };
    return qb;
  };

  const supabase = {
    from: (table: string) => {
      if (table === 'tasks') return makeQueryBuilder(tasksData);
      if (table === 'key_dates') return makeQueryBuilder(keyDatesData);
      if (table === 'contacts') return makeQueryBuilder(contactsData);
      if (table === 'daily_action_items') {
        return {
          ...makeQueryBuilder([]),
          delete: () => {
            deleteCalled.value = true;
            return makeQueryBuilder([]);
          },
          upsert: (rows: Record<string, unknown>[]) => {
            upsertCalled.rows = rows;
            return makeQueryBuilder([]);
          },
        };
      }
      return makeQueryBuilder([]);
    },
  };

  return { supabase, deleteCalled, upsertCalled };
}

describe('generateDailyActions', () => {
  it('returns candidates from tasks, key dates, and contacts', async () => {
    const { supabase } = makeMockSupabase(2, 1, 1);

    const result = await generateDailyActions({
      agentId: 'agent-1',
      date: new Date().toISOString().split('T')[0]!,
      supabase: supabase as Parameters<typeof generateDailyActions>[0]['supabase'],
    });

    expect(result.items.length).toBeGreaterThanOrEqual(3); // 2 tasks + 1 key date + 1 stale contact
    expect(result.totalCandidates).toBeGreaterThanOrEqual(3);
  });

  it('sorts items by composite score descending', async () => {
    const { supabase } = makeMockSupabase(3, 0, 0);

    const result = await generateDailyActions({
      agentId: 'agent-1',
      date: new Date().toISOString().split('T')[0]!,
      supabase: supabase as Parameters<typeof generateDailyActions>[0]['supabase'],
    });

    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i - 1]!.compositeScore).toBeGreaterThanOrEqual(
        result.items[i]!.compositeScore,
      );
    }
  });

  it('uses AI subtitles when aiClient provided', async () => {
    const { supabase } = makeMockSupabase(1, 0, 0);

    const aiClient = {
      generateDailyActionInsights: vi
        .fn()
        .mockResolvedValue([{ index: 1, subtitle: 'Call now — pre-approval expires in 2 days' }]),
    };

    const result = await generateDailyActions({
      agentId: 'agent-1',
      date: new Date().toISOString().split('T')[0]!,
      supabase: supabase as Parameters<typeof generateDailyActions>[0]['supabase'],
      aiClient,
    });

    expect(aiClient.generateDailyActionInsights).toHaveBeenCalledOnce();
    expect(result.items[0]?.subtitle).toBe('Call now — pre-approval expires in 2 days');
  });

  it('falls back to title as subtitle when AI unavailable', async () => {
    const { supabase } = makeMockSupabase(1, 0, 0);

    const aiClient = {
      generateDailyActionInsights: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    };

    const result = await generateDailyActions({
      agentId: 'agent-1',
      date: new Date().toISOString().split('T')[0]!,
      supabase: supabase as Parameters<typeof generateDailyActions>[0]['supabase'],
      aiClient,
    });

    expect(result.items[0]?.subtitle).toBeTruthy();
  });

  it('respects maxItems limit', async () => {
    const { supabase } = makeMockSupabase(10, 5, 5);

    const result = await generateDailyActions({
      agentId: 'agent-1',
      date: new Date().toISOString().split('T')[0]!,
      supabase: supabase as Parameters<typeof generateDailyActions>[0]['supabase'],
      maxItems: 5,
    });

    expect(result.items.length).toBeLessThanOrEqual(5);
  });

  it('returns empty items when no candidates exist', async () => {
    const { supabase } = makeMockSupabase(0, 0, 0);

    const result = await generateDailyActions({
      agentId: 'agent-1',
      date: new Date().toISOString().split('T')[0]!,
      supabase: supabase as Parameters<typeof generateDailyActions>[0]['supabase'],
    });

    expect(result.items).toHaveLength(0);
    expect(result.totalCandidates).toBe(0);
  });
});
