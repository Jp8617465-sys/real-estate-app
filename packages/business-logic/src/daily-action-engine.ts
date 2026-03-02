/**
 * Daily Action Engine
 *
 * Generates a prioritised action list for a buyers agent by:
 * 1. Querying overdue/due-today tasks, upcoming key dates, and stale contacts
 *    (all three queries run in parallel via Promise.all)
 * 2. Scoring each candidate using the priority matrix
 * 3. Taking the top 20 candidates to Claude for "why now" subtitle generation
 * 4. Persisting the ranked list to daily_action_items
 */

import type { DailyActionCandidate } from '@realflow/shared';

// ─── Supabase client interface (minimal, matches workflow-engine pattern) ──────

interface QueryBuilder {
  select: (cols: string) => QueryBuilder;
  eq: (col: string, val: unknown) => QueryBuilder;
  lte: (col: string, val: unknown) => QueryBuilder;
  gte: (col: string, val: unknown) => QueryBuilder;
  in: (col: string, vals: unknown[]) => QueryBuilder;
  order: (col: string, opts?: { ascending: boolean }) => QueryBuilder;
  limit: (n: number) => QueryBuilder;
  upsert: (data: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) => QueryBuilder;
  delete: () => QueryBuilder;
  then: (resolve: (result: { data: unknown[] | null; error: { message: string } | null }) => void) => void;
}

export interface DAESupabaseClient {
  from: (table: string) => QueryBuilder;
}

// ─── AI client interface (optional — gracefully degrades) ─────────────────────

export interface DAEAIClient {
  generateDailyActionInsights: (
    candidates: Array<{
      category: string;
      title: string;
      contactName?: string;
      daysOverdue?: number;
      daysUntilDeadline?: number;
      compositeScore: number;
    }>,
  ) => Promise<Array<{ index: number; subtitle: string }>>;
}

// ─── Scoring constants ────────────────────────────────────────────────────────

const SCORE = {
  OVERDUE_URGENT: 100,
  OVERDUE_HIGH: 80,
  DUE_TODAY: 60,
  KEY_DATE_3_DAYS: 75,
  FINANCE_EXPIRY_5_DAYS: 70,
  NO_CONTACT_14_DAYS: 65,
  NO_CONTACT_7_DAYS: 50,
  AI_URGENCY_IMMEDIATE: 50,
  AI_URGENCY_HIGH: 35,
  PROPERTY_MATCH_HIGH: 40,
  DD_INCOMPLETE_NEAR_SETTLEMENT: 60,
} as const;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateDailyActionsOptions {
  agentId: string;
  date: string; // ISO date string YYYY-MM-DD
  supabase: DAESupabaseClient;
  aiClient?: DAEAIClient;
  maxItems?: number;
}

export interface DailyActionResult {
  items: DailyActionCandidate[];
  totalCandidates: number;
  generatedAt: string;
}

/**
 * Score a candidate based on its signal components.
 * Pure function — no side effects.
 */
export function scoreCandidate(candidate: Omit<DailyActionCandidate, 'compositeScore' | 'subtitle'>): number {
  return candidate.urgencyScore + candidate.recencyPenalty + candidate.deadlineProximity + candidate.leadScore;
}

/**
 * Generate the daily action list for an agent.
 *
 * Steps:
 * 1. Query overdue/due-today tasks, upcoming key dates, and stale contacts in parallel
 * 2. Score all candidates
 * 3. Take top `maxItems` (default 20) to AI for subtitles
 * 4. Persist to daily_action_items (upsert by user_id + date + rank)
 */
export async function generateDailyActions(opts: GenerateDailyActionsOptions): Promise<DailyActionResult> {
  const { agentId, date, supabase, aiClient, maxItems = 20 } = opts;
  const candidates: DailyActionCandidate[] = [];
  const today = new Date(date);
  const todayISO = today.toISOString();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  // ─── 1–3. Fetch all candidates in parallel ────────────────────────────────
  const [tasksResult, keyDatesResult, staleResult] = await Promise.all([
    new Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>(
      (resolve) => {
        supabase
          .from('tasks')
          .select('id, title, type, priority, due_date, contact_id, transaction_id, status')
          .eq('is_deleted', false)
          .in('status', ['pending', 'in-progress'])
          .eq('assigned_to', agentId)
          .lte('due_date', todayISO)
          .order('due_date', { ascending: true })
          .limit(50)
          .then(resolve as Parameters<QueryBuilder['then']>[0]);
      },
    ),
    new Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>(
      (resolve) => {
        supabase
          .from('key_dates')
          .select('id, title, type, due_date, transaction_id, status')
          .eq('is_deleted', false)
          .in('status', ['upcoming', 'due_soon'])
          .gte('due_date', todayISO)
          .lte('due_date', sevenDaysLater.toISOString())
          .order('due_date', { ascending: true })
          .limit(20)
          .then(resolve as Parameters<QueryBuilder['then']>[0]);
      },
    ),
    new Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>(
      (resolve) => {
        supabase
          .from('contacts')
          .select('id, first_name, last_name, lead_score, last_activity_at, assigned_agent_id')
          .eq('is_deleted', false)
          .eq('assigned_agent_id', agentId)
          .in('type', ['buyer', 'investor'])
          .lte('last_activity_at', sevenDaysAgo.toISOString())
          .order('lead_score', { ascending: false })
          .limit(20)
          .then(resolve as Parameters<QueryBuilder['then']>[0]);
      },
    ),
  ]);

  if (tasksResult.error) console.error('[DailyActionEngine] tasks query failed:', tasksResult.error.message);
  if (keyDatesResult.error) console.error('[DailyActionEngine] key_dates query failed:', keyDatesResult.error.message);
  if (staleResult.error) console.error('[DailyActionEngine] stale contacts query failed:', staleResult.error.message);

  // ─── Process overdue & due-today tasks ───────────────────────────────────────
  if (tasksResult.data) {
    for (const task of tasksResult.data) {
      const dueDate = new Date(task.due_date as string);
      const diffMs = today.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays > 0;
      const priority = task.priority as string;

      let urgencyScore = 0;
      if (isOverdue) {
        urgencyScore = priority === 'urgent' ? SCORE.OVERDUE_URGENT : SCORE.OVERDUE_HIGH;
      } else {
        urgencyScore = SCORE.DUE_TODAY;
      }

      candidates.push({
        category: mapTaskTypeToCategory(task.type as string),
        title: task.title as string,
        contactId: task.contact_id as string | undefined,
        transactionId: task.transaction_id as string | undefined,
        taskId: task.id as string,
        urgencyScore,
        recencyPenalty: 0,
        deadlineProximity: 0,
        leadScore: 0,
        compositeScore: 0,
        subtitle: '',
      });
    }
  }

  // ─── Process upcoming key dates (≤7 days) ────────────────────────────────────
  if (keyDatesResult.data) {
    for (const kd of keyDatesResult.data) {
      const dueDate = new Date(kd.due_date as string);
      const diffMs = dueDate.getTime() - today.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const isFinanceType =
        (kd.type as string).includes('finance') || (kd.type as string).includes('pre_approval');
      let deadlineProximity = daysUntil <= 3 ? SCORE.KEY_DATE_3_DAYS : 30;
      if (isFinanceType && daysUntil <= 5) {
        deadlineProximity = SCORE.FINANCE_EXPIRY_5_DAYS;
      }

      candidates.push({
        category: 'key_date',
        title: `[Key Date] ${kd.title as string}`,
        transactionId: kd.transaction_id as string | undefined,
        urgencyScore: 0,
        recencyPenalty: 0,
        deadlineProximity,
        leadScore: 0,
        compositeScore: 0,
        subtitle: '',
      });
    }
  }

  // ─── Process stale active contacts ───────────────────────────────────────────
  if (staleResult.data) {
    for (const contact of staleResult.data) {
      const lastActivity = new Date(contact.last_activity_at as string);
      const diffMs = today.getTime() - lastActivity.getTime();
      const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const recencyPenalty = daysSince >= 14 ? SCORE.NO_CONTACT_14_DAYS : SCORE.NO_CONTACT_7_DAYS;
      const leadScorePoints = Math.round(((contact.lead_score as number) ?? 0) * 0.3);

      candidates.push({
        category: 'follow_up',
        title: `Follow up with ${contact.first_name} ${contact.last_name}`,
        contactId: contact.id as string,
        urgencyScore: 0,
        recencyPenalty,
        deadlineProximity: 0,
        leadScore: leadScorePoints,
        compositeScore: 0,
        subtitle: '',
      });
    }
  }

  // ─── 4. Score all candidates ──────────────────────────────────────────────
  for (const candidate of candidates) {
    candidate.compositeScore = scoreCandidate(candidate);
  }

  // Sort descending by composite score, take top maxItems
  candidates.sort((a, b) => b.compositeScore - a.compositeScore);
  const topCandidates = candidates.slice(0, maxItems);

  // ─── 5. AI subtitle generation ────────────────────────────────────────────
  if (aiClient && topCandidates.length > 0) {
    try {
      const insights = await aiClient.generateDailyActionInsights(
        topCandidates.map((c, i) => ({
          category: c.category,
          title: c.title,
          compositeScore: c.compositeScore,
          index: i + 1,
        })),
      );

      for (const insight of insights) {
        const idx = insight.index - 1;
        if (idx >= 0 && idx < topCandidates.length) {
          const candidate = topCandidates[idx];
          if (candidate) {
            candidate.subtitle = insight.subtitle;
          }
        }
      }
    } catch (error: unknown) {
      console.error('[DailyActionEngine] AI subtitle generation failed, using titles as fallback:', error instanceof Error ? error.message : String(error));
      for (const candidate of topCandidates) {
        if (!candidate.subtitle) {
          candidate.subtitle = candidate.title;
        }
      }
    }
  } else {
    // No AI — use title as fallback subtitle
    for (const candidate of topCandidates) {
      if (!candidate.subtitle) {
        candidate.subtitle = candidate.title;
      }
    }
  }

  // ─── 6. Persist to daily_action_items ────────────────────────────────────
  // Delete existing items for this user+date then insert fresh
  await new Promise<void>((resolve) => {
    supabase
      .from('daily_action_items')
      .delete()
      .eq('user_id', agentId)
      .eq('date', date)
      .then(() => resolve());
  });

  if (topCandidates.length > 0) {
    const rows = topCandidates.map((c, i) => ({
      user_id: agentId,
      date,
      rank: i + 1,
      category: c.category,
      title: c.title,
      subtitle: c.subtitle || c.title,
      contact_id: c.contactId ?? null,
      transaction_id: c.transactionId ?? null,
      task_id: c.taskId ?? null,
      urgency_score: c.urgencyScore,
      recency_penalty: c.recencyPenalty,
      deadline_proximity: c.deadlineProximity,
      lead_score: c.leadScore,
      composite_score: c.compositeScore,
      is_completed: false,
    }));

    await new Promise<void>((resolve) => {
      supabase
        .from('daily_action_items')
        .upsert(rows, { onConflict: 'user_id,date,rank' })
        .then(() => resolve());
    });
  }

  return {
    items: topCandidates,
    totalCandidates: candidates.length,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapTaskTypeToCategory(taskType: string): DailyActionCandidate['category'] {
  if (taskType === 'call') return 'call';
  if (taskType === 'inspection') return 'inspection';
  if (['email', 'sms', 'follow-up'].includes(taskType)) return 'follow_up';
  if (['due-diligence-check', 'document-review'].includes(taskType)) return 'document';
  if (taskType === 'pre-settlement-inspection') return 'settlement';
  if (taskType === 'brief-review') return 'document';
  if (['offer-review', 'auction-prep'].includes(taskType)) return 'offer_review';
  return 'general';
}
