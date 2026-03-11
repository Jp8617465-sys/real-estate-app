import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Animated shimmer placeholder for loading states.
 * Respects prefers-reduced-motion via CSS.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton-shimmer rounded-md', className)} aria-hidden="true" />;
}

/** Pre-composed skeleton for a card-style block */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800',
        className,
      )}
    >
      <Skeleton className="mb-3 h-4 w-1/2" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

/** Pre-composed skeleton for a list row */
export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800',
        className,
      )}
    >
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
