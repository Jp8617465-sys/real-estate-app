'use client';

import { BUYER_STAGE_LABELS, type BuyerStage } from '@realflow/shared';
import { usePipelineOverview } from '@/hooks/use-dashboard';

export function PipelineOverview() {
  const { data: pipelineCounts, isLoading } = usePipelineOverview();

  const stages = Object.entries(BUYER_STAGE_LABELS) as [BuyerStage, string][];
  const counts = pipelineCounts ?? {};
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Buyer Pipeline</h2>
      <p className="mt-1 text-sm text-gray-500">Contacts at each stage</p>

      {isLoading ? (
        <div className="mt-6 animate-pulse space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-6 rounded-full bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {stages.map(([key, label]) => {
            const count = counts[key] ?? 0;
            const width = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-36 truncate text-sm text-gray-600">{label}</span>
                <div className="flex-1">
                  <div className="h-6 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="flex h-full items-center rounded-full bg-brand-500 px-2 text-xs font-medium text-white transition-all"
                      style={{ width: `${Math.max(width, 8)}%` }}
                    >
                      {count}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
