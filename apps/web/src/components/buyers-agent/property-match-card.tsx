'use client';

import { cn } from '@/lib/utils';
import type { PropertyMatchStatus, MatchScoreBreakdown } from '@realflow/shared';

interface PropertyMatchCardProps {
  address: string;
  overallScore: number;
  scoreBreakdown: MatchScoreBreakdown;
  status: PropertyMatchStatus;
  flags?: string[];
  onClick?: () => void;
}

const STATUS_LABELS: Record<PropertyMatchStatus, string> = {
  new: 'New',
  sent_to_client: 'Sent to Client',
  client_interested: 'Client Interested',
  inspection_booked: 'Inspection Booked',
  rejected: 'Rejected',
  under_review: 'Under Review',
};

const STATUS_COLORS: Record<PropertyMatchStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  sent_to_client: 'bg-purple-100 text-purple-700',
  client_interested: 'bg-green-100 text-green-700',
  inspection_booked: 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-700',
  under_review: 'bg-yellow-100 text-yellow-700',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-gray-500">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
        <div
          className={cn(
            'h-1.5 rounded-full',
            value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-400',
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs text-gray-400">{value}</span>
    </div>
  );
}

function OverallScoreBadge({ score }: { score: number }) {
  const bgColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-400';
  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white',
        bgColor,
      )}
    >
      {score}
    </div>
  );
}

export function PropertyMatchCard({
  address,
  overallScore,
  scoreBreakdown,
  status,
  flags,
  onClick,
}: PropertyMatchCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
        onClick && 'cursor-pointer',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{address}</h3>
          <div className="mt-1">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[status])}>
              {STATUS_LABELS[status]}
            </span>
          </div>
        </div>
        <OverallScoreBadge score={overallScore} />
      </div>

      {/* Score Breakdown */}
      <div className="mt-4 space-y-1.5">
        <ScoreBar label="Price" value={scoreBreakdown.priceMatch} />
        <ScoreBar label="Location" value={scoreBreakdown.locationMatch} />
        <ScoreBar label="Size" value={scoreBreakdown.sizeMatch} />
        <ScoreBar label="Features" value={scoreBreakdown.featureMatch} />
        {scoreBreakdown.investorMatch !== undefined && (
          <ScoreBar label="Investor" value={scoreBreakdown.investorMatch} />
        )}
      </div>

      {/* Flags */}
      {flags && flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 border-t border-gray-100 pt-3">
          {flags.map((flag) => (
            <span
              key={flag}
              className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
            >
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
