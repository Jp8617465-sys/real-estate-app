'use client';

import { cn } from '@/lib/utils';

// ─── Chart Skeleton ──────────────────────────────────────────────────────────

export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm',
        height,
      )}
    >
      <div className="h-4 w-32 rounded bg-gray-200" />
      <div className="mt-4 flex h-[calc(100%-2rem)] items-end gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gray-100"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Chart Container ─────────────────────────────────────────────────────────

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({
  title,
  subtitle,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data available for this period.',
  actions,
  children,
  className,
}: ChartContainerProps) {
  if (isLoading) {
    return <ChartSkeleton />;
  }

  return (
    <section
      className={cn('rounded-xl border border-gray-200 bg-white p-6 shadow-sm', className)}
      role="region"
      aria-label={title}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {isEmpty ? (
        <div className="flex min-h-[12rem] items-center justify-center">
          <p className="text-sm text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
