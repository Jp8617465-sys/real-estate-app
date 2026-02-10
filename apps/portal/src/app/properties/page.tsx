import { MapPin, Bed, Bath, Car, Star } from 'lucide-react';
import type { PropertyMatchStatus } from '@realflow/shared';

// ── Mock data ────────────────────────────────────────────────────────
interface MockProperty {
  id: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  priceGuide: string;
  bedrooms: number;
  bathrooms: number;
  carSpaces: number;
  propertyType: string;
  matchScore: number;
  status: PropertyMatchStatus;
  agentNotes: string;
}

const MOCK_PROPERTIES: MockProperty[] = [
  {
    id: '1',
    address: '42 Latrobe Terrace',
    suburb: 'Paddington',
    state: 'QLD',
    postcode: '4064',
    priceGuide: '$1,050,000 - $1,150,000',
    bedrooms: 4,
    bathrooms: 2,
    carSpaces: 2,
    propertyType: 'House',
    matchScore: 94,
    status: 'inspection_booked',
    agentNotes: 'Strong match. North-facing rear yard. Renovation done 2023. Inspection Saturday 10am.',
  },
  {
    id: '2',
    address: '15/28 Musgrave Road',
    suburb: 'Red Hill',
    state: 'QLD',
    postcode: '4059',
    priceGuide: '$980,000+',
    bedrooms: 3,
    bathrooms: 2,
    carSpaces: 2,
    propertyType: 'Townhouse',
    matchScore: 87,
    status: 'client_interested',
    agentNotes: 'Modern build, low body corp. Walking distance to cafes. Check settlement timeline.',
  },
  {
    id: '3',
    address: '8 Frasers Road',
    suburb: 'Ashgrove',
    state: 'QLD',
    postcode: '4060',
    priceGuide: '$1,100,000 - $1,200,000',
    bedrooms: 4,
    bathrooms: 2,
    carSpaces: 2,
    propertyType: 'House',
    matchScore: 82,
    status: 'sent_to_client',
    agentNotes: 'Excellent school zone. Needs some cosmetic updates. Large 607sqm block.',
  },
  {
    id: '4',
    address: '33 Beatrice Street',
    suburb: 'Paddington',
    state: 'QLD',
    postcode: '4064',
    priceGuide: '$1,180,000',
    bedrooms: 3,
    bathrooms: 2,
    carSpaces: 1,
    propertyType: 'House',
    matchScore: 76,
    status: 'under_review',
    agentNotes: 'Character Queenslander. Only 1 car space - check if dealbreaker. Great street.',
  },
  {
    id: '5',
    address: '12 Stewart Road',
    suburb: 'Ashgrove',
    state: 'QLD',
    postcode: '4060',
    priceGuide: '$1,050,000',
    bedrooms: 4,
    bathrooms: 2,
    carSpaces: 2,
    propertyType: 'House',
    matchScore: 71,
    status: 'sent_to_client',
    agentNotes: 'Post-war home, renovated kitchen/bath. Slightly above main road - check noise.',
  },
  {
    id: '6',
    address: '5/16 Prospect Terrace',
    suburb: 'Red Hill',
    state: 'QLD',
    postcode: '4059',
    priceGuide: '$920,000 - $980,000',
    bedrooms: 3,
    bathrooms: 2,
    carSpaces: 2,
    propertyType: 'Townhouse',
    matchScore: 68,
    status: 'rejected',
    agentNotes: 'Body corporate $6,200/yr. Good location but building age may be a concern.',
  },
];

const STATUS_STYLES: Record<PropertyMatchStatus, { label: string; className: string }> = {
  new: {
    label: 'New',
    className: 'bg-blue-50 text-blue-700',
  },
  sent_to_client: {
    label: 'Awaiting Review',
    className: 'bg-amber-50 text-amber-700',
  },
  client_interested: {
    label: 'Interested',
    className: 'bg-green-50 text-green-700',
  },
  inspection_booked: {
    label: 'Inspection Booked',
    className: 'bg-purple-50 text-purple-700',
  },
  rejected: {
    label: 'Passed',
    className: 'bg-gray-100 text-gray-500',
  },
  under_review: {
    label: 'Under Review',
    className: 'bg-portal-50 text-portal-700',
  },
};

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-portal-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-gray-500';
}

export default function PropertiesPage() {
  const activeProperties = MOCK_PROPERTIES.filter((p) => p.status !== 'rejected');
  const passedProperties = MOCK_PROPERTIES.filter((p) => p.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Property Shortlist</h1>
        <p className="mt-1 text-sm text-gray-500">
          {activeProperties.length} active properties matched to your brief
        </p>
      </div>

      {/* Active properties grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeProperties.map((property) => {
          const statusStyle = STATUS_STYLES[property.status];
          return (
            <div
              key={property.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Photo placeholder */}
              <div className="relative aspect-[16/10] bg-gray-100">
                <div className="flex h-full items-center justify-center">
                  <MapPin className="h-8 w-8 text-gray-300" />
                </div>
                {/* Match score badge */}
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 backdrop-blur">
                  <Star className={`h-3.5 w-3.5 ${getScoreColor(property.matchScore)}`} />
                  <span className={`text-sm font-bold ${getScoreColor(property.matchScore)}`}>
                    {property.matchScore}%
                  </span>
                </div>
                {/* Status badge */}
                <div className="absolute left-2 top-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.className}`}
                  >
                    {statusStyle.label}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900">{property.address}</h3>
                <p className="text-sm text-gray-500">
                  {property.suburb}, {property.state} {property.postcode}
                </p>
                <p className="mt-2 text-lg font-bold text-gray-900">
                  {property.priceGuide}
                </p>

                {/* Features */}
                <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Bed className="h-3.5 w-3.5" />
                    {property.bedrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="h-3.5 w-3.5" />
                    {property.bathrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" />
                    {property.carSpaces}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {property.propertyType}
                  </span>
                </div>

                {/* Agent notes */}
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500">Agent Notes</p>
                  <p className="mt-0.5 text-sm text-gray-600">{property.agentNotes}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Passed properties */}
      {passedProperties.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Passed ({passedProperties.length})
          </h2>
          <div className="space-y-2">
            {passedProperties.map((property) => (
              <div
                key={property.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {property.address}, {property.suburb}
                  </p>
                  <p className="text-xs text-gray-400">{property.priceGuide}</p>
                </div>
                <span className="text-sm text-gray-400">{property.matchScore}% match</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
