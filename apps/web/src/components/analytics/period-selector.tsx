'use client';

import type { AnalyticsPeriod } from '@realflow/shared';

// ─── Period Options ──────────────────────────────────────────────────────────

interface PeriodOption {
  label: string;
  value: AnalyticsPeriod;
  description: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: 'This Week', value: '7d', description: 'Last 7 days' },
  { label: 'This Month', value: '30d', description: 'Last 30 days' },
  { label: 'This Quarter', value: '90d', description: 'Last 90 days' },
  { label: 'This Year', value: 'ytd', description: 'Year to date' },
];

// ─── Period Selector ─────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div
      className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="Time period"
    >
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          aria-selected={value === option.value}
          aria-label={option.description}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
