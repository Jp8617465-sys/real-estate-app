'use client';

import { useClientBriefs } from '@/hooks/use-client-briefs';
import { ClientBriefCard } from '@/components/buyers-agent/client-brief-card';
import type { Urgency } from '@realflow/shared';

export default function ClientBriefsClient() {
  const { data: briefs, isLoading } = useClientBriefs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Briefs</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage detailed client requirements and search criteria.
          </p>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          New Brief
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-48 rounded bg-gray-200" />
              <div className="mt-4 flex gap-1">
                <div className="h-5 w-16 rounded bg-gray-100" />
                <div className="h-5 w-16 rounded bg-gray-100" />
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3">
                <div className="h-3 w-8 rounded bg-gray-200" />
                <div className="h-5 w-20 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && briefs && briefs.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">No client briefs yet. Create one to get started.</p>
        </div>
      )}

      {!isLoading && briefs && briefs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {briefs.map((brief) => {
            const contact = brief.contact as {
              first_name: string;
              last_name: string;
            } | null;
            const clientName = contact
              ? `${contact.first_name} ${contact.last_name}`
              : 'Unknown Client';

            const budget = brief.budget as { min: number; max: number };
            const requirements = brief.requirements as {
              suburbs: Array<{ suburb: string }>;
            };
            const timeline = brief.timeline as { urgency: Urgency };
            const suburbs = (requirements?.suburbs ?? []).map(
              (s: { suburb: string }) => s.suburb,
            );

            return (
              <ClientBriefCard
                key={brief.id}
                clientName={clientName}
                budgetMin={budget?.min ?? 0}
                budgetMax={budget?.max ?? 0}
                suburbs={suburbs}
                urgency={timeline?.urgency ?? 'no_rush'}
                briefVersion={brief.brief_version as number ?? 1}
                clientSignedOff={brief.client_signed_off as boolean ?? false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
