'use client';

import { useState } from 'react';
import { Calendar, MapPin, Star, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from '@/hooks/use-auth';

const supabase = createClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalInspection {
  id: string;
  inspection_date: string;
  overall_impression: 'positive' | 'negative' | 'neutral' | null;
  client_rating: number | null;
  client_feedback: string | null;
  client_feedback_at: string | null;
  agent_notes: string | null;
  property: {
    id: string;
    address: {
      street?: string;
      suburb?: string;
      state?: string;
      postcode?: string;
    } | null;
  } | null;
}

// ─── API call helpers ─────────────────────────────────────────────────────────

async function submitInspectionFeedback(
  inspectionId: string,
  rating: number,
  feedback: string,
  token: string,
): Promise<void> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1/portal/inspections/${inspectionId}/feedback`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rating, feedback: feedback || undefined }),
    },
  );

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? 'Failed to submit feedback');
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ImpressionBadge({ impression }: { impression: string | null }) {
  if (!impression) return null;
  const styles: Record<string, string> = {
    positive: 'bg-green-50 text-green-700',
    negative: 'bg-red-50 text-red-700',
    neutral: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<string, string> = {
    positive: 'Positive',
    negative: 'Negative',
    neutral: 'Neutral',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[impression] ?? styles.neutral}`}
    >
      {labels[impression] ?? impression}
    </span>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
          aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              star <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function InspectionFeedbackForm({
  inspection,
  onSuccess,
}: {
  inspection: PortalInspection;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const queryClient = useQueryClient();

  const { data: sessionData } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sessionData?.access_token) throw new Error('Not authenticated');
      if (rating < 1) throw new Error('Please select a star rating');
      await submitInspectionFeedback(inspection.id, rating, feedback, sessionData.access_token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-inspections'] });
      onSuccess();
    },
  });

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h4 className="mb-3 text-sm font-medium text-gray-700">Your Feedback</h4>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Rating</label>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Comments (optional)</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What did you think of the property?"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-portal-400 focus:outline-none focus:ring-1 focus:ring-portal-400"
          />
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to submit feedback'}
          </p>
        )}
        <button
          type="button"
          disabled={mutation.isPending || rating === 0}
          onClick={() => mutation.mutate()}
          className="flex items-center gap-1.5 rounded-lg bg-portal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-portal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Submit Feedback
        </button>
      </div>
    </div>
  );
}

function InspectionCard({ inspection }: { inspection: PortalInspection }) {
  const [showForm, setShowForm] = useState(false);

  const addr = inspection.property?.address;
  const street = addr?.street ?? '';
  const suburb = addr?.suburb ?? '';
  const state = addr?.state ?? '';
  const postcode = addr?.postcode ?? '';
  const isCompleted = new Date(inspection.inspection_date) < new Date();
  const hasFeedback = inspection.client_rating !== null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              {new Date(inspection.inspection_date).toLocaleDateString('en-AU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="mt-1 flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{street}</p>
              {suburb && (
                <p className="text-xs text-gray-500">
                  {suburb}, {state} {postcode}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImpressionBadge impression={inspection.overall_impression} />
          {isCompleted && !hasFeedback && (
            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Feedback Due
            </span>
          )}
          {hasFeedback && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              Reviewed
            </span>
          )}
        </div>
      </div>

      {/* Agent notes */}
      {inspection.agent_notes && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500">Agent Notes</p>
          <p className="mt-0.5 text-sm text-gray-600">{inspection.agent_notes}</p>
        </div>
      )}

      {/* Existing feedback display */}
      {hasFeedback && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500">Your Rating</p>
          <div className="mt-1 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= (inspection.client_rating ?? 0)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-gray-200'
                }`}
              />
            ))}
            <span className="ml-1.5 text-xs text-gray-500">{inspection.client_rating}/5</span>
          </div>
          {inspection.client_feedback && (
            <p className="mt-1 text-sm text-gray-600">{inspection.client_feedback}</p>
          )}
        </div>
      )}

      {/* Feedback form for completed inspections without feedback */}
      {isCompleted && !hasFeedback && !showForm && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm font-medium text-portal-600 hover:text-portal-700"
          >
            Leave feedback for this inspection
          </button>
        </div>
      )}
      {isCompleted && !hasFeedback && showForm && (
        <InspectionFeedbackForm inspection={inspection} onSuccess={() => setShowForm(false)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InspectionsPage() {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();

  const {
    data: inspections,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['portal-inspections', portalClient?.contact_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select(
          `
          id,
          inspection_date,
          overall_impression,
          client_rating,
          client_feedback,
          client_feedback_at,
          agent_notes,
          property:properties!property_id (
            id,
            address
          )
        `,
        )
        .eq('contact_id', portalClient!.contact_id)
        .order('inspection_date', { ascending: false });

      if (error) throw error;
      return data as unknown as PortalInspection[];
    },
    enabled: !!user?.id && !!portalClient?.contact_id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
      </div>
    );
  }

  if (error || !inspections) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Unable to load inspections</h2>
        <p className="mt-1 text-sm text-gray-500">Please try again later.</p>
      </div>
    );
  }

  const upcoming = inspections.filter((i) => new Date(i.inspection_date) >= new Date());
  const past = inspections.filter((i) => new Date(i.inspection_date) < new Date());

  if (inspections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Calendar className="h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">No inspections scheduled</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your buyers agent will schedule inspections for shortlisted properties.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
        <p className="mt-1 text-sm text-gray-500">
          {upcoming.length > 0
            ? `${upcoming.length} upcoming inspection${upcoming.length !== 1 ? 's' : ''}`
            : 'No upcoming inspections'}
          {past.length > 0 && ` · ${past.length} completed`}
        </p>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((inspection) => (
              <InspectionCard key={inspection.id} inspection={inspection} />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Completed</h2>
          <div className="space-y-3">
            {past.map((inspection) => (
              <InspectionCard key={inspection.id} inspection={inspection} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
