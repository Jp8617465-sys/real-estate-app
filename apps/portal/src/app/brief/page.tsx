import { CheckCircle2, Clock, FileText } from 'lucide-react';
import type { PurchaseType, Urgency, UpdateFrequency } from '@realflow/shared';

// ── Mock data ────────────────────────────────────────────────────────
const MOCK_BRIEF = {
  purchaseType: 'owner_occupier' as PurchaseType,
  budget: {
    min: 950000,
    max: 1200000,
    absoluteMax: 1300000,
    stampDutyBudgeted: true,
  },
  requirements: {
    propertyTypes: ['house', 'townhouse'] as string[],
    bedrooms: { min: 3, ideal: 4 },
    bathrooms: { min: 2, ideal: 2 },
    carSpaces: { min: 2, ideal: 2 },
    suburbs: [
      { suburb: 'Paddington', state: 'QLD', postcode: '4064', rank: 1 },
      { suburb: 'Red Hill', state: 'QLD', postcode: '4059', rank: 2 },
      { suburb: 'Ashgrove', state: 'QLD', postcode: '4060', rank: 3 },
    ],
    mustHaves: ['Outdoor entertaining area', 'Separate living zones', 'Air conditioning'],
    niceToHaves: ['Pool', 'Home office', 'Walk to cafe strip'],
    dealBreakers: ['Main road frontage', 'Flood zone', 'Body corporate over $8,000/yr'],
  },
  timeline: {
    urgency: '1_3_months' as Urgency,
    idealSettlement: '90 days from exchange',
  },
  communication: {
    preferredMethod: 'phone' as const,
    updateFrequency: 'twice_weekly' as UpdateFrequency,
    bestTimeToCall: '12pm - 2pm weekdays',
    partnerName: 'James Johnson',
  },
  solicitor: {
    firmName: 'Henderson & Partners',
    contactName: 'Mark Henderson',
    phone: '07 3555 1234',
    email: 'mark@hendersonlaw.com.au',
  },
  briefVersion: 3,
  clientSignedOff: true,
  signedOffAt: '2026-01-28T10:00:00Z',
  updatedAt: '2026-01-28T10:00:00Z',
};

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
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Brief</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Version {MOCK_BRIEF.briefVersion}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Last updated {formatDate(MOCK_BRIEF.updatedAt)}
            </span>
          </div>
        </div>
        {MOCK_BRIEF.clientSignedOff && (
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
            value={PURCHASE_TYPE_LABELS[MOCK_BRIEF.purchaseType]}
          />
        </dl>
      </SectionCard>

      {/* Budget */}
      <SectionCard title="Budget">
        <dl className="space-y-3">
          <DetailRow
            label="Range"
            value={`${formatCurrency(MOCK_BRIEF.budget.min)} - ${formatCurrency(MOCK_BRIEF.budget.max)}`}
          />
          {MOCK_BRIEF.budget.absoluteMax && (
            <DetailRow
              label="Absolute Maximum"
              value={formatCurrency(MOCK_BRIEF.budget.absoluteMax)}
            />
          )}
          <DetailRow
            label="Stamp Duty Budgeted"
            value={MOCK_BRIEF.budget.stampDutyBudgeted ? 'Yes' : 'No'}
          />
        </dl>
      </SectionCard>

      {/* Requirements */}
      <SectionCard title="Requirements">
        <dl className="space-y-4">
          <DetailRow
            label="Property Types"
            value={MOCK_BRIEF.requirements.propertyTypes
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(', ')}
          />
          <DetailRow
            label="Bedrooms"
            value={`Min ${MOCK_BRIEF.requirements.bedrooms.min}${MOCK_BRIEF.requirements.bedrooms.ideal ? `, ideally ${MOCK_BRIEF.requirements.bedrooms.ideal}` : ''}`}
          />
          <DetailRow
            label="Bathrooms"
            value={`Min ${MOCK_BRIEF.requirements.bathrooms.min}${MOCK_BRIEF.requirements.bathrooms.ideal ? `, ideally ${MOCK_BRIEF.requirements.bathrooms.ideal}` : ''}`}
          />
          <DetailRow
            label="Car Spaces"
            value={`Min ${MOCK_BRIEF.requirements.carSpaces.min}${MOCK_BRIEF.requirements.carSpaces.ideal ? `, ideally ${MOCK_BRIEF.requirements.carSpaces.ideal}` : ''}`}
          />

          <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Preferred Suburbs
            </h3>
            <div className="space-y-1.5">
              {MOCK_BRIEF.requirements.suburbs.map((suburb) => (
                <div
                  key={suburb.suburb}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-portal-100 text-[10px] font-semibold text-portal-700">
                    {suburb.rank}
                  </span>
                  <span className="text-gray-900">
                    {suburb.suburb}, {suburb.state} {suburb.postcode}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Must Haves</h3>
            <TagList items={MOCK_BRIEF.requirements.mustHaves} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Nice to Haves
            </h3>
            <TagList items={MOCK_BRIEF.requirements.niceToHaves} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Deal Breakers
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {MOCK_BRIEF.requirements.dealBreakers.map((item) => (
                <span
                  key={item}
                  className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </dl>
      </SectionCard>

      {/* Timeline */}
      <SectionCard title="Timeline">
        <dl className="space-y-3">
          <DetailRow
            label="Urgency"
            value={URGENCY_LABELS[MOCK_BRIEF.timeline.urgency]}
          />
          {MOCK_BRIEF.timeline.idealSettlement && (
            <DetailRow
              label="Ideal Settlement"
              value={MOCK_BRIEF.timeline.idealSettlement}
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
              MOCK_BRIEF.communication.preferredMethod
                ? MOCK_BRIEF.communication.preferredMethod.charAt(0).toUpperCase() +
                  MOCK_BRIEF.communication.preferredMethod.slice(1)
                : 'Not specified'
            }
          />
          <DetailRow
            label="Update Frequency"
            value={
              MOCK_BRIEF.communication.updateFrequency
                ? FREQUENCY_LABELS[MOCK_BRIEF.communication.updateFrequency]
                : 'Not specified'
            }
          />
          {MOCK_BRIEF.communication.bestTimeToCall && (
            <DetailRow
              label="Best Time to Call"
              value={MOCK_BRIEF.communication.bestTimeToCall}
            />
          )}
          {MOCK_BRIEF.communication.partnerName && (
            <DetailRow
              label="Partner"
              value={MOCK_BRIEF.communication.partnerName}
            />
          )}
        </dl>
      </SectionCard>

      {/* Solicitor */}
      {MOCK_BRIEF.solicitor && (
        <SectionCard title="Solicitor">
          <dl className="space-y-3">
            <DetailRow label="Firm" value={MOCK_BRIEF.solicitor.firmName} />
            <DetailRow label="Contact" value={MOCK_BRIEF.solicitor.contactName} />
            <DetailRow label="Phone" value={MOCK_BRIEF.solicitor.phone} />
            <DetailRow label="Email" value={MOCK_BRIEF.solicitor.email} />
          </dl>
        </SectionCard>
      )}
    </div>
  );
}
