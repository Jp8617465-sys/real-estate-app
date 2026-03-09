'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { KeyDateStatus } from '@realflow/shared';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const STATUS_CONFIG: Record<
  KeyDateStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    dotColor: string;
    lineColor: string;
    textColor: string;
    bgColor: string;
  }
> = {
  upcoming: {
    label: 'Upcoming',
    icon: Circle,
    dotColor: 'bg-blue-500',
    lineColor: 'bg-blue-200',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  due_soon: {
    label: 'Due Soon',
    icon: Clock,
    dotColor: 'bg-amber-500',
    lineColor: 'bg-amber-200',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
  },
  overdue: {
    label: 'Overdue',
    icon: AlertCircle,
    dotColor: 'bg-red-500',
    lineColor: 'bg-red-200',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    dotColor: 'bg-green-500',
    lineColor: 'bg-green-200',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface TimelineStepProps {
  label: string;
  date: string;
  status: KeyDateStatus;
  isCritical: boolean;
  notes: string | null;
  isLast: boolean;
  /** Stagger delay index for entrance animation */
  index?: number;
}

export function TimelineStep({
  label,
  date,
  status,
  isCritical,
  notes,
  isLast,
  index = 0,
}: TimelineStepProps) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const days = daysUntil(date);
  const reduced = useReducedMotion();

  const content = (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      {/* Timeline line */}
      {!isLast && (
        <div
          className={`absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5 ${config.lineColor}`}
          aria-hidden="true"
        />
      )}

      {/* Timeline dot */}
      <div
        className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.dotColor}`}
        aria-hidden="true"
      >
        <StatusIcon className="h-4 w-4 text-white" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{label}</h3>
                {isCritical && (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                    Critical
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{formatDate(date)}</p>
            </div>
            <div className="flex items-center gap-2">
              {status !== 'completed' && (
                <span className="text-xs text-gray-400">
                  {days > 0
                    ? `in ${days} day${days !== 1 ? 's' : ''}`
                    : days === 0
                      ? 'Today'
                      : `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`}
                </span>
              )}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}
              >
                {config.label}
              </span>
            </div>
          </div>
          {notes && <p className="mt-2 text-sm text-gray-600">{notes}</p>}
        </div>
      </div>
    </div>
  );

  if (reduced) return content;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: index * 0.07 }}
    >
      {content}
    </motion.div>
  );
}
