'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  /** Optional message shown below the spinner */
  message?: string;
  /** Size class for the spinner icon */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20" role="status">
      <Loader2
        className={`animate-spin text-portal-500 ${SIZE_MAP[size]}`}
        aria-hidden="true"
      />
      {message ? (
        <p className="mt-3 text-sm text-gray-500">{message}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
