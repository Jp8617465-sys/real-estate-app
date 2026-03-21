'use client';
import { useState } from 'react';
import type { PropertyAlertEvent } from '@realflow/shared';
import { useAlertEvents, useSendMatchToClient } from '@/hooks/use-alerts';

// ─── helpers ─────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<PropertyAlertEvent['alertType'], string> = {
  new_match: 'New Match',
  price_drop: 'Price Drop',
  auction_date: 'Auction Date',
  status_change: 'Status Change',
};

const ALERT_TYPE_COLOURS: Record<PropertyAlertEvent['alertType'], string> = {
  new_match: 'bg-blue-100 text-blue-800',
  price_drop: 'bg-red-100 text-red-800',
  auction_date: 'bg-orange-100 text-orange-800',
  status_change: 'bg-purple-100 text-purple-800',
};

function scorePill(score: number) {
  const colour =
    score >= 80
      ? 'bg-green-100 text-green-800'
      : score >= 70
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-gray-100 text-gray-600';
  return `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colour}`;
}

function formatAuDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── row ─────────────────────────────────────────────────────────────────────

function AlertRow({ event }: { event: PropertyAlertEvent }) {
  const sendToClient = useSendMatchToClient();
  const [sent, setSent] = useState(event.action === 'sent_to_client');

  const canSend = !sent && !!event.propertyMatchId;

  function handleSend() {
    if (!event.propertyMatchId) return;
    sendToClient.mutate(event.propertyMatchId, {
      onSuccess: () => setSent(true),
    });
  }

  return (
    <div className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ALERT_TYPE_COLOURS[event.alertType]}`}
          >
            {ALERT_TYPE_LABELS[event.alertType]}
          </span>
          <span className={scorePill(event.matchScore)}>{event.matchScore}% match</span>
          {sent && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              Sent to client
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Sent {formatAuDate(event.sentAt)} &middot; Channels:{' '}
          {event.channelsDelivered.length > 0
            ? event.channelsDelivered.join(', ')
            : 'none delivered'}
        </p>
      </div>
      <button
        onClick={handleSend}
        disabled={!canSend || sendToClient.isPending}
        className="shrink-0 rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sent ? 'Sent' : 'Send to client'}
      </button>
    </div>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function AlertsClient() {
  const { data: events, isLoading, dataUpdatedAt } = useAlertEvents(50);

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Property Alerts</h1>
        {lastRefreshed && <p className="text-xs text-gray-400">Last refreshed {lastRefreshed}</p>}
      </div>

      {isLoading && <Skeleton />}

      {!isLoading && (!events || events.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-20">
          <span className="text-4xl">🔔</span>
          <p className="mt-3 text-sm font-medium text-gray-500">No alerts yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Alerts fire when new property matches or price changes are detected.
          </p>
        </div>
      )}

      {!isLoading && events && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => (
            <AlertRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
