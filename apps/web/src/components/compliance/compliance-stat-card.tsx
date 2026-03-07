'use client';

import { cn } from '@/lib/utils';

interface ComplianceStatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  subtitle?: string;
}

export function ComplianceStatCard({
  title,
  value,
  icon,
  variant = 'default',
  subtitle,
}: ComplianceStatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p
            className={cn(
              'mt-2 text-3xl font-bold',
              variant === 'default' && 'text-gray-900',
              variant === 'success' && 'text-green-600',
              variant === 'warning' && 'text-yellow-600',
              variant === 'danger' && 'text-red-600',
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            variant === 'default' && 'bg-gray-100 text-gray-600',
            variant === 'success' && 'bg-green-100 text-green-600',
            variant === 'warning' && 'bg-yellow-100 text-yellow-600',
            variant === 'danger' && 'bg-red-100 text-red-600',
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
