'use client';

import { AlertTriangle, Calendar, CheckCircle2 } from 'lucide-react';
import type { BuyersAgentStage } from '@realflow/shared';
import { BUYERS_AGENT_STAGE_LABELS, BUYERS_AGENT_STAGE_ORDER } from '@realflow/shared';
import { usePortalDashboard } from '@/hooks/use-portal-dashboard';
import { useTimeline } from '@/hooks/use-timeline';
import { LoadingSpinner } from '@/components/loading-spinner';
import { EmptyState } from '@/components/empty-state';
import { TimelineStep } from '@/components/timeline-step';

const ALL_STAGES = Object.entries(BUYERS_AGENT_STAGE_ORDER)
  .sort(([, a], [, b]) => a - b)
  .map(([stage]) => stage as BuyersAgentStage);

/** Milestone events mapped to stages */
const MILESTONES: Array<{
  stage: BuyersAgentStage;
  label: string;
  description: string;
}> = [
  {
    stage: 'enquiry',
    label: 'Initial Enquiry',
    description: 'You reached out to your buyers agent.',
  },
  {
    stage: 'consult-qualify',
    label: 'Discovery Consultation',
    description: 'Understanding your needs and qualifying the engagement.',
  },
  {
    stage: 'engaged',
    label: 'Engagement Signed',
    description: 'Agreement signed and retainer paid.',
  },
  {
    stage: 'strategy-brief',
    label: 'Brief Submitted',
    description: 'Full property brief completed and search strategy activated.',
  },
  {
    stage: 'active-search',
    label: 'First Shortlist',
    description: 'Properties are being sourced and inspected on your behalf.',
  },
  {
    stage: 'offer-negotiate',
    label: 'Offer Made',
    description: 'Making offers or bidding at auction.',
  },
  {
    stage: 'under-contract',
    label: 'Under Contract',
    description: 'Contracts exchanged. Due diligence and settlement underway.',
  },
  {
    stage: 'settled-nurture',
    label: 'Settlement Complete',
    description: 'Congratulations! Property settled successfully.',
  },
];

function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function ProgressPage() {
  const { data: dashboard, isLoading: isDashboardLoading } = usePortalDashboard();
  const { data: keyDates, isLoading: isTimelineLoading } = useTimeline();

  const isLoading = isDashboardLoading || isTimelineLoading;

  if (isLoading) {
    return <LoadingSpinner message="Loading your progress..." />;
  }

  const currentStage: BuyersAgentStage = dashboard?.currentStage ?? 'enquiry';
  const currentStageIndex = ALL_STAGES.indexOf(currentStage);
  const dates = keyDates ?? [];

  const criticalUpcoming = dates.filter(
    (d) => d.is_critical && (d.status === 'due_soon' || d.status === 'overdue'),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Progress</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your property search journey from enquiry to settlement.
        </p>
      </div>

      {/* Critical dates alert */}
      {criticalUpcoming.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <h2 className="font-semibold text-amber-800">
              {criticalUpcoming.length} Critical Date{criticalUpcoming.length !== 1 ? 's' : ''}{' '}
              Approaching
            </h2>
          </div>
          <div className="mt-2 space-y-1">
            {criticalUpcoming.map((d) => {
              const days = daysUntil(d.date);
              return (
                <p key={d.id} className="text-sm text-amber-700">
                  <span className="font-medium">{d.label}</span> --{' '}
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

      {/* Visual milestone journey */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Journey Milestones
        </h2>
        <div className="mt-6 space-y-0">
          {MILESTONES.map((milestone, index) => {
            const stageIndex = ALL_STAGES.indexOf(milestone.stage);
            const isCompleted = stageIndex < currentStageIndex;
            const isCurrent = stageIndex === currentStageIndex;
            const isLast = index === MILESTONES.length - 1;

            return (
              <div key={milestone.stage} className="relative flex gap-4 pb-8 last:pb-0">
                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={`absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5 ${
                      isCompleted ? 'bg-green-300' : isCurrent ? 'bg-portal-200' : 'bg-gray-200'
                    }`}
                    aria-hidden="true"
                  />
                )}

                {/* Stage indicator */}
                <div
                  className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isCompleted
                      ? 'bg-green-500'
                      : isCurrent
                        ? 'bg-portal-600 ring-4 ring-portal-100'
                        : 'bg-gray-200'
                  }`}
                  aria-label={`${milestone.label}${
                    isCompleted ? ' - completed' : isCurrent ? ' - current' : ' - upcoming'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-white" aria-hidden="true" />
                  ) : (
                    <span
                      className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3
                    className={`font-semibold ${
                      isCompleted
                        ? 'text-green-700'
                        : isCurrent
                          ? 'text-portal-700'
                          : 'text-gray-400'
                    }`}
                  >
                    {milestone.label}
                  </h3>
                  <p
                    className={`mt-0.5 text-sm ${
                      isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {milestone.description}
                  </p>
                  {isCurrent && (
                    <span className="mt-2 inline-flex rounded-full bg-portal-100 px-2.5 py-0.5 text-xs font-medium text-portal-700">
                      Current Stage: {BUYERS_AGENT_STAGE_LABELS[currentStage]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Dates Timeline */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Key Dates
        </h2>
        {dates.length === 0 ? (
          <EmptyState
            icon={Calendar}
            heading="No key dates yet"
            description="Key dates will appear here once your transaction is active."
          />
        ) : (
          <div className="relative">
            {dates.map((keyDate, index) => (
              <TimelineStep
                key={keyDate.id}
                label={keyDate.label}
                date={keyDate.date}
                status={keyDate.status}
                isCritical={keyDate.is_critical}
                notes={keyDate.notes}
                isLast={index === dates.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
