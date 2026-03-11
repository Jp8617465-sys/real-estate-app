'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DomainSyncStatus } from '@realflow/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncFrequency = 'nightly' | 'every_4_hours' | 'manual';

interface SyncJob {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

const FREQUENCY_OPTIONS: { value: SyncFrequency; label: string }[] = [
  { value: 'nightly', label: 'Nightly (midnight AEST)' },
  { value: 'every_4_hours', label: 'Every 4 hours' },
  { value: 'manual', label: 'Manual only' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

function formatDateAU(isoString: string | null): string {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-5 w-40 rounded bg-gray-200" />
        <div className="mt-3 h-4 w-64 rounded bg-gray-100" />
        <div className="mt-6 flex gap-3">
          <div className="h-9 w-28 rounded-lg bg-gray-200" />
          <div className="h-9 w-28 rounded-lg bg-gray-100" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-2 h-7 w-12 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DomainIntegrationClient() {
  const [status, setStatus] = useState<DomainSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeJob, setActiveJob] = useState<SyncJob | null>(null);
  const [frequency, setFrequency] = useState<SyncFrequency>('nightly');
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/domain/status`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: DomainSyncStatus };
      setStatus(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/domain/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ syncType: 'manual' }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as { data: SyncJob };
      setActiveJob(json.data);

      // Poll for job completion every 3 seconds
      const poll = setInterval(async () => {
        await fetchStatus();
        // In a real implementation we'd query the job by ID.
        // For now, re-fetch status after a delay and clear the spinner.
        setActiveJob(null);
        setIsSyncing(false);
        clearInterval(poll);
      }, 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setIsSyncing(false);
    }
  };

  const handleFrequencyChange = (value: SyncFrequency) => {
    setFrequency(value);
    // Persist to agent settings (fire-and-forget)
    void fetch(`${API_BASE}/api/v1/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ domainSyncFrequency: value }),
    });
  };

  if (isLoading) return <Skeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Domain.com.au Integration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sync listings, track price changes, and ingest auction results automatically.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Connection Status Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              status?.connected ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
          <h2 className="text-base font-semibold text-gray-900">
            {status?.connected ? 'Connected' : 'Not Connected'}
          </h2>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          {status?.connected
            ? 'OAuth2 credentials are configured and active.'
            : 'Add DOMAIN_CLIENT_ID and DOMAIN_CLIENT_SECRET to your environment to connect.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSyncNow()}
            disabled={isSyncing || !status?.connected}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Syncing...
              </>
            ) : (
              'Sync Now'
            )}
          </button>

          {activeJob && (
            <span className="inline-flex items-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
              Job {activeJob.jobId.substring(0, 8)}... running
            </span>
          )}
        </div>

        {/* Last sync info */}
        <p className="mt-4 text-xs text-gray-400">
          Last sync:{' '}
          <span className="font-medium text-gray-600">
            {formatDateAU(status?.lastSync ?? null)}
          </span>
        </p>

        {status?.nextScheduledSync && (
          <p className="mt-1 text-xs text-gray-400">
            Next scheduled:{' '}
            <span className="font-medium text-gray-600">
              {formatDateAU(status.nextScheduledSync)}
            </span>
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Listings synced" value={status?.listingsSynced ?? 0} />
        <StatCard label="Price changes (24h)" value={status?.priceChanges24h ?? 0} />
        <StatCard label="Auction results (7d)" value={status?.auctionResults7d ?? 0} />
      </div>

      {/* Auto-Sync Frequency */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Auto-Sync Schedule</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose how often RealFlow should automatically sync listings from Domain.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-4">
          {FREQUENCY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors ${
                frequency === opt.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="syncFrequency"
                value={opt.value}
                checked={frequency === opt.value}
                onChange={() => handleFrequencyChange(opt.value)}
                className="accent-brand-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Currency formatting example — for reference */}
      <p className="sr-only">{formatAUD(0)}</p>
    </div>
  );
}
