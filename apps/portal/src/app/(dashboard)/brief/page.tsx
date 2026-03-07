'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, FileText, AlertCircle, Sparkles, MapPin } from 'lucide-react';
import type { PurchaseType, Urgency, UpdateFrequency, BriefContactMethod } from '@realflow/shared';
import { useBrief } from '@/hooks/use-brief';
import { usePortalProperties } from '@/hooks/use-portal-properties';
import { LoadingSpinner } from '@/components/loading-spinner';
import { EmptyState } from '@/components/empty-state';
import { PropertyCard } from '@/components/property-card';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  owner_occupier: 'Owner Occupier',
  investor: 'Investor',
  development: 'Development',
  smsf: 'SMSF',
};

const URGENCY_LABELS: Record<Urgency, string> = {
  asap: 'ASAP',
  '1_3_months': '1-3 Months',
  '3_6_months': '3-6 Months',
  '6_12_months': '6-12 Months',
  no_rush: 'No Rush',
};

const FREQUENCY_LABELS: Record<UpdateFrequency, string> = {
  daily: 'Daily',
  twice_weekly: 'Twice Weekly',
  weekly: 'Weekly',
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm text-gray-500 sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function BriefPage() {
  const { data: brief, isLoading: isBriefLoading, error: briefError } = useBrief();
  const { data: properties, isLoading: isPropertiesLoading } = usePortalProperties();

  if (isBriefLoading) {
    return <LoadingSpinner message="Loading your brief..." />;
  }

  if (briefError || !brief) {
    return (
      <EmptyState
        icon={AlertCircle}
        heading="No brief found"
        description="Your buyers agent has not created a brief yet. Check back soon."
      />
    );
  }

  const purchaseType = brief.purchaseType as PurchaseType;
  const urgency = brief.timeline?.urgency as Urgency | undefined;
  const updateFrequency = brief.communication?.updateFrequency as UpdateFrequency | undefined;
  const preferredMethod = brief.communication?.preferredMethod as BriefContactMethod | undefined;
  const suburbs = (brief.requirements?.suburbs ?? []) as Array<{
    suburb: string;
    state: string;
    postcode: string;
    rank?: number;
  }>;
  const mustHaves = (brief.requirements?.mustHaves ?? []) as string[];
  const niceToHaves = (brief.requirements?.niceToHaves ?? []) as string[];
  const dealBreakers = (brief.requirements?.dealBreakers ?? []) as string[];
  const propertyTypes = (brief.requirements?.propertyTypes ?? []) as string[];

  // Matched properties (top 3)
  const matchedProperties = (properties ?? [])
    .filter((p) => p.status !== 'rejected')
    .slice(0, 3);

  // AI-like suggestions based on brief data
  const suggestions: string[] = [];
  if (suburbs.length <= 2) {
    suggestions.push('Consider adding more suburbs to broaden your search and find better value.');
  }
  if (mustHaves.length > 5) {
    suggestions.push('You have many must-haves. Prioritising the top 3-4 can speed up your search.');
  }
  if (!brief.budget?.absoluteMax) {
    suggestions.push('Setting an absolute maximum budget helps your agent negotiate more effectively.');
  }
  if (dealBreakers.length === 0) {
    suggestions.push('Adding deal breakers helps filter unsuitable properties early in the process.');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Brief</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Version {brief.briefVersion ?? 1}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Last updated {formatDate(brief.updatedAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {brief.clientSignedOff && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Signed Off
            </span>
          )}
          <Link
            href="/messages"
            className="inline-flex items-center gap-2 rounded-lg border border-portal-200 bg-portal-50 px-4 py-2 text-sm font-medium text-portal-700 transition-colors hover:bg-portal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500"
          >
            Request Brief Update
          </Link>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-portal-200 bg-portal-50 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-portal-600" aria-hidden="true" />
            <h2 className="font-semibold text-portal-800">Suggestions to improve your search</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion} className="flex items-start gap-2 text-sm text-portal-700">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-portal-400" aria-hidden="true" />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Purchase Type & Budget */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Purchase Type">
          <dl className="space-y-3">
            <DetailRow
              label="Type"
              value={PURCHASE_TYPE_LABELS[purchaseType] ?? purchaseType}
            />
          </dl>
        </SectionCard>

        <SectionCard title="Budget">
          <dl className="space-y-3">
            <DetailRow
              label="Range"
              value={`${formatCurrency(brief.budget?.min ?? 0)} - ${formatCurrency(brief.budget?.max ?? 0)}`}
            />
            {brief.budget?.absoluteMax && (
              <DetailRow
                label="Absolute Max"
                value={formatCurrency(brief.budget.absoluteMax)}
              />
            )}
            <DetailRow
              label="Stamp Duty Budgeted"
              value={brief.budget?.stampDutyBudgeted ? 'Yes' : 'No'}
            />
          </dl>
        </SectionCard>
      </div>

      {/* Requirements */}
      <SectionCard title="Requirements">
        <dl className="space-y-4">
          {propertyTypes.length > 0 && (
            <DetailRow
              label="Property Types"
              value={propertyTypes
                .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1))
                .join(', ')}
            />
          )}
          {brief.requirements?.bedrooms && (
            <DetailRow
              label="Bedrooms"
              value={`Min ${brief.requirements.bedrooms.min}${brief.requirements.bedrooms.ideal ? `, ideally ${brief.requirements.bedrooms.ideal}` : ''}`}
            />
          )}
          {brief.requirements?.bathrooms && (
            <DetailRow
              label="Bathrooms"
              value={`Min ${brief.requirements.bathrooms.min}${brief.requirements.bathrooms.ideal ? `, ideally ${brief.requirements.bathrooms.ideal}` : ''}`}
            />
          )}
          {brief.requirements?.carSpaces && (
            <DetailRow
              label="Car Spaces"
              value={`Min ${brief.requirements.carSpaces.min}${brief.requirements.carSpaces.ideal ? `, ideally ${brief.requirements.carSpaces.ideal}` : ''}`}
            />
          )}

          {suburbs.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Preferred Suburbs</h3>
              <div className="space-y-1.5">
                {suburbs.map((suburb) => (
                  <div key={suburb.suburb} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-portal-100 text-[10px] font-semibold text-portal-700">
                      {suburb.rank ?? '-'}
                    </span>
                    <span className="text-gray-900">
                      {suburb.suburb}, {suburb.state} {suburb.postcode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mustHaves.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Must Haves</h3>
              <TagList items={mustHaves} />
            </div>
          )}

          {niceToHaves.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">Nice to Haves</h3>
              <TagList items={niceToHaves} />
            </div>
          )}

          {dealBreakers.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">Deal Breakers</h3>
              <div className="flex flex-wrap gap-1.5">
                {dealBreakers.map((item: string) => (
                  <span
                    key={item}
                    className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </dl>
      </SectionCard>

      {/* Timeline & Communication */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Timeline">
          <dl className="space-y-3">
            {urgency && (
              <DetailRow label="Urgency" value={URGENCY_LABELS[urgency] ?? urgency} />
            )}
            {brief.timeline?.idealSettlement && (
              <DetailRow label="Ideal Settlement" value={brief.timeline.idealSettlement} />
            )}
          </dl>
        </SectionCard>

        <SectionCard title="Communication">
          <dl className="space-y-3">
            <DetailRow
              label="Preferred Method"
              value={
                preferredMethod
                  ? preferredMethod.charAt(0).toUpperCase() + preferredMethod.slice(1)
                  : 'Not specified'
              }
            />
            <DetailRow
              label="Update Frequency"
              value={updateFrequency ? FREQUENCY_LABELS[updateFrequency] : 'Not specified'}
            />
          </dl>
        </SectionCard>
      </div>

      {/* Solicitor */}
      {brief.solicitor && (
        <SectionCard title="Solicitor">
          <dl className="space-y-3">
            {brief.solicitor.firmName && (
              <DetailRow label="Firm" value={brief.solicitor.firmName} />
            )}
            {brief.solicitor.contactName && (
              <DetailRow label="Contact" value={brief.solicitor.contactName} />
            )}
            {brief.solicitor.phone && (
              <DetailRow label="Phone" value={brief.solicitor.phone} />
            )}
            {brief.solicitor.email && (
              <DetailRow label="Email" value={brief.solicitor.email} />
            )}
          </dl>
        </SectionCard>
      )}

      {/* Matched Properties */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Matched Properties
          </h2>
          {matchedProperties.length > 0 && (
            <Link
              href="/properties"
              className="text-sm font-medium text-portal-600 hover:text-portal-700"
            >
              View all
            </Link>
          )}
        </div>
        {isPropertiesLoading ? (
          <LoadingSpinner size="sm" />
        ) : matchedProperties.length === 0 ? (
          <EmptyState
            icon={MapPin}
            heading="No matched properties yet"
            description="Your agent is searching for properties that match your brief."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchedProperties.map((match) => (
              <PropertyCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
