'use client';

import { cn } from '@/lib/utils';
import type { EmptyStateIllustration } from '@realflow/ui';

/** Simple inline SVG illustrations keyed by type */
function Illustration({ type, width = 120 }: { type: EmptyStateIllustration; width?: number }) {
  const style = { width, height: width };

  switch (type) {
    case 'contacts':
      return (
        <svg style={style} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="40" r="22" fill="currentColor" opacity="0.12" />
          <circle cx="60" cy="40" r="14" fill="currentColor" opacity="0.2" />
          <path
            d="M20 95c0-22 18-35 40-35s40 13 40 35"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.3"
          />
        </svg>
      );
    case 'properties':
      return (
        <svg style={style} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <rect x="20" y="55" width="80" height="50" rx="4" fill="currentColor" opacity="0.1" />
          <path
            d="M10 60L60 20l50 40"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.3"
          />
          <rect x="45" y="75" width="30" height="30" rx="2" fill="currentColor" opacity="0.2" />
        </svg>
      );
    case 'pipeline':
      return (
        <svg style={style} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <rect x="10" y="30" width="22" height="70" rx="4" fill="currentColor" opacity="0.15" />
          <rect x="40" y="45" width="22" height="55" rx="4" fill="currentColor" opacity="0.2" />
          <rect x="70" y="55" width="22" height="45" rx="4" fill="currentColor" opacity="0.12" />
          <rect x="100" y="20" width="10" height="80" rx="4" fill="currentColor" opacity="0.08" />
        </svg>
      );
    case 'alerts':
      return (
        <svg style={style} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <path
            d="M60 20 L90 75 L30 75 Z"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
            fill="currentColor"
            opacity="0.1"
          />
          <line
            x1="60"
            y1="45"
            x2="60"
            y2="62"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="60" cy="70" r="2.5" fill="currentColor" />
        </svg>
      );
    case 'matches':
      return (
        <svg style={style} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle
            cx="45"
            cy="55"
            r="25"
            stroke="currentColor"
            strokeWidth="3"
            fill="currentColor"
            opacity="0.08"
          />
          <circle
            cx="75"
            cy="55"
            r="25"
            stroke="currentColor"
            strokeWidth="3"
            fill="currentColor"
            opacity="0.08"
          />
          <path d="M60 35 Q60 55 60 75" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        </svg>
      );
    case 'documents':
      return (
        <svg style={style} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <rect
            x="25"
            y="15"
            width="60"
            height="80"
            rx="6"
            fill="currentColor"
            opacity="0.1"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <line
            x1="38"
            y1="40"
            x2="82"
            y2="40"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />
          <line
            x1="38"
            y1="55"
            x2="82"
            y2="55"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />
          <line
            x1="38"
            y1="70"
            x2="62"
            y2="70"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />
        </svg>
      );
    case 'messages':
      return (
        <svg style={style} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <rect
            x="15"
            y="25"
            width="90"
            height="60"
            rx="10"
            fill="currentColor"
            opacity="0.1"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path d="M35 95 L45 80 L35 95Z" fill="currentColor" opacity="0.15" />
          <line
            x1="32"
            y1="50"
            x2="88"
            y2="50"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.25"
          />
          <line
            x1="32"
            y1="62"
            x2="68"
            y2="62"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.25"
          />
        </svg>
      );
    default:
      return (
        <svg style={style} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="40"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="currentColor"
            opacity="0.08"
          />
          <line
            x1="60"
            y1="40"
            x2="60"
            y2="65"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="60" cy="76" r="3" fill="currentColor" />
        </svg>
      );
  }
}

interface EmptyStateProps {
  illustration: EmptyStateIllustration;
  heading: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustrationWidth?: number;
  className?: string;
}

/**
 * Consistent empty state component for all list/grid views.
 * Replace generic icons with purposeful SVG illustrations.
 */
export function EmptyState({
  illustration,
  heading,
  description,
  actionLabel,
  onAction,
  illustrationWidth = 96,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center text-muted-foreground',
        className,
      )}
      role="status"
      aria-label={heading}
    >
      <Illustration type={illustration} width={illustrationWidth} />
      <h3 className="mt-5 text-base font-semibold text-foreground">{heading}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm leading-relaxed">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
