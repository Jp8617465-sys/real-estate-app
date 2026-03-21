'use client';
import { useState, useEffect } from 'react';
import type { AlertChannel, PropertyAlertSubscription } from '@realflow/shared';
import {
  useAlertSubscriptions,
  useCreateAlertSubscription,
  useUpdateAlertSubscription,
  useDeleteAlertSubscription,
} from '@/hooks/use-alerts';

// ─── types ───────────────────────────────────────────────────────────────────

interface FormState {
  scoreThreshold: number;
  push: boolean;
  email: boolean;
  sms: boolean;
  digestMode: boolean;
  digestTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const DEFAULTS: FormState = {
  scoreThreshold: 70,
  push: true,
  email: false,
  sms: false,
  digestMode: false,
  digestTime: '07:00',
  quietHoursStart: '21:00',
  quietHoursEnd: '07:00',
};

function subToForm(sub: PropertyAlertSubscription): FormState {
  return {
    scoreThreshold: sub.scoreThreshold,
    push: sub.channels.includes('push'),
    email: sub.channels.includes('email'),
    sms: sub.channels.includes('sms'),
    digestMode: sub.digestMode,
    digestTime: sub.digestTime,
    quietHoursStart: sub.quietHoursStart,
    quietHoursEnd: sub.quietHoursEnd,
  };
}

function formToChannels(form: FormState): AlertChannel[] {
  const channels: AlertChannel[] = [];
  if (form.push) channels.push('push');
  if (form.email) channels.push('email');
  if (form.sms) channels.push('sms');
  return channels.length > 0 ? channels : ['push'];
}

// ─── component ───────────────────────────────────────────────────────────────

export function BriefAlertsClient({ briefId }: { briefId: string }) {
  const { data: allSubs, isLoading } = useAlertSubscriptions();
  const createSub = useCreateAlertSubscription();
  const updateSub = useUpdateAlertSubscription();
  const deleteSub = useDeleteAlertSubscription();

  const existing = allSubs?.find((s) => s.briefId === briefId) ?? null;

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm(subToForm(existing));
    }
  }, [existing]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleSave() {
    const channels = formToChannels(form);
    const payload = {
      briefId,
      scoreThreshold: form.scoreThreshold,
      channels,
      digestMode: form.digestMode,
      digestTime: form.digestTime,
      quietHoursStart: form.quietHoursStart,
      quietHoursEnd: form.quietHoursEnd,
    };

    if (existing) {
      const { briefId: _b, ...rest } = payload;
      void _b;
      updateSub.mutate(
        { id: existing.id, ...rest },
        { onSuccess: () => showToast('Preferences saved') },
      );
    } else {
      createSub.mutate(payload, { onSuccess: () => showToast('Alert subscription created') });
    }
  }

  function handleDelete() {
    if (!existing) return;
    deleteSub.mutate(existing.id, { onSuccess: () => showToast('Alert subscription removed') });
  }

  const isBusy = createSub.isPending || updateSub.isPending || deleteSub.isPending;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Alert Preferences</h1>

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {/* Score threshold */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Minimum match score:{' '}
              <span className="font-bold text-brand-700">{form.scoreThreshold}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={100}
              value={form.scoreThreshold}
              onChange={(e) => setForm((f) => ({ ...f, scoreThreshold: Number(e.target.value) }))}
              className="w-full accent-brand-600"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Channels */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Notification channels</p>
            <div className="flex gap-4">
              {(['push', 'email', 'sms'] as const).map((ch) => (
                <label
                  key={ch}
                  className="flex items-center gap-2 text-sm text-gray-700 capitalize"
                >
                  <input
                    type="checkbox"
                    checked={form[ch]}
                    onChange={(e) => setForm((f) => ({ ...f, [ch]: e.target.checked }))}
                    className="accent-brand-600"
                  />
                  {ch}
                </label>
              ))}
            </div>
          </div>

          {/* Digest mode */}
          <div>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <span className="text-sm font-medium text-gray-700">Digest mode (daily summary)</span>
              <div
                onClick={() => setForm((f) => ({ ...f, digestMode: !f.digestMode }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.digestMode ? 'bg-brand-600' : 'bg-gray-200'}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.digestMode ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </div>
            </label>
            {form.digestMode && (
              <div className="mt-2 px-1">
                <label className="text-xs text-gray-600">Digest time</label>
                <input
                  type="time"
                  value={form.digestTime}
                  onChange={(e) => setForm((f) => ({ ...f, digestTime: e.target.value }))}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            )}
          </div>

          {/* Quiet hours */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Quiet hours</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Start</label>
                <input
                  type="time"
                  value={form.quietHoursStart}
                  onChange={(e) => setForm((f) => ({ ...f, quietHoursStart: e.target.value }))}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <span className="mt-5 text-gray-400">to</span>
              <div className="flex-1">
                <label className="text-xs text-gray-500">End</label>
                <input
                  type="time"
                  value={form.quietHoursEnd}
                  onChange={(e) => setForm((f) => ({ ...f, quietHoursEnd: e.target.value }))}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isBusy}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {existing ? 'Save changes' : 'Enable alerts'}
            </button>
            {existing && (
              <button
                onClick={handleDelete}
                disabled={isBusy}
                className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
