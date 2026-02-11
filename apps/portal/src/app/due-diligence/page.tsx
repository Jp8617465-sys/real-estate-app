'use client';

import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Ban,
  ShieldAlert,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type {
  DueDiligenceCategory,
  DueDiligenceItemStatus,
} from '@realflow/shared';
import { usePortalDueDiligence } from '@/hooks/use-due-diligence';

const CATEGORY_CONFIG: Record<
  DueDiligenceCategory,
  { label: string; color: string }
> = {
  legal: { label: 'Legal', color: 'text-blue-600 bg-blue-50' },
  physical: { label: 'Physical', color: 'text-orange-600 bg-orange-50' },
  financial: { label: 'Financial', color: 'text-green-600 bg-green-50' },
  environmental: { label: 'Environmental', color: 'text-emerald-600 bg-emerald-50' },
  council: { label: 'Council', color: 'text-purple-600 bg-purple-50' },
  strata: { label: 'Strata', color: 'text-pink-600 bg-pink-50' },
};

const STATUS_CONFIG: Record<
  DueDiligenceItemStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  not_started: {
    label: 'Not Started',
    icon: Circle,
    className: 'text-gray-400',
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    className: 'text-portal-600',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'text-green-600',
  },
  issue_found: {
    label: 'Issue Found',
    icon: AlertTriangle,
    className: 'text-amber-600',
  },
  not_applicable: {
    label: 'N/A',
    icon: Ban,
    className: 'text-gray-300',
  },
};

interface DDItem {
  id: string;
  name: string;
  category: string;
  status: string;
  assigned_to: string;
  is_blocking: boolean;
  notes: string | null;
}

function groupByCategory(items: DDItem[]): Record<string, DDItem[]> {
  const grouped: Record<string, DDItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  }
  return grouped;
}

function formatAssignedTo(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function DueDiligencePage() {
  const { data, isLoading, error } = usePortalDueDiligence();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Unable to load due diligence</h2>
        <p className="mt-1 text-sm text-gray-500">Please try again later.</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const completion = data?.completion ?? 0;

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Due Diligence</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardIcon className="h-10 w-10 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">No due diligence items yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Due diligence tracking will appear here once you are under contract.
          </p>
        </div>
      </div>
    );
  }

  const grouped = groupByCategory(items);
  const blockingItems = items.filter(
    (item) => item.is_blocking && item.status !== 'completed',
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Due Diligence</h1>
      </div>

      {/* Overall progress bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Overall Completion
          </h2>
          <span className="text-2xl font-bold text-portal-600">
            {completion}%
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-portal-500 transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span>
            {items.filter((i) => i.status === 'completed').length} completed
          </span>
          <span>
            {items.filter((i) => i.status === 'in_progress').length} in progress
          </span>
          <span>
            {items.filter((i) => i.status === 'not_started').length} not started
          </span>
          <span>
            {items.filter((i) => i.status === 'issue_found').length} issues
          </span>
        </div>
      </div>

      {/* Blocking items alert */}
      {blockingItems.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold text-amber-800">
              {blockingItems.length} Blocking Item{blockingItems.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <div className="mt-2 space-y-2">
            {blockingItems.map((item) => (
              <div key={item.id} className="text-sm text-amber-700">
                <span className="font-medium">{item.name}</span>
                {item.notes && (
                  <span className="text-amber-600"> — {item.notes}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, categoryItems]) => {
          const config =
            CATEGORY_CONFIG[category as DueDiligenceCategory] ?? {
              label: category,
              color: 'text-gray-600 bg-gray-50',
            };
          const completedCount = categoryItems.filter(
            (i) => i.status === 'completed' || i.status === 'not_applicable',
          ).length;

          return (
            <div
              key={category}
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {/* Category header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color}`}
                  >
                    {config.label}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {completedCount}/{categoryItems.length} done
                </span>
              </div>

              {/* Items list */}
              <div className="divide-y divide-gray-50">
                {categoryItems.map((item) => {
                  const statusConfig =
                    STATUS_CONFIG[item.status as DueDiligenceItemStatus] ?? STATUS_CONFIG.not_started;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 px-5 py-3 ${
                        item.is_blocking && item.status !== 'completed'
                          ? 'bg-amber-50/50'
                          : ''
                      }`}
                    >
                      <StatusIcon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${statusConfig.className}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              item.status === 'not_applicable'
                                ? 'text-gray-400 line-through'
                                : 'text-gray-900'
                            }`}
                          >
                            {item.name}
                          </span>
                          {item.is_blocking &&
                            item.status !== 'completed' && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                                Blocking
                              </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatAssignedTo(item.assigned_to)}
                        </p>
                        {item.notes && (
                          <p className="mt-1 text-xs text-gray-500">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium ${statusConfig.className}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Simple clipboard icon for empty state
function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}
