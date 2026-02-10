'use client';

import { usePropertyMatches } from '@/hooks/use-property-matches';
import { PropertyMatchCard } from '@/components/buyers-agent/property-match-card';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { PropertyMatchStatus, MatchScoreBreakdown } from '@realflow/shared';

const STATUS_COLUMNS: { key: PropertyMatchStatus; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'sent_to_client', label: 'Sent to Client' },
  { key: 'client_interested', label: 'Interested' },
  { key: 'inspection_booked', label: 'Inspection Booked' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'rejected', label: 'Rejected' },
];

export default function PropertyMatchesClient() {
  const { data: matches, isLoading } = usePropertyMatches();
  const [viewMode, setViewMode] = useState<'kanban' | 'grid'>('kanban');

  // Group matches by status
  const matchesByStatus: Record<string, typeof matches> = {};
  for (const col of STATUS_COLUMNS) {
    matchesByStatus[col.key] = [];
  }
  if (matches) {
    for (const match of matches) {
      const status = match.status as PropertyMatchStatus;
      if (matchesByStatus[status]) {
        matchesByStatus[status]?.push(match);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Matches</h1>
          <p className="mt-1 text-sm text-gray-500">
            View matched properties across all client briefs, sorted by match score.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium',
              viewMode === 'kanban'
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            Kanban
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium',
              viewMode === 'grid'
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            Grid
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} className="w-72 shrink-0 animate-pulse rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="mt-4 space-y-3">
                <div className="h-32 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((col) => {
            const columnMatches = matchesByStatus[col.key] ?? [];
            return (
              <div
                key={col.key}
                className="flex w-80 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50"
              >
                {/* Column header */}
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 rounded-t-xl">
                  <h3 className="text-sm font-semibold text-gray-900">{col.label}</h3>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {columnMatches.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-3 p-3">
                  {columnMatches.length === 0 && (
                    <p className="py-4 text-center text-xs text-gray-400">No matches</p>
                  )}
                  {columnMatches.map((match) => {
                    const property = match.property as {
                      address_street_number: string | null;
                      address_street_name: string | null;
                      address_suburb: string | null;
                    } | null;
                    const address = property
                      ? `${property.address_street_number ?? ''} ${property.address_street_name ?? ''}, ${property.address_suburb ?? ''}`.trim()
                      : 'Unknown property';

                    return (
                      <PropertyMatchCard
                        key={match.id}
                        address={address}
                        overallScore={match.overall_score as number}
                        scoreBreakdown={match.score_breakdown as MatchScoreBreakdown}
                        status={match.status as PropertyMatchStatus}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(matches ?? []).map((match) => {
            const property = match.property as {
              address_street_number: string | null;
              address_street_name: string | null;
              address_suburb: string | null;
            } | null;
            const address = property
              ? `${property.address_street_number ?? ''} ${property.address_street_name ?? ''}, ${property.address_suburb ?? ''}`.trim()
              : 'Unknown property';

            return (
              <PropertyMatchCard
                key={match.id}
                address={address}
                overallScore={match.overall_score as number}
                scoreBreakdown={match.score_breakdown as MatchScoreBreakdown}
                status={match.status as PropertyMatchStatus}
              />
            );
          })}
          {(matches ?? []).length === 0 && (
            <div className="col-span-full rounded-xl border border-gray-200 bg-white py-12 text-center">
              <p className="text-sm text-gray-500">No property matches found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
