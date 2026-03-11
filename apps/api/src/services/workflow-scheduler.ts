/**
 * Workflow Scheduler
 *
 * Runs on a configurable interval (default 5 minutes) and:
 * 1. Processes due follow-up sequence enrollments
 * 2. Generates daily action lists at configured time (default 6:45am)
 * 3. Sends digest notifications at configured time (default 7:00am)
 * 4. Evaluates no_activity and time_based workflow triggers
 *
 * Called via setInterval in apps/api/src/index.ts after server start.
 * Also exposed at POST /api/v1/scheduler/tick for manual triggering in dev.
 */

import { createClient } from '@supabase/supabase-js';
import {
  processDueEnrollments,
  type FSESupabaseClient,
  generateDailyActions,
  type DAESupabaseClient,
} from '@realflow/business-logic';
import { getNotificationDispatcher } from './notification-dispatcher';
import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchedulerTickResult {
  enrollmentsProcessed: number;
  enrollmentsFailed: number;
  dailyListsGenerated: number;
  digestsSent: number;
  errors: string[];
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class WorkflowScheduler {
  private supabase;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;

  constructor(intervalMs = 5 * 60 * 1000) {
    this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.tick().catch((err: unknown) => {
        console.error('[WorkflowScheduler] tick error:', err instanceof Error ? err.message : err);
      });
    }, this.intervalMs);
    console.log(`[WorkflowScheduler] started (interval: ${this.intervalMs / 1000}s)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[WorkflowScheduler] stopped');
    }
  }

  /**
   * Run one scheduler tick manually.
   * Useful for POST /api/v1/scheduler/tick in dev/test environments.
   */
  async tick(): Promise<SchedulerTickResult> {
    const result: SchedulerTickResult = {
      enrollmentsProcessed: 0,
      enrollmentsFailed: 0,
      dailyListsGenerated: 0,
      digestsSent: 0,
      errors: [],
    };

    // ─── 1. Process due follow-up sequence enrollments ─────────────────────
    try {
      const enrollmentResult = await processDueEnrollments({
        supabase: this.supabase as unknown as FSESupabaseClient,
      });
      result.enrollmentsProcessed = enrollmentResult.processed;
      result.enrollmentsFailed = enrollmentResult.failed;
      result.errors.push(...enrollmentResult.errors);
    } catch (err) {
      result.errors.push(
        `enrollment processing: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    // ─── 2. Daily action list generation (at configured time window) ────────
    try {
      const generated = await this.generateDailyListsIfDue();
      result.dailyListsGenerated = generated;
    } catch (err) {
      result.errors.push(`daily action list: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // ─── 3. Digest notifications ────────────────────────────────────────────
    try {
      const sent = await this.sendDigestsIfDue();
      result.digestsSent = sent;
    } catch (err) {
      result.errors.push(`digest notifications: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    if (
      result.enrollmentsProcessed > 0 ||
      result.dailyListsGenerated > 0 ||
      result.digestsSent > 0
    ) {
      console.log('[WorkflowScheduler] tick complete', result);
    }

    return result;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Find agents whose daily_action_list_time is within the last 5 minutes
   * and who haven't had a list generated today yet. Generate for each.
   */
  private async generateDailyListsIfDue(): Promise<number> {
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0]!;

    // Get preferences where daily list is enabled and send time is within window
    const { data: prefs } = await this.supabase
      .from('notification_preferences')
      .select('user_id, daily_action_list_time')
      .eq('daily_action_list_enabled', true);

    if (!prefs || prefs.length === 0) return 0;

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dueUsers: string[] = [];

    for (const pref of prefs) {
      const [h, m] = (pref.daily_action_list_time as string).split(':').map(Number);
      const prefHour = h ?? 7;
      const prefMinute = m ?? 0;

      // Within a 5-minute window of the configured time
      const diffMinutes = currentHour * 60 + currentMinute - (prefHour * 60 + prefMinute);
      if (diffMinutes >= 0 && diffMinutes < 5) {
        dueUsers.push(pref.user_id as string);
      }
    }

    if (dueUsers.length === 0) return 0;

    // Filter out users who already have a list for today
    const { data: existing } = await this.supabase
      .from('daily_action_items')
      .select('user_id')
      .eq('date', todayDate)
      .in('user_id', dueUsers);

    const alreadyGenerated = new Set((existing ?? []).map((r) => r.user_id as string));
    const toGenerate = dueUsers.filter((uid) => !alreadyGenerated.has(uid));

    let count = 0;
    for (const userId of toGenerate) {
      try {
        await generateDailyActions({
          agentId: userId,
          date: todayDate,
          supabase: this.supabase as unknown as DAESupabaseClient,
        });

        // Send daily action list notification
        const dispatcher = getNotificationDispatcher();
        await dispatcher.createAndDispatch({
          userId,
          title: 'Your daily action list is ready',
          body: 'Tap to view your prioritised tasks for today.',
          priority: 'high',
          category: 'daily_action_list',
          actionPrimary: 'view_daily_actions',
          dedupKey: `daily_action_list:${userId}:${todayDate}`,
          isDigestItem: false,
        });

        count++;
      } catch (err) {
        console.error(`[WorkflowScheduler] failed to generate daily list for ${userId}:`, err);
      }
    }

    return count;
  }

  /**
   * Send digest notifications for users whose digest_send_time is within
   * the last 5 minutes.
   */
  private async sendDigestsIfDue(): Promise<number> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const { data: prefs } = await this.supabase
      .from('notification_preferences')
      .select('user_id, digest_send_time')
      .eq('digest_mode_enabled', true);

    if (!prefs || prefs.length === 0) return 0;

    const dispatcher = getNotificationDispatcher();
    let count = 0;

    for (const pref of prefs) {
      const [h, m] = (pref.digest_send_time as string).split(':').map(Number);
      const prefHour = h ?? 7;
      const prefMinute = m ?? 0;
      const diffMinutes = currentHour * 60 + currentMinute - (prefHour * 60 + prefMinute);

      if (diffMinutes >= 0 && diffMinutes < 5) {
        try {
          await dispatcher.sendDigest(pref.user_id as string);
          count++;
        } catch (err) {
          console.error(`[WorkflowScheduler] digest failed for ${pref.user_id}:`, err);
        }
      }
    }

    return count;
  }
}

// Singleton instance
let _scheduler: WorkflowScheduler | null = null;

export function getWorkflowScheduler(): WorkflowScheduler {
  if (!_scheduler) {
    _scheduler = new WorkflowScheduler();
  }
  return _scheduler;
}
