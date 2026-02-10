'use client';

export const dynamic = 'force-dynamic';

import { StatCard } from '@/components/dashboard/stat-card';
import { BaPipelineBoard } from '@/components/buyers-agent/ba-pipeline-board';
import { usePipelineTransactions } from '@/hooks/use-pipeline';
import { usePropertyMatches } from '@/hooks/use-property-matches';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
  BUYERS_AGENT_STAGE_LABELS,
  type BuyersAgentStage,
} from '@realflow/shared';

export default function BuyersAgentDashboardPage() {
  const { data: transactions } = usePipelineTransactions('buyers-agent');
  const { data: recentMatches } = usePropertyMatches();

  // Compute stage counts
  const stageCounts: Record<string, number> = {};
  const stages = Object.keys(BUYERS_AGENT_STAGE_LABELS) as BuyersAgentStage[];
  for (const stage of stages) {
    stageCounts[stage] = 0;
  }
  if (transactions) {
    for (const txn of transactions) {
      const stage = txn.current_stage;
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++;
      }
    }
  }

  const activeClients = transactions?.length ?? 0;
  const engagedClients = (stageCounts['engaged'] ?? 0) +
    (stageCounts['strategy-brief'] ?? 0) +
    (stageCounts['active-search'] ?? 0) +
    (stageCounts['offer-negotiate'] ?? 0);
  const underContract = stageCounts['under-contract'] ?? 0;
  const newEnquiries = stageCounts['enquiry'] ?? 0;

  const topMatches = (recentMatches ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buyers Agent</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your buyer clients from enquiry to settlement.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Clients"
          value={String(activeClients)}
          change={`${newEnquiries} new enquiries`}
          changeType={newEnquiries > 0 ? 'positive' : 'neutral'}
        />
        <StatCard
          title="Engaged Clients"
          value={String(engagedClients)}
          change="Signed & active"
          changeType="neutral"
        />
        <StatCard
          title="Under Contract"
          value={String(underContract)}
          change="Progressing to settlement"
          changeType={underContract > 0 ? 'positive' : 'neutral'}
        />
        <StatCard
          title="Property Matches"
          value={String(topMatches.length)}
          change="Recent matches"
          changeType="neutral"
        />
      </div>

      {/* Pipeline Board */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Pipeline Overview</h2>
        <BaPipelineBoard />
      </div>

      {/* Recent Matches & Key Dates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Property Matches */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Property Matches</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {topMatches.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No recent matches</p>
            )}
            {topMatches.map((match) => {
              const property = match.property as {
                address_street_number: string | null;
                address_street_name: string | null;
                address_suburb: string | null;
              } | null;
              const address = property
                ? `${property.address_street_number ?? ''} ${property.address_street_name ?? ''}, ${property.address_suburb ?? ''}`.trim()
                : 'Unknown property';
              const score = match.overall_score as number;
              const scoreColor =
                score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-500';

              return (
                <div key={match.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm text-gray-900">{address}</p>
                    <p className="text-xs text-gray-400">
                      {formatRelativeTime(match.updated_at as string)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${scoreColor}`}>{score}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Clients per Stage</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {stages.map((stage) => (
              <div key={stage} className="flex items-center justify-between px-6 py-3">
                <span className="text-sm text-gray-700">{BUYERS_AGENT_STAGE_LABELS[stage]}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {stageCounts[stage]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
