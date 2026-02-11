'use client';

import { CheckCircle2, Clock, FileText, Loader2, AlertCircle } from 'lucide-react';
import type { PurchaseType, Urgency, UpdateFrequency, BriefContactMethod } from '@realflow/shared';
import { useBrief } from '@/hooks/use-brief';

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

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  const { data: brief, isLoading, error } = useBrief();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">No brief found</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your buyers agent has not created a brief yet. Check back soon.
        </p>
      </div>
    );
  }

  const purchaseType = brief.purchase_type as PurchaseType;
  const urgency = brief.timeline?.urgency as Urgency | undefined;
  const updateFrequency = brief.communication?.update_frequency as UpdateFrequency | undefined;
  const preferredMethod = brief.communication?.preferred_method as BriefContactMethod | undefined;
  const suburbs = (brief.requirements?.suburbs ?? []) as Array<{
    suburb: string;
    state: string;
    postcode: string;
    rank?: number;
  }>;
  const mustHaves = (brief.requirements?.must_haves ?? []) as string[];
  const niceToHaves = (brief.requirements?.nice_to_haves ?? []) as string[];
  const dealBreakers = (brief.requirements?.deal_breakers ?? []) as string[];
  const propertyTypes = (brief.requirements?.property_types ?? []) as string[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Brief</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Version {brief.brief_version ?? 1}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Last updated {formatDate(brief.updated_at)}
            </span>
          </div>
        </div>
        {brief.client_signed_off && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Signed Off
          </span>
        )}
      </div>

      {/* Purchase Type */}
      <SectionCard title="Purchase Type">
        <dl className="space-y-3">
          <DetailRow
            label="Type"
            value={PURCHASE_TYPE_LABELS[purchaseType] ?? purchaseType}
          />
        </dl>
      </SectionCard>

      {/* Budget */}
      <SectionCard title="Budget">
        <dl className="space-y-3">
          <DetailRow
            label="Range"
            value={`${formatCurrency(brief.budget?.min ?? 0)} - ${formatCurrency(brief.budget?.max ?? 0)}`}
          />
          {brief.budget?.absolute_max && (
            <DetailRow
              label="Absolute Maximum"
              value={formatCurrency(brief.budget.absolute_max)}
            />
          )}
          <DetailRow
            label="Stamp Duty Budgeted"
            value={brief.budget?.stamp_duty_budgeted ? 'Yes' : 'No'}
          />
        </dl>
      </SectionCard>

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
          {brief.requirements?.car_spaces && (
            <DetailRow
              label="Car Spaces"
              value={`Min ${brief.requirements.car_spaces.min}${brief.requirements.car_spaces.ideal ? `, ideally ${brief.requirements.car_spaces.ideal}` : ''}`}
            />
          )}

          {suburbs.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Preferred Suburbs
              </h3>
              <div className="space-y-1.5">
                {suburbs.map((suburb) => (
                  <div
                    key={suburb.suburb}
                    className="flex items-center gap-2 text-sm"
                  >
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
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Nice to Haves
              </h3>
              <TagList items={niceToHaves} />
            </div>
          )}

          {dealBreakers.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Deal Breakers
              </h3>
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

      {/* Timeline */}
      <SectionCard title="Timeline">
        <dl className="space-y-3">
          {urgency && (
            <DetailRow
              label="Urgency"
              value={URGENCY_LABELS[urgency] ?? urgency}
            />
          )}
          {brief.timeline?.ideal_settlement && (
            <DetailRow
              label="Ideal Settlement"
              value={brief.timeline.ideal_settlement}
            />
          )}
        </dl>
      </SectionCard>

      {/* Communication */}
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
            value={
              updateFrequency
                ? FREQUENCY_LABELS[updateFrequency]
                : 'Not specified'
            }
          />
          {brief.communication?.best_time_to_call && (
            <DetailRow
              label="Best Time to Call"
              value={brief.communication.best_time_to_call}
            />
          )}
          {brief.communication?.partner_name && (
            <DetailRow
              label="Partner"
              value={brief.communication.partner_name}
            />
          )}
        </dl>
      </SectionCard>

      {/* Solicitor */}
      {brief.solicitor && (
        <SectionCard title="Solicitor">
          <dl className="space-y-3">
            {brief.solicitor.firm_name && (
              <DetailRow label="Firm" value={brief.solicitor.firm_name} />
            )}
            {brief.solicitor.contact_name && (
              <DetailRow label="Contact" value={brief.solicitor.contact_name} />
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
    </div>
  );
}
