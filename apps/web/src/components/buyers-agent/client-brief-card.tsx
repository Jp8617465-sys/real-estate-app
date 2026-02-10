'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { Urgency } from '@realflow/shared';

interface ClientBriefCardProps {
  clientName: string;
  budgetMin: number;
  budgetMax: number;
  suburbs: string[];
  urgency: Urgency;
  briefVersion: number;
  clientSignedOff: boolean;
  onClick?: () => void;
}

const URGENCY_LABELS: Record<Urgency, string> = {
  asap: 'ASAP',
  '1_3_months': '1-3 months',
  '3_6_months': '3-6 months',
  '6_12_months': '6-12 months',
  no_rush: 'No rush',
};

const URGENCY_COLORS: Record<Urgency, string> = {
  asap: 'bg-red-100 text-red-700',
  '1_3_months': 'bg-orange-100 text-orange-700',
  '3_6_months': 'bg-yellow-100 text-yellow-700',
  '6_12_months': 'bg-blue-100 text-blue-700',
  no_rush: 'bg-gray-100 text-gray-700',
};

export function ClientBriefCard({
  clientName,
  budgetMin,
  budgetMax,
  suburbs,
  urgency,
  briefVersion,
  clientSignedOff,
  onClick,
}: ClientBriefCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
        onClick && 'cursor-pointer',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{clientName}</h3>
          <p className="mt-1 text-sm text-gray-600">
            {formatCurrency(budgetMin)} &ndash; {formatCurrency(budgetMax)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', URGENCY_COLORS[urgency])}>
            {URGENCY_LABELS[urgency]}
          </span>
        </div>
      </div>

      {/* Suburbs */}
      <div className="mt-3">
        <div className="flex flex-wrap gap-1">
          {suburbs.slice(0, 4).map((suburb) => (
            <span
              key={suburb}
              className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {suburb}
            </span>
          ))}
          {suburbs.length > 4 && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              +{suburbs.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-400">v{briefVersion}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            clientSignedOff
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700',
          )}
        >
          {clientSignedOff ? 'Signed Off' : 'Pending Sign-off'}
        </span>
      </div>
    </div>
  );
}
