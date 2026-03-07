'use client';

import { cn } from '@/lib/utils';
import type { PipelineVelocity } from '@realflow/shared';
import {
  BUYER_STAGE_LABELS,
  BUYER_STAGE_ORDER,
  SELLER_STAGE_LABELS,
  SELLER_STAGE_ORDER,
  BUYERS_AGENT_STAGE_LABELS,
  BUYERS_AGENT_STAGE_ORDER,
} from '@realflow/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStageLabel(stage: string, pipelineType: string): string {
  if (pipelineType === 'buyer') {
    return (BUYER_STAGE_LABELS as Record<string, string>)[stage] ?? stage;
  }
  if (pipelineType === 'seller') {
    return (SELLER_STAGE_LABELS as Record<string, string>)[stage] ?? stage;
  }
  if (pipelineType === 'buyers_agent') {
    return (BUYERS_AGENT_STAGE_LABELS as Record<string, string>)[stage] ?? stage;
  }
  return stage;
}

function getStageOrder(stage: string, pipelineType: string): number {
  if (pipelineType === 'buyer') {
    return (BUYER_STAGE_ORDER as Record<string, number>)[stage] ?? 99;
  }
  if (pipelineType === 'seller') {
    return (SELLER_STAGE_ORDER as Record<string, number>)[stage] ?? 99;
  }
  if (pipelineType === 'buyers_agent') {
    return (BUYERS_AGENT_STAGE_ORDER as Record<string, number>)[stage] ?? 99;
  }
  return 99;
}

// Gradient colors for the funnel bars — from wide (top) to narrow (bottom)
const FUNNEL_COLORS = [
  'bg-brand-400',
  'bg-brand-500',
  'bg-brand-600',
  'bg-brand-700',
  'bg-blue-500',
  'bg-blue-600',
  'bg-indigo-600',
  'bg-green-600',
];

// ─── Funnel Skeleton ─────────────────────────────────────────────────────────

export function FunnelChartSkeleton() {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-8 flex-1 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// ─── Funnel Chart ────────────────────────────────────────────────────────────

interface FunnelChartProps {
  stages: PipelineVelocity[];
  pipelineType?: string;
  isLoading?: boolean;
}

export function FunnelChart({
  stages,
  pipelineType = 'buyers_agent',
  isLoading = false,
}: FunnelChartProps) {
  if (isLoading) {
    return <FunnelChartSkeleton />;
  }

  if (stages.length === 0) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center">
        <p className="text-sm text-gray-400">
          No pipeline data available for this period.
        </p>
      </div>
    );
  }

  // Sort by canonical stage order
  const sorted = [...stages].sort((a, b) => {
    return getStageOrder(a.stage, pipelineType) - getStageOrder(b.stage, pipelineType);
  });

  const maxCount = Math.max(...sorted.map((s) => s.activeCount), 1);

  return (
    <div className="space-y-2" role="list" aria-label="Pipeline funnel">
      {sorted.map((stage, idx) => {
        const widthPct = Math.round((stage.activeCount / maxCount) * 100);
        const label = getStageLabel(stage.stage, pipelineType);
        const colorClass = FUNNEL_COLORS[idx % FUNNEL_COLORS.length];

        return (
          <div
            key={`${stage.stage}-${stage.pipelineType}`}
            className="flex items-center gap-3"
            role="listitem"
            aria-label={`${label}: ${stage.activeCount} active, ${stage.conversionRate}% conversion`}
          >
            {/* Stage label */}
            <div className="w-36 shrink-0 text-right text-xs font-medium text-gray-600">
              {label}
            </div>

            {/* Bar */}
            <div className="flex-1 overflow-hidden rounded-lg bg-gray-100" style={{ height: '28px' }}>
              <div
                className={cn(
                  'flex h-full items-center rounded-lg px-3 transition-all duration-500',
                  colorClass,
                )}
                style={{ width: `${Math.max(widthPct, 6)}%` }}
              >
                {stage.activeCount > 0 && (
                  <span className="text-xs font-semibold text-white">
                    {stage.activeCount}
                  </span>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="w-32 shrink-0 text-right text-xs text-gray-500">
              {stage.avgDaysInStage > 0 ? (
                <span>{stage.avgDaysInStage.toFixed(1)}d avg</span>
              ) : (
                <span className="text-gray-300">&mdash;</span>
              )}
              {stage.conversionRate > 0 && (
                <span className="ml-1.5 font-medium text-brand-600">
                  ({stage.conversionRate}%)
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
