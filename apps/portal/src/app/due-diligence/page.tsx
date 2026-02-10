import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Ban,
  ShieldAlert,
} from 'lucide-react';
import type {
  DueDiligenceCategory,
  DueDiligenceItemStatus,
} from '@realflow/shared';

// ── Mock data ────────────────────────────────────────────────────────
interface MockDueDiligenceItem {
  id: string;
  name: string;
  category: DueDiligenceCategory;
  status: DueDiligenceItemStatus;
  assignedTo: string;
  isBlocking: boolean;
  notes?: string;
}

const MOCK_COMPLETION = 72;

const MOCK_ITEMS: MockDueDiligenceItem[] = [
  // Legal
  {
    id: '1',
    name: 'Title search',
    category: 'legal',
    status: 'completed',
    assignedTo: 'Solicitor',
    isBlocking: false,
  },
  {
    id: '2',
    name: 'Contract review',
    category: 'legal',
    status: 'completed',
    assignedTo: 'Solicitor',
    isBlocking: false,
  },
  {
    id: '3',
    name: 'Special conditions review',
    category: 'legal',
    status: 'in_progress',
    assignedTo: 'Solicitor',
    isBlocking: true,
    notes: 'Awaiting seller response on sunset clause amendment',
  },
  {
    id: '4',
    name: 'Easement & covenant check',
    category: 'legal',
    status: 'completed',
    assignedTo: 'Solicitor',
    isBlocking: false,
  },
  // Physical
  {
    id: '5',
    name: 'Building & pest inspection',
    category: 'physical',
    status: 'completed',
    assignedTo: 'Building Inspector',
    isBlocking: false,
    notes: 'Minor timber damage noted - not structural. Report uploaded.',
  },
  {
    id: '6',
    name: 'Pool safety compliance',
    category: 'physical',
    status: 'not_applicable',
    assignedTo: 'Buyers Agent',
    isBlocking: false,
  },
  {
    id: '7',
    name: 'Structural assessment',
    category: 'physical',
    status: 'completed',
    assignedTo: 'Building Inspector',
    isBlocking: false,
  },
  // Financial
  {
    id: '8',
    name: 'Finance pre-approval confirmation',
    category: 'financial',
    status: 'completed',
    assignedTo: 'Broker',
    isBlocking: false,
  },
  {
    id: '9',
    name: 'Bank valuation',
    category: 'financial',
    status: 'in_progress',
    assignedTo: 'Broker',
    isBlocking: true,
    notes: 'Valuation booked for 14 Feb. Lender expects 3-5 business days for report.',
  },
  {
    id: '10',
    name: 'Stamp duty calculation',
    category: 'financial',
    status: 'completed',
    assignedTo: 'Buyers Agent',
    isBlocking: false,
  },
  // Environmental
  {
    id: '11',
    name: 'Flood map check',
    category: 'environmental',
    status: 'completed',
    assignedTo: 'Buyers Agent',
    isBlocking: false,
  },
  {
    id: '12',
    name: 'Contaminated land register',
    category: 'environmental',
    status: 'completed',
    assignedTo: 'Solicitor',
    isBlocking: false,
  },
  {
    id: '13',
    name: 'Bushfire overlay check',
    category: 'environmental',
    status: 'not_started',
    assignedTo: 'Buyers Agent',
    isBlocking: false,
  },
  // Council
  {
    id: '14',
    name: 'Council rates search',
    category: 'council',
    status: 'completed',
    assignedTo: 'Solicitor',
    isBlocking: false,
  },
  {
    id: '15',
    name: 'Town planning check',
    category: 'council',
    status: 'issue_found',
    assignedTo: 'Buyers Agent',
    isBlocking: false,
    notes: 'Neighbouring block has DA lodged for multi-dwelling. Reviewing impact.',
  },
  {
    id: '16',
    name: 'Building approvals search',
    category: 'council',
    status: 'in_progress',
    assignedTo: 'Solicitor',
    isBlocking: false,
  },
];

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

function groupByCategory(
  items: MockDueDiligenceItem[]
): Record<string, MockDueDiligenceItem[]> {
  const grouped: Record<string, MockDueDiligenceItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  }
  return grouped;
}

export default function DueDiligencePage() {
  const grouped = groupByCategory(MOCK_ITEMS);
  const blockingItems = MOCK_ITEMS.filter(
    (item) => item.isBlocking && item.status !== 'completed'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Due Diligence</h1>
        <p className="mt-1 text-sm text-gray-500">
          42 Latrobe Terrace, Paddington QLD 4064
        </p>
      </div>

      {/* Overall progress bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Overall Completion
          </h2>
          <span className="text-2xl font-bold text-portal-600">
            {MOCK_COMPLETION}%
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-portal-500 transition-all"
            style={{ width: `${MOCK_COMPLETION}%` }}
          />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span>
            {MOCK_ITEMS.filter((i) => i.status === 'completed').length} completed
          </span>
          <span>
            {MOCK_ITEMS.filter((i) => i.status === 'in_progress').length} in progress
          </span>
          <span>
            {MOCK_ITEMS.filter((i) => i.status === 'not_started').length} not started
          </span>
          <span>
            {MOCK_ITEMS.filter((i) => i.status === 'issue_found').length} issues
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
        {Object.entries(grouped).map(([category, items]) => {
          const config =
            CATEGORY_CONFIG[category as DueDiligenceCategory];
          const completedCount = items.filter(
            (i) => i.status === 'completed' || i.status === 'not_applicable'
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
                  {completedCount}/{items.length} done
                </span>
              </div>

              {/* Items list */}
              <div className="divide-y divide-gray-50">
                {items.map((item) => {
                  const statusConfig = STATUS_CONFIG[item.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 px-5 py-3 ${
                        item.isBlocking && item.status !== 'completed'
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
                          {item.isBlocking &&
                            item.status !== 'completed' && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                                Blocking
                              </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {item.assignedTo}
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
