'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyAddress {
  address_street_number?: string;
  address_street?: string;
  address_suburb?: string;
  address_state?: string;
  address_postcode?: string;
}

interface PriceChangeRow {
  id: string;
  property_id: string | null;
  domain_listing_id: string;
  previous_price: number | null;
  new_price: number;
  change_percent: number | null;
  change_type: 'reduction' | 'increase' | 'price_guide_set';
  notified_agent_ids: string[];
  detected_at: string;
  properties?: PropertyAddress | null;
}

interface PriceChangesResponse {
  data: PriceChangeRow[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

function formatAUD(value: number | null): string {
  if (value === null) return '—';
  return aud.format(value);
}

function formatDateAU(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function buildAddress(property?: PropertyAddress | null): string {
  if (!property) return 'Unknown address';
  const parts = [
    property.address_street_number,
    property.address_street,
    property.address_suburb,
    property.address_state,
    property.address_postcode,
  ].filter(Boolean);
  return parts.join(' ') || 'Unknown address';
}

function changeLabel(type: PriceChangeRow['change_type']): string {
  if (type === 'reduction') return 'Price Reduced';
  if (type === 'increase') return 'Price Increased';
  return 'Price Set';
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse items-start gap-4 px-5 py-4">
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-gray-200" />
            <div className="h-3 w-64 rounded bg-gray-100" />
          </div>
          <div className="h-5 w-20 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// ─── Change Type Badge ────────────────────────────────────────────────────────

function ChangeBadge({ type }: { type: PriceChangeRow['change_type'] }) {
  const styles: Record<PriceChangeRow['change_type'], string> = {
    reduction: 'bg-green-100 text-green-700 border-green-200',
    increase: 'bg-red-100 text-red-700 border-red-200',
    price_guide_set: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[type]}`}>
      {changeLabel(type)}
    </span>
  );
}

// ─── Change Row ───────────────────────────────────────────────────────────────

function PriceChangeRowItem({ change }: { change: PriceChangeRow }) {
  const isReduction = change.change_type === 'reduction';
  const percentDisplay =
    change.change_percent !== null
      ? `${isReduction ? '' : '+'}${change.change_percent.toFixed(2)}%`
      : null;

  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
      {/* Icon */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          isReduction
            ? 'bg-green-100 text-green-600'
            : change.change_type === 'increase'
            ? 'bg-red-100 text-red-600'
            : 'bg-blue-100 text-blue-600'
        }`}
      >
        {isReduction ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : change.change_type === 'increase' ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        )}
      </div>

      {/* Address + prices */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {buildAddress(change.properties)}
        </p>
        <p className="mt-0.5 text-sm text-gray-500">
          {change.previous_price !== null ? (
            <>
              <span className="line-through">{formatAUD(change.previous_price)}</span>
              {' → '}
            </>
          ) : null}
          <span className="font-semibold text-gray-900">{formatAUD(change.new_price)}</span>
          {percentDisplay && (
            <span
              className={`ml-1.5 font-medium ${
                isReduction ? 'text-green-600' : 'text-red-600'
              }`}
            >
              ({percentDisplay})
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">{formatDateAU(change.detected_at)}</p>
      </div>

      {/* Badge + brief count */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <ChangeBadge type={change.change_type} />
        {change.notified_agent_ids.length > 0 && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
            {change.notified_agent_ids.length} brief{change.notified_agent_ids.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PriceChangesClient() {
  const [changes, setChanges] = useState<PriceChangeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChanges = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });

      const res = await fetch(`${API_BASE}/api/v1/domain/price-changes?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as PriceChangesResponse;
      setChanges(json.data ?? []);
      setTotal(json.total);
      setOffset(page * PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load price changes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChanges(0);
  }, [fetchChanges]);

  const currentPage = Math.floor(offset / PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Changes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Domain.com.au price alerts across your matched suburbs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchChanges(currentPage)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && <Skeleton />}

      {/* Empty state */}
      {!isLoading && changes.length === 0 && !error && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <svg
            className="mx-auto h-10 w-10 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No price changes in the last 7 days</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && changes.length > 0 && (
        <>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {changes.map((change) => (
              <PriceChangeRowItem key={change.id} change={change} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} changes
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void fetchChanges(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => void fetchChanges(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
