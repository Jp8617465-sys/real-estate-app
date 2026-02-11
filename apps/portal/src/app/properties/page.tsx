'use client';

import { MapPin, Bed, Bath, Car, Star, Loader2, AlertCircle } from 'lucide-react';
import type { PropertyMatchStatus } from '@realflow/shared';
import { usePortalProperties } from '@/hooks/use-portal-properties';
import type { PortalProperty } from '@/hooks/use-portal-properties';

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

export default function PropertiesPage() {
  const { data: properties, isLoading, error } = usePortalProperties();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
      </div>
    );
  }

  if (error || !properties) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Unable to load properties</h2>
        <p className="mt-1 text-sm text-gray-500">Please try again later.</p>
      </div>
    );
  }

  const activeProperties = properties.filter((p) => p.status !== 'rejected');
  const passedProperties = properties.filter((p) => p.status === 'rejected');

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <MapPin className="h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">No properties yet</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your buyers agent is searching for properties that match your brief.
        </p>
      </div>
    );
  }

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
        {activeProperties.map((match) => {
          const statusStyle = STATUS_STYLES[match.status as PropertyMatchStatus] ?? STATUS_STYLES.new;
          const addr = formatAddress(match);
          const prop = match.property;

          return (
            <div
              key={match.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Photo placeholder */}
              <div className="relative aspect-[16/10] bg-gray-100">
                <div className="flex h-full items-center justify-center">
                  <MapPin className="h-8 w-8 text-gray-300" />
                </div>
                {/* Match score badge */}
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 backdrop-blur">
                  <Star className={`h-3.5 w-3.5 ${getScoreColor(match.overall_score)}`} />
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
                <h3 className="font-semibold text-gray-900">{addr.street}</h3>
                <p className="text-sm text-gray-500">
                  {addr.suburb}, {addr.state} {addr.postcode}
                </p>
                {prop?.price_guide && (
                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {prop.price_guide}
                  </p>
                )}

                {/* Features */}
                <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Bed className="h-3.5 w-3.5" />
                    {prop?.bedrooms ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="h-3.5 w-3.5" />
                    {prop?.bathrooms ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" />
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
            {passedProperties.map((match) => {
              const addr = formatAddress(match);
              const prop = match.property;
              return (
                <div
                  key={match.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {addr.street}, {addr.suburb}
                    </p>
                    <p className="text-xs text-gray-400">{prop?.price_guide ?? ''}</p>
                  </div>
                  <span className="text-sm text-gray-400">{match.overall_score}% match</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
