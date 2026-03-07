'use client';

import { cn } from '@/lib/utils';
import type { AmlCheckStatus } from '@realflow/shared';

interface VerificationStatusBadgeProps {
  status: AmlCheckStatus | string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  not_started: {
    label: 'Not Started',
    className: 'bg-gray-100 text-gray-700 ring-gray-200',
  },
  pending: {
    label: 'Pending',
    className: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  in_review: {
    label: 'In Review',
    className: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  },
  passed: {
    label: 'Verified',
    className: 'bg-green-50 text-green-700 ring-green-200',
  },
  verified: {
    label: 'Verified',
    className: 'bg-green-50 text-green-700 ring-green-200',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 ring-red-200',
  },
  expired: {
    label: 'Expired',
    className: 'bg-orange-50 text-orange-700 ring-orange-200',
  },
  waived: {
    label: 'Waived',
    className: 'bg-purple-50 text-purple-700 ring-purple-200',
  },
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700 ring-gray-200',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  acknowledged: {
    label: 'Acknowledged',
    className: 'bg-green-50 text-green-700 ring-green-200',
  },
};

export function VerificationStatusBadge({ status, size = 'md' }: VerificationStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-700 ring-gray-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1 ring-inset',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-xs',
        config.className,
      )}
      role="status"
      aria-label={`Verification status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
