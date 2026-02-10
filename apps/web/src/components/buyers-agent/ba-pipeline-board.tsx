'use client';

import { cn } from '@/lib/utils';
import { usePipelineTransactions } from '@/hooks/use-pipeline';
import {
  BUYERS_AGENT_STAGE_LABELS,
  BUYERS_AGENT_STAGE_DESCRIPTIONS,
  type BuyersAgentStage,
} from '@realflow/shared';
import { useState } from 'react';

interface TransactionCard {
  id: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    lead_score: number | null;
  } | null;
  property: {
    id: string;
    address_street_number: string | null;
    address_street_name: string | null;
    address_suburb: string | null;
  } | null;
  current_stage: string;
  updated_at: string;
}

function StageTooltip({ description }: { description: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Stage description"
      >
        ?
      </button>
      {show && (
        <div className="absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-lg">
          {description}
        </div>
      )}
    </div>
  );
}

function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-yellow-500' : score >= 25 ? 'bg-blue-500' : 'bg-gray-300';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} />;
}

export function BaPipelineBoard() {
  const { data: transactions, isLoading } = usePipelineTransactions('buyers-agent');

  const stages = Object.entries(BUYERS_AGENT_STAGE_LABELS) as [BuyersAgentStage, string][];

  const cardsByStage: Record<string, TransactionCard[]> = {};
  for (const [key] of stages) {
    cardsByStage[key] = [];
  }

  if (transactions) {
    for (const txn of transactions) {
      const stage = txn.current_stage;
      if (cardsByStage[stage]) {
        cardsByStage[stage].push(txn as TransactionCard);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(([key]) => (
          <div key={key} className="w-72 shrink-0 animate-pulse rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="mt-4 space-y-3">
              <div className="h-16 rounded bg-gray-200" />
              <div className="h-16 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map(([key, label]) => {
        const cards = cardsByStage[key] ?? [];
        const description = BUYERS_AGENT_STAGE_DESCRIPTIONS[key];
        return (
          <div
            key={key}
            className="flex w-72 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50"
          >
            {/* Stage header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 rounded-t-xl">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
                <StageTooltip description={description} />
              </div>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 p-3">
              {cards.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400">No clients</p>
              )}
              {cards.map((card) => {
                const contactName = card.contact
                  ? `${card.contact.first_name} ${card.contact.last_name}`
                  : 'Unknown';
                const propertyAddress = card.property
                  ? `${card.property.address_street_number ?? ''} ${card.property.address_street_name ?? ''}, ${card.property.address_suburb ?? ''}`.trim()
                  : null;
                return (
                  <div
                    key={card.id}
                    className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{contactName}</span>
                      {card.contact?.lead_score != null && (
                        <ScoreIndicator score={card.contact.lead_score} />
                      )}
                    </div>
                    {propertyAddress && (
                      <p className="mt-1 text-xs text-gray-500">{propertyAddress}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
