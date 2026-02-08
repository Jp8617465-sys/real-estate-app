import { BUYER_STAGE_LABELS, type BuyerStage } from '@realflow/shared';

const pipelineCounts: Record<string, number> = {
  'new-enquiry': 5,
  'qualified-lead': 8,
  'active-search': 6,
  'property-shortlisted': 3,
  'due-diligence': 1,
  'offer-made': 2,
  'under-contract': 3,
  'settled': 12,
};

export function PipelineOverview() {
  const stages = Object.entries(BUYER_STAGE_LABELS) as [BuyerStage, string][];
  const maxCount = Math.max(...Object.values(pipelineCounts));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Buyer Pipeline</h2>
      <p className="mt-1 text-sm text-gray-500">Contacts at each stage</p>

      <div className="mt-6 space-y-3">
        {stages.map(([key, label]) => {
          const count = pipelineCounts[key] ?? 0;
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
    </div>
  );
}
