'use client';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Lucide icon component rendered above the heading */
  icon: React.ComponentType<{ className?: string }>;
  /** Primary heading text */
  heading: string;
  /** Supporting description */
  description: string;
  /** Optional action button or link */
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, heading, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-10 w-10 text-gray-300" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-gray-900">{heading}</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
