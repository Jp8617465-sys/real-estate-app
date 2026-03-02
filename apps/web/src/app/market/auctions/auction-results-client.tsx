'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuctionOutcome = 'sold' | 'passed_in' | 'withdrawn' | 'sold_prior';

interface AuctionResultRow {
  id: string;
  property_id: string | null;
  domain_listing_id: string | null;
  suburb: string;
  postcode: string | null;
  state: string | null;
  auction_date: string;
  result: AuctionOutcome;
  sold_price: number | null;
  reserve_price: number | null;
  registered_bidders: number | null;
  agent_name: string | null;
  agency_name: string | null;
  created_at: string;
}

interface AuctionResultsResponse {
  data: AuctionResultRow[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const PAGE_SIZE = 20;

const RESULT_STYLES: Record<AuctionOutcome, { label: string; className: string }> = {
  sold: { label: 'Sold', className: 'bg-green-100 text-green-700 border-green-200' },
  passed_in: { label: 'Passed In', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  withdrawn: { label: 'Withdrawn', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  sold_prior: { label: 'Sold Prior', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

function formatAUD(value: number | null): string {
  if (value === null) return '—';
  return aud.format(value);
}

function formatDateAU(dateStr: string): string {
  // auction_date is a DATE column — plain yyyy-MM-dd
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="grid grid-cols-5 gap-4">
          {[120, 80, 80, 100, 100].map((w, i) => (
            <div key={i} className={`h-3 w-${w} rounded bg-gray-200`} />
          ))}
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border-b border-gray-100 px-5 py-4">
          <div className="grid grid-cols-5 gap-4">
            {[80, 60, 70, 90, 80].map((w, j) => (
              <div key={j} className={`h-4 rounded bg-gray-100`} style={{ width: `${w}px` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Result Badge ─────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: AuctionOutcome }) {
  const { label, className } = RESULT_STYLES[result];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuctionResultsClient() {
  const [rows, setRows] = useState<AuctionResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suburbFilter, setSuburbFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(
    async (page: number, suburb: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(page * PAGE_SIZE),
        });
        if (suburb.trim()) params.set('suburb', suburb.trim());

        const res = await fetch(
          `${API_BASE}/api/v1/domain/auction-results?${params.toString()}`,
          { credentials: 'include' },
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as AuctionResultsResponse;
        setRows(json.data ?? []);
        setTotal(json.total);
        setOffset(page * PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load auction results');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Initial fetch
  useEffect(() => {
    void fetchResults(0, '');
  }, [fetchResults]);

  // Debounced suburb filter
  const handleSuburbChange = (value: string) => {
    setSuburbFilter(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchResults(0, value);
    }, 400);
  };

  const currentPage = Math.floor(offset / PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auction Results</h1>
          <p className="mt-1 text-sm text-gray-500">
            Recent Domain.com.au auction outcomes across your target suburbs.
          </p>
        </div>

        {/* Suburb filter */}
        <div className="relative w-full sm:w-64">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
            />
          </svg>
          <input
            type="text"
            placeholder="Filter by suburb..."
            value={suburbFilter}
            onChange={(e) => handleSuburbChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && <TableSkeleton />}

      {/* Empty */}
      {!isLoading && rows.length === 0 && !error && (
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
              d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
            />
          </svg>
          <p className="mt-3 text-sm text-gray-500">
            {suburbFilter ? `No auction results for "${suburbFilter}"` : 'No auction results found'}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Suburb',
                    'Date',
                    'Result',
                    'Sold Price',
                    'Reserve',
                    'Bidders',
                    'Agent / Agency',
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-900">{row.suburb}</p>
                      {row.postcode && (
                        <p className="text-xs text-gray-400">
                          {row.state} {row.postcode}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-gray-600">
                      {formatDateAU(row.auction_date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <ResultBadge result={row.result} />
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                      {formatAUD(row.sold_price)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {formatAUD(row.reserve_price)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {row.registered_bidders ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.agent_name ? (
                        <p className="text-sm text-gray-700">{row.agent_name}</p>
                      ) : null}
                      {row.agency_name ? (
                        <p className="text-xs text-gray-400">{row.agency_name}</p>
                      ) : null}
                      {!row.agent_name && !row.agency_name && (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} results
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void fetchResults(currentPage - 1, suburbFilter)}
                  disabled={currentPage === 0}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => void fetchResults(currentPage + 1, suburbFilter)}
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
