'use client';

export const dynamic = 'force-dynamic';

import { usePipelineTransactions } from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';

interface TransactionWithContact {
  id: string;
  current_stage: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  property: {
    id: string;
    address_street_number: string | null;
    address_street_name: string | null;
    address_suburb: string | null;
  } | null;
}

export default function DueDiligencePage() {
  const { data: transactions, isLoading } = usePipelineTransactions('buyers-agent');

  // Filter to transactions in due-diligence-relevant stages
  const ddTransactions = (transactions ?? []).filter((txn) => {
    const stage = txn.current_stage;
    return stage === 'offer-negotiate' || stage === 'under-contract';
  }) as TransactionWithContact[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Due Diligence</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track due diligence checklists for clients under contract or in negotiation.
          </p>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Generate Checklist
        </button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
              <div className="h-4 w-48 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-32 rounded bg-gray-200" />
              <div className="mt-4 h-2 w-full rounded bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && ddTransactions.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">
            No clients currently in negotiation or under contract. Due diligence checklists will
            appear here when clients reach those stages.
          </p>
        </div>
      )}

      {!isLoading && ddTransactions.length > 0 && (
        <div className="space-y-4">
          {ddTransactions.map((txn) => {
            const clientName = txn.contact
              ? `${txn.contact.first_name} ${txn.contact.last_name}`
              : 'Unknown Client';
            const propertyAddress = txn.property
              ? `${txn.property.address_street_number ?? ''} ${txn.property.address_street_name ?? ''}, ${txn.property.address_suburb ?? ''}`.trim()
              : 'No property assigned';
            const isUnderContract = txn.current_stage === 'under-contract';

            return (
              <div
                key={txn.id}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{clientName}</h3>
                    <p className="mt-0.5 text-xs text-gray-500">{propertyAddress}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      isUnderContract
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700',
                    )}
                  >
                    {isUnderContract ? 'Under Contract' : 'Offer & Negotiate'}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-gray-100">
                      <div className="h-2 w-0 rounded-full bg-blue-500" />
                    </div>
                    <span className="text-xs text-gray-400">0%</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Click to view or generate due diligence checklist
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
