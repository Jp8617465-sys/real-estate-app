'use client';

import { cn } from '@/lib/utils';
import { BUYER_STAGE_LABELS, type BuyerStage } from '@realflow/shared';

interface PipelineCard {
  id: string;
  name: string;
  budget: string;
  score: number;
  lastActivity: string;
}

const stageCards: Record<string, PipelineCard[]> = {
  'new-enquiry': [
    { id: '1', name: 'Tom Richards', budget: '$600K-$800K', score: 20, lastActivity: '1h ago' },
    { id: '2', name: 'Amy Foster', budget: '$900K-$1.1M', score: 15, lastActivity: '3h ago' },
  ],
  'qualified-lead': [
    { id: '3', name: 'Priya Patel', budget: '$500K-$750K', score: 45, lastActivity: '3d ago' },
  ],
  'active-search': [
    { id: '4', name: 'Michael Johnson', budget: '$800K-$1.2M', score: 82, lastActivity: '2h ago' },
  ],
  'property-shortlisted': [
    { id: '5', name: 'Lisa Nguyen', budget: '$1.5M-$2M', score: 90, lastActivity: '1d ago' },
  ],
  'due-diligence': [],
  'offer-made': [],
  'under-contract': [
    { id: '6', name: 'Mark Stevens', budget: '$1.1M', score: 95, lastActivity: '2d ago' },
  ],
  'settled': [],
};

function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-yellow-500' : score >= 25 ? 'bg-blue-500' : 'bg-gray-300';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} />;
}

export function PipelineBoard() {
  const stages = Object.entries(BUYER_STAGE_LABELS) as [BuyerStage, string][];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map(([key, label]) => {
        const cards = stageCards[key] ?? [];
        return (
          <div
            key={key}
            className="flex w-72 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50"
          >
            {/* Stage header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 rounded-t-xl">
              <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 p-3">
              {cards.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400">No contacts</p>
              )}
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{card.name}</span>
                    <ScoreIndicator score={card.score} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{card.budget}</p>
                  <p className="mt-1 text-xs text-gray-400">{card.lastActivity}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
