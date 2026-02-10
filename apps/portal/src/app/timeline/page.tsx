import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import type { KeyDateStatus } from '@realflow/shared';

// ── Mock data ────────────────────────────────────────────────────────
interface MockKeyDate {
  id: string;
  label: string;
  date: string;
  isCritical: boolean;
  status: KeyDateStatus;
  notes?: string;
}

const MOCK_KEY_DATES: MockKeyDate[] = [
  {
    id: '1',
    label: 'Contract exchange',
    date: '2026-02-05T10:00:00Z',
    isCritical: true,
    status: 'completed',
    notes: 'Contracts exchanged at $1,095,000. 21-day cooling off period applies.',
  },
  {
    id: '2',
    label: 'Building & pest inspection',
    date: '2026-02-10T09:00:00Z',
    isCritical: true,
    status: 'completed',
    notes: 'Inspection completed. Minor issues noted - not structural.',
  },
  {
    id: '3',
    label: 'Cooling off period expires',
    date: '2026-02-26T17:00:00Z',
    isCritical: true,
    status: 'due_soon',
    notes: 'Must confirm before 5pm. Solicitor to handle if we proceed.',
  },
  {
    id: '4',
    label: 'Finance approval deadline',
    date: '2026-02-28T17:00:00Z',
    isCritical: true,
    status: 'due_soon',
    notes: 'Bank valuation pending. Broker following up with lender.',
  },
  {
    id: '5',
    label: 'Deposit due (10%)',
    date: '2026-03-05T17:00:00Z',
    isCritical: true,
    status: 'upcoming',
    notes: 'Balance of deposit ($84,500) due to trust account.',
  },
  {
    id: '6',
    label: 'Pre-settlement inspection',
    date: '2026-04-01T10:00:00Z',
    isCritical: false,
    status: 'upcoming',
    notes: 'Final walkthrough to confirm property condition.',
  },
  {
    id: '7',
    label: 'Settlement',
    date: '2026-04-07T14:00:00Z',
    isCritical: true,
    status: 'upcoming',
    notes: 'Target settlement date. Keys handover same day.',
  },
];

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function TimelinePage() {
  const criticalUpcoming = MOCK_KEY_DATES.filter(
    (d) => d.isCritical && (d.status === 'due_soon' || d.status === 'overdue')
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Key Dates</h1>
        <p className="mt-1 text-sm text-gray-500">
          42 Latrobe Terrace, Paddington QLD 4064
        </p>
      </div>

      {/* Critical dates alert */}
      {criticalUpcoming.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold text-amber-800">
              {criticalUpcoming.length} Critical Date{criticalUpcoming.length !== 1 ? 's' : ''} Approaching
            </h2>
          </div>
          <div className="mt-2 space-y-1">
            {criticalUpcoming.map((d) => {
              const days = daysUntil(d.date);
              return (
                <p key={d.id} className="text-sm text-amber-700">
                  <span className="font-medium">{d.label}</span> —{' '}
                  {days > 0
                    ? `${days} day${days !== 1 ? 's' : ''} away`
                    : days === 0
                      ? 'Today'
                      : `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Vertical timeline */}
      <div className="relative">
        {MOCK_KEY_DATES.map((keyDate, index) => {
          const config = STATUS_CONFIG[keyDate.status];
          const StatusIcon = config.icon;
          const isLast = index === MOCK_KEY_DATES.length - 1;
          const days = daysUntil(keyDate.date);

          return (
            <div key={keyDate.id} className="relative flex gap-4 pb-8 last:pb-0">
              {/* Timeline line */}
              {!isLast && (
                <div
                  className={`absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5 ${config.lineColor}`}
                />
              )}

              {/* Timeline dot */}
              <div
                className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.dotColor}`}
              >
                <StatusIcon className="h-4 w-4 text-white" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {keyDate.label}
                        </h3>
                        {keyDate.isCritical && (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                            Critical
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {formatDate(keyDate.date)} at {formatTime(keyDate.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {keyDate.status !== 'completed' && (
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
                  {keyDate.notes && (
                    <p className="mt-2 text-sm text-gray-600">{keyDate.notes}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
