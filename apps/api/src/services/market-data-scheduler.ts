/**
 * Market Data Scheduler
 *
 * Runs on a configurable interval (default: weekly) to refresh market
 * data for all active suburbs. Identifies suburbs from client briefs
 * and pipeline properties, then batches Domain.com.au API calls with
 * rate limiting.
 *
 * Uses a service-role Supabase client to bypass RLS for writes to
 * market_snapshots. Called via setInterval in apps/api/src/index.ts
 * after server start, alongside the WorkflowScheduler.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { MarketDataService, type BulkRefreshResult } from './market-data-service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketDataSchedulerTickResult {
  suburbsIdentified: number;
  succeeded: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class MarketDataScheduler {
  private supabase;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;
  private lastRunAt: Date | null = null;
  private isRunning = false;

  /**
   * @param intervalMs Default 7 days. Set lower in dev/test.
   */
  constructor(intervalMs = 7 * 24 * 60 * 60 * 1000) {
    this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    this.intervalMs = intervalMs;
  }

  /**
   * Start the scheduler. First tick runs immediately, then repeats
   * at the configured interval.
   */
  start(): void {
    if (this.intervalId) return;

    // Run first tick after a short delay to let the server boot
    setTimeout(() => {
      this.tick().catch((err: unknown) => {
        console.error(
          '[MarketDataScheduler] initial tick error:',
          err instanceof Error ? err.message : err,
        );
      });
    }, 30_000);

    this.intervalId = setInterval(() => {
      this.tick().catch((err: unknown) => {
        console.error(
          '[MarketDataScheduler] tick error:',
          err instanceof Error ? err.message : err,
        );
      });
    }, this.intervalMs);

    console.log(
      `[MarketDataScheduler] started (interval: ${Math.round(this.intervalMs / 3_600_000)}h)`,
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MarketDataScheduler] stopped');
    }
  }

  /**
   * Run one scheduler tick manually.
   * Exposed at POST /api/v1/scheduler/market-data-tick for manual triggering.
   */
  async tick(): Promise<MarketDataSchedulerTickResult> {
    // Guard against overlapping ticks
    if (this.isRunning) {
      console.log('[MarketDataScheduler] skipping tick — previous run still in progress');
      return {
        suburbsIdentified: 0,
        succeeded: 0,
        failed: 0,
        errors: ['Skipped: previous tick still running'],
        durationMs: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const service = new MarketDataService(this.supabase, {
        cacheTtlMs: 0, // No cache for scheduled refreshes — always fetch fresh
      });

      // 1. Identify active suburbs
      const activeSuburbs = await service.getActiveSuburbs();

      if (activeSuburbs.length === 0) {
        console.log('[MarketDataScheduler] no active suburbs found — skipping');
        return {
          suburbsIdentified: 0,
          succeeded: 0,
          failed: 0,
          errors: [],
          durationMs: Date.now() - startTime,
        };
      }

      console.log(
        `[MarketDataScheduler] refreshing ${activeSuburbs.length} suburbs (house + unit)`,
      );

      // 2. Build queries for both house and unit property types
      const allQueries = [
        ...activeSuburbs,
        ...activeSuburbs.map((q) => ({ ...q, propertyType: 'unit' as const })),
      ];

      // 3. Batch fetch with rate limiting (1 second between calls for scheduler)
      const result: BulkRefreshResult = await service.bulkFetchAndUpsert(allQueries, {
        delayMs: 1000,
      });

      // 4. Collect errors from failed results
      for (const r of result.results) {
        if (!r.success && r.error) {
          errors.push(`${r.suburb} ${r.state} (${r.propertyType}): ${r.error}`);
        }
      }

      this.lastRunAt = new Date();

      const tickResult: MarketDataSchedulerTickResult = {
        suburbsIdentified: activeSuburbs.length,
        succeeded: result.succeeded,
        failed: result.failed,
        errors,
        durationMs: Date.now() - startTime,
      };

      console.log(
        `[MarketDataScheduler] tick complete: ${result.succeeded}/${result.total} succeeded in ${tickResult.durationMs}ms`,
      );

      return tickResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Fatal: ${message}`);
      console.error('[MarketDataScheduler] tick fatal error:', message);

      return {
        suburbsIdentified: 0,
        succeeded: 0,
        failed: 0,
        errors,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get information about the scheduler state.
   */
  getStatus(): { running: boolean; lastRunAt: string | null; intervalMs: number } {
    return {
      running: this.intervalId !== null,
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      intervalMs: this.intervalMs,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _scheduler: MarketDataScheduler | null = null;

export function getMarketDataScheduler(): MarketDataScheduler {
  if (!_scheduler) {
    _scheduler = new MarketDataScheduler();
  }
  return _scheduler;
}
