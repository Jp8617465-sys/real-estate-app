'use client';

import Link from 'next/link';
import { MapPin, Bed, Bath, Car, Star } from 'lucide-react';
import type { PropertyMatchStatus } from '@realflow/shared';
import type { PortalProperty } from '@/hooks/use-portal-properties';

const STATUS_STYLES: Record<PropertyMatchStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-50 text-blue-700' },
  sent_to_client: { label: 'Awaiting Review', className: 'bg-amber-50 text-amber-700' },
  client_interested: { label: 'Interested', className: 'bg-green-50 text-green-700' },
  inspection_booked: { label: 'Inspection Booked', className: 'bg-purple-50 text-purple-700' },
  rejected: { label: 'Passed', className: 'bg-gray-100 text-gray-500' },
  under_review: { label: 'Under Review', className: 'bg-portal-50 text-portal-700' },
};

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-portal-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-gray-500';
}

function formatAddress(property: PortalProperty): {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
} {
  const addr = property.property?.address;
  if (typeof addr === 'object' && addr !== null) {
    return {
      street: addr.street ?? '',
      suburb: addr.suburb ?? '',
      state: addr.state ?? '',
      postcode: addr.postcode ?? '',
    };
  }
  return { street: '', suburb: '', state: '', postcode: '' };
}

interface PropertyCardProps {
  match: PortalProperty;
  /** When true, renders as a compact passed-property row */
  compact?: boolean;
}

export function PropertyCard({ match, compact = false }: PropertyCardProps) {
  const addr = formatAddress(match);
  const prop = match.property;

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {addr.street}, {addr.suburb}
          </p>
          <p className="text-xs text-gray-400">{prop?.price_guide ?? ''}</p>
        </div>
        <span className="text-sm text-gray-400">{match.overall_score}% match</span>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[match.status as PropertyMatchStatus] ?? STATUS_STYLES.new;

  return (
    <Link
      href={`/properties/${match.property?.id ?? match.id}`}
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500 focus-visible:ring-offset-2"
    >
      {/* Photo placeholder */}
      <div className="relative aspect-[16/10] bg-gray-100">
        <div className="flex h-full items-center justify-center">
          <MapPin className="h-8 w-8 text-gray-300" aria-hidden="true" />
        </div>
        {/* Match score badge */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 backdrop-blur">
          <Star className={`h-3.5 w-3.5 ${getScoreColor(match.overall_score)}`} aria-hidden="true" />
          <span className={`text-sm font-bold ${getScoreColor(match.overall_score)}`}>
            {match.overall_score}%
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
        <h3 className="font-semibold text-gray-900 group-hover:text-portal-700 transition-colors">
          {addr.street}
        </h3>
        <p className="text-sm text-gray-500">
          {addr.suburb}, {addr.state} {addr.postcode}
        </p>
        {prop?.price_guide && (
          <p className="mt-2 text-lg font-bold text-gray-900">{prop.price_guide}</p>
        )}

        {/* Features */}
        <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
          <span className="flex items-center gap-1" aria-label={`${prop?.bedrooms ?? 0} bedrooms`}>
            <Bed className="h-3.5 w-3.5" aria-hidden="true" />
            {prop?.bedrooms ?? 0}
          </span>
          <span className="flex items-center gap-1" aria-label={`${prop?.bathrooms ?? 0} bathrooms`}>
            <Bath className="h-3.5 w-3.5" aria-hidden="true" />
            {prop?.bathrooms ?? 0}
          </span>
          <span className="flex items-center gap-1" aria-label={`${prop?.car_spaces ?? 0} car spaces`}>
            <Car className="h-3.5 w-3.5" aria-hidden="true" />
            {prop?.car_spaces ?? 0}
          </span>
          <span className="ml-auto text-xs text-gray-400">
            {prop?.property_type
              ? prop.property_type.charAt(0).toUpperCase() + prop.property_type.slice(1)
              : ''}
          </span>
        </div>

        {/* Agent notes */}
        {match.agent_notes && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500">Agent Notes</p>
            <p className="mt-0.5 text-sm text-gray-600">{match.agent_notes}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
