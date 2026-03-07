'use client';

import { cn } from '@/lib/utils';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function MetricCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-24 rounded bg-gray-200" />
      <div className="mt-3 h-8 w-20 rounded bg-gray-300" />
      <div className="mt-2 h-3 w-32 rounded bg-gray-200" />
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string | null;
  trend?: {
    value: number;
    label: string;
  } | null;
  icon?: React.ReactNode;
  accentColor?: 'brand' | 'green' | 'red' | 'amber' | 'blue';
}

const accentStyles: Record<string, { border: string; bg: string; text: string }> = {
  brand: {
    border: 'border-brand-200',
    bg: 'bg-brand-50',
    text: 'text-brand-700',
  },
  green: {
    border: 'border-green-200',
    bg: 'bg-green-50',
    text: 'text-green-700',
  },
  red: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  blue: {
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  accentColor,
}: MetricCardProps) {
  const accent = accentColor ? accentStyles[accentColor] : null;

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
        accent ? accent.border : 'border-gray-200',
        accent && accent.bg,
      )}
    >
      <div className="flex items-start justify-between">
        <p
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            accent ? accent.text : 'text-gray-500',
          )}
        >
          {title}
        </p>
        {icon && (
          <span className="text-gray-400" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          'mt-2 text-3xl font-bold',
          accent ? accent.text : 'text-gray-900',
        )}
      >
        {value}
      </p>

      {(subtitle || trend) && (
        <div className="mt-1 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                'text-sm font-medium',
                trend.value > 0 && 'text-green-600',
                trend.value < 0 && 'text-red-600',
                trend.value === 0 && 'text-gray-500',
              )}
              aria-label={`Trend: ${trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'no change'} ${Math.abs(trend.value)}%`}
            >
              {trend.value > 0 ? '+' : ''}
              {trend.value}%
            </span>
          )}
          {subtitle && (
            <span className="text-sm text-gray-500">{subtitle}</span>
          )}
          {trend && !subtitle && (
            <span className="text-sm text-gray-500">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
