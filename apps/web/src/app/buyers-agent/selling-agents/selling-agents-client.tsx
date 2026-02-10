'use client';

import { useSellingAgents } from '@/hooks/use-selling-agents';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function SellingAgentsClient() {
  const [suburbFilter, setSuburbFilter] = useState('');
  const { data: agents, isLoading } = useSellingAgents(suburbFilter || undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Selling Agents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Directory of selling agents you work with, filtered by suburb and relationship strength.
          </p>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Add Agent
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Filter by suburb..."
          value={suburbFilter}
          onChange={(e) => setSuburbFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="space-y-1">
                  <div className="h-4 w-32 rounded bg-gray-200" />
                  <div className="h-3 w-24 rounded bg-gray-200" />
                </div>
              </div>
              <div className="mt-4 flex gap-1">
                <div className="h-5 w-16 rounded bg-gray-100" />
                <div className="h-5 w-16 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (agents ?? []).length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">
            {suburbFilter
              ? `No selling agents found for "${suburbFilter}".`
              : 'No selling agents added yet.'}
          </p>
        </div>
      )}

      {!isLoading && (agents ?? []).length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents?.map((agent) => {
            const contact = agent.contact as {
              id: string;
              first_name: string;
              last_name: string;
              email: string | null;
              phone: string | null;
            } | null;
            const name = contact
              ? `${contact.first_name} ${contact.last_name}`
              : 'Unknown';
            const initials = contact
              ? `${contact.first_name[0]}${contact.last_name[0]}`
              : '??';
            const relationshipScore = agent.relationship_score as number | null;
            const suburbs = (agent.suburbs as string[]) ?? [];
            const tags = (agent.tags as string[]) ?? [];
            const dealsClosedWith = agent.deals_closed_with as number;
            const propertiesSent = agent.properties_sent as number;

            return (
              <div
                key={agent.id}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Agent header */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                    {agent.agency && (
                      <p className="text-xs text-gray-500 truncate">{agent.agency as string}</p>
                    )}
                  </div>
                  {relationshipScore != null && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={cn(
                            'h-3.5 w-3.5',
                            star <= relationshipScore ? 'text-yellow-400' : 'text-gray-200',
                          )}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="mt-3 flex gap-4 text-xs text-gray-500">
                  <span>{dealsClosedWith} deals</span>
                  <span>{propertiesSent} properties sent</span>
                </div>

                {/* Suburbs */}
                {suburbs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {suburbs.slice(0, 3).map((suburb) => (
                      <span
                        key={suburb}
                        className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        {suburb}
                      </span>
                    ))}
                    {suburbs.length > 3 && (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        +{suburbs.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
