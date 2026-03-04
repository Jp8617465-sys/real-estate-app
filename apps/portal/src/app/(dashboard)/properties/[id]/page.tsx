'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Car,
  Star,
  Heart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Ruler,
  Home,
  MessageSquare,
} from 'lucide-react';
import type { PropertyMatchStatus } from '@realflow/shared';
import { usePortalProperties } from '@/hooks/use-portal-properties';
import { LoadingSpinner } from '@/components/loading-spinner';
import { EmptyState } from '@/components/empty-state';

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

function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-green-50';
  if (score >= 75) return 'bg-portal-50';
  if (score >= 60) return 'bg-amber-50';
  return 'bg-gray-50';
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const { data: properties, isLoading, error } = usePortalProperties();

  if (isLoading) {
    return <LoadingSpinner message="Loading property details..." />;
  }

  if (error || !properties) {
    return (
      <EmptyState
        icon={Home}
        heading="Unable to load property"
        description="Please try again later."
      />
    );
  }

  // Find the matching property by either match ID or property ID
  const match = properties.find(
    (p) => p.property?.id === propertyId || p.id === propertyId,
  );

  if (!match) {
    return (
      <EmptyState
        icon={MapPin}
        heading="Property not found"
        description="This property may have been removed from your shortlist."
        action={
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 rounded-lg bg-portal-600 px-4 py-2 text-sm font-medium text-white hover:bg-portal-700"
          >
            Back to Properties
          </Link>
        }
      />
    );
  }

  const prop = match.property;
  const addr = prop?.address;
  const street = addr?.street ?? '';
  const suburb = addr?.suburb ?? '';
  const state = addr?.state ?? '';
  const postcode = addr?.postcode ?? '';
  const statusStyle = STATUS_STYLES[match.status as PropertyMatchStatus] ?? STATUS_STYLES.new;

  // Mock photo gallery (placeholders)
  const photoCount = 5;
  const photos = Array.from({ length: photoCount }, (_, i) => i);

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500 focus-visible:rounded-lg focus-visible:px-1"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Properties
      </button>

      {/* Photo gallery */}
      <div className="relative overflow-hidden rounded-xl bg-gray-100">
        <div className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none">
          {photos.map((_, index) => (
            <div
              key={index}
              className="flex aspect-[16/9] w-full shrink-0 snap-center items-center justify-center sm:aspect-[16/8]"
            >
              <div className="flex flex-col items-center text-gray-300">
                <MapPin className="h-12 w-12" aria-hidden="true" />
                <span className="mt-2 text-sm">Photo {index + 1}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Gallery navigation hints */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-2">
          <div className="rounded-full bg-white/80 p-1.5 shadow backdrop-blur" aria-hidden="true">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <div className="rounded-full bg-white/80 p-1.5 shadow backdrop-blur" aria-hidden="true">
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </div>
        </div>
        {/* Photo counter */}
        <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
          {photoCount} photos
        </div>
        {/* Status badge */}
        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle.className}`}
          >
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Property header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{street}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-gray-500">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {suburb}, {state} {postcode}
          </p>
          {prop?.price_guide && (
            <p className="mt-2 text-2xl font-bold text-gray-900">{prop.price_guide}</p>
          )}
        </div>

        {/* Match score */}
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${getScoreBgColor(match.overall_score)}`}>
          <Star className={`h-5 w-5 ${getScoreColor(match.overall_score)}`} aria-hidden="true" />
          <div>
            <p className={`text-2xl font-bold ${getScoreColor(match.overall_score)}`}>
              {match.overall_score}%
            </p>
            <p className="text-xs text-gray-500">Match Score</p>
          </div>
        </div>
      </div>

      {/* Key details */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <Bed className="mx-auto h-5 w-5 text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-xl font-bold text-gray-900">{prop?.bedrooms ?? 0}</p>
          <p className="text-xs text-gray-500">Bedrooms</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <Bath className="mx-auto h-5 w-5 text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-xl font-bold text-gray-900">{prop?.bathrooms ?? 0}</p>
          <p className="text-xs text-gray-500">Bathrooms</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <Car className="mx-auto h-5 w-5 text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-xl font-bold text-gray-900">{prop?.car_spaces ?? 0}</p>
          <p className="text-xs text-gray-500">Car Spaces</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <Ruler className="mx-auto h-5 w-5 text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-xl font-bold text-gray-900">
            {prop?.property_type
              ? prop.property_type.charAt(0).toUpperCase() + prop.property_type.slice(1)
              : '--'}
          </p>
          <p className="text-xs text-gray-500">Property Type</p>
        </div>
      </div>

      {/* Agent notes / recommendations */}
      {match.agent_notes && (
        <div className="rounded-xl border border-portal-200 bg-portal-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-portal-700">
            Agent Recommendation
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-portal-800">{match.agent_notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-portal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500 focus-visible:ring-offset-2"
          aria-label="Express interest in this property"
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          Express Interest
        </button>
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-portal-200 bg-white px-6 py-3 text-sm font-semibold text-portal-700 shadow-sm transition-colors hover:bg-portal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500 focus-visible:ring-offset-2"
          aria-label="Book an inspection for this property"
        >
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Book Inspection
        </button>
        <Link
          href="/messages"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500 focus-visible:ring-offset-2"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          Ask Agent
        </Link>
      </div>

      {/* Shortlist / Add to favourites */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Quick Actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-portal-200 hover:bg-portal-50 hover:text-portal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500"
          >
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            Add to Shortlist
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-portal-200 hover:bg-portal-50 hover:text-portal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Schedule Viewing
          </button>
        </div>
      </div>
    </div>
  );
}
