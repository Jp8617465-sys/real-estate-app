'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import type { AmlCheck, AmlCheckStatus, AmlVerificationMethod } from '@realflow/shared';

// ─── API Helpers ──────────────────────────────────────────────────────────────

const API_BASE = '/api/v1/compliance';

async function fetchChecks(params?: { status?: string; contactId?: string }): Promise<AmlCheck[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.contactId) qs.set('contactId', params.contactId);
  const url = `${API_BASE}/checks${qs.toString() ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch AML checks');
  const json = (await res.json()) as { data: AmlCheck[] };
  return json.data;
}

async function fetchExpiringChecks(daysAhead = 90): Promise<AmlCheck[]> {
  const res = await fetch(`${API_BASE}/expiring?daysAhead=${daysAhead}`);
  if (!res.ok) throw new Error('Failed to fetch expiring checks');
  const json = (await res.json()) as { data: AmlCheck[] };
  return json.data;
}

interface CreateCheckPayload {
  contactId: string;
  verificationMethod: AmlVerificationMethod;
  fullLegalName: string;
  dateOfBirth: string;
  residentialAddress: string;
}

async function createCheck(payload: CreateCheckPayload): Promise<AmlCheck> {
  const res = await fetch(`${API_BASE}/checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? 'Failed to create AML check');
  }
  const json = (await res.json()) as { data: AmlCheck };
  return json.data;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AmlCheckStatus, string> = {
  passed: 'bg-green-100 text-green-700 ring-green-300',
  failed: 'bg-red-100 text-red-700 ring-red-300',
  in_progress: 'bg-yellow-100 text-yellow-700 ring-yellow-300',
  pending: 'bg-gray-100 text-gray-600 ring-gray-300',
  expired: 'bg-orange-100 text-orange-700 ring-orange-300',
  waived: 'bg-blue-100 text-blue-600 ring-blue-300',
};

const STATUS_LABELS: Record<AmlCheckStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  in_progress: 'In Progress',
  pending: 'Pending',
  expired: 'Expired',
  waived: 'Waived',
};

function StatusBadge({ status }: { status: AmlCheckStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

// ─── New Check Form ───────────────────────────────────────────────────────────

const VERIFICATION_METHODS: { value: AmlVerificationMethod; label: string }[] = [
  { value: 'face_to_face', label: 'Face to Face' },
  { value: 'certified_copies', label: 'Certified Copies' },
  { value: 'electronic', label: 'Electronic Verification' },
  { value: 'third_party', label: 'Third Party' },
];

interface NewCheckFormState {
  contactId: string;
  verificationMethod: AmlVerificationMethod;
  fullLegalName: string;
  dateOfBirth: string;
  residentialAddress: string;
}

function NewCheckForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewCheckFormState>({
    contactId: '',
    verificationMethod: 'face_to_face',
    fullLegalName: '',
    dateOfBirth: '',
    residentialAddress: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createCheck,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aml-checks'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      if (!form.contactId.trim()) {
        setFormError('Contact ID is required');
        return;
      }
      mutation.mutate(form);
    },
    [form, mutation],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-gray-900">Start New AML/KYC Check</h3>
      <p className="mb-4 text-sm text-gray-500">
        Under AUSTRAC obligations, Australian buyers agents must conduct a 100-point identity check
        for each client before engaging.
      </p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Contact ID</label>
          <input
            type="text"
            required
            placeholder="UUID of the contact"
            value={form.contactId}
            onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Verification Method</label>
          <select
            value={form.verificationMethod}
            onChange={(e) =>
              setForm((f) => ({ ...f, verificationMethod: e.target.value as AmlVerificationMethod }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {VERIFICATION_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Full Legal Name</label>
          <input
            type="text"
            required
            placeholder="As shown on documents"
            value={form.fullLegalName}
            onChange={(e) => setForm((f) => ({ ...f, fullLegalName: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date of Birth</label>
          <input
            type="date"
            required
            value={form.dateOfBirth}
            onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Residential Address</label>
          <input
            type="text"
            required
            placeholder="Street, Suburb, State Postcode"
            value={form.residentialAddress}
            onChange={(e) => setForm((f) => ({ ...f, residentialAddress: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {formError && (
          <div className="sm:col-span-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <div className="sm:col-span-2 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Starting...' : 'Start Check'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Checks Table ─────────────────────────────────────────────────────────────

function ChecksTable({ checks }: { checks: AmlCheck[] }) {
  if (checks.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-600">No AML checks yet.</p>
        <p className="mt-1 text-sm text-gray-400">
          Start one for each client before engaging. AUSTRAC requires identity verification prior to
          providing buyers agent services.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Points
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Method
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Completed
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {checks.map((check) => (
            <tr key={check.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <p className="text-sm font-medium text-gray-900">
                  {check.fullLegalName ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-400">{check.contactId.slice(0, 8)}...</p>
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={check.status} />
              </td>
              <td className="px-6 py-4">
                <span
                  className={`text-sm font-semibold ${check.totalPoints >= 100 ? 'text-green-600' : 'text-yellow-600'}`}
                >
                  {check.totalPoints} / {check.pointsRequired}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                {check.verificationMethod?.replace('_', ' ') ?? '—'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {check.completedAt
                  ? new Date(check.completedAt).toLocaleDateString('en-AU')
                  : '—'}
              </td>
              <td className="px-6 py-4 text-right">
                <Link
                  href={`/buyers-agent/compliance/${check.id}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="animate-pulse">
        <div className="bg-gray-50 px-6 py-3">
          <div className="h-3 w-64 rounded bg-gray-200" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-6 border-t border-gray-100 px-6 py-4">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-100" />
            <div className="h-4 w-12 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="ml-auto h-7 w-12 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceClient() {
  const [showNewForm, setShowNewForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const {
    data: checks,
    isLoading: checksLoading,
  } = useQuery({
    queryKey: ['aml-checks', statusFilter],
    queryFn: () => fetchChecks(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: expiringChecks } = useQuery({
    queryKey: ['aml-checks-expiring'],
    queryFn: () => fetchExpiringChecks(90),
  });

  const allChecks = checks ?? [];
  const expiring = expiringChecks ?? [];

  const passedCount = allChecks.filter((c) => c.status === 'passed').length;
  const pendingCount = allChecks.filter(
    (c) => c.status === 'pending' || c.status === 'in_progress',
  ).length;

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AML/KYC Compliance</h1>
          <p className="mt-1 text-sm text-gray-500">
            100-point identity checks required under AUSTRAC obligations.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showNewForm ? 'Cancel' : '+ Start New Check'}
        </button>
      </div>

      {/* ─── Expiring Soon Banner ─── */}
      {expiring.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="mb-2 text-sm font-semibold text-orange-800">
            {expiring.length} check{expiring.length > 1 ? 's' : ''} expiring within 90 days
          </p>
          <ul className="space-y-1">
            {expiring.map((check) => (
              <li key={check.id} className="flex items-center justify-between text-sm text-orange-700">
                <span>{check.fullLegalName ?? check.contactId}</span>
                <span className="text-xs text-orange-500">
                  Expires:{' '}
                  {check.expiryDate
                    ? new Date(check.expiryDate).toLocaleDateString('en-AU')
                    : 'Unknown'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── New Check Form ─── */}
      {showNewForm && (
        <NewCheckForm
          onSuccess={() => setShowNewForm(false)}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* ─── KPI Stats Row ─── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Checks" value={allChecks.length} />
        <KpiCard label="Passed" value={passedCount} accent="text-green-600" />
        <KpiCard label="Pending / In Progress" value={pendingCount} accent="text-yellow-600" />
        <KpiCard label="Expiring Soon" value={expiring.length} accent="text-orange-600" />
      </div>

      {/* ─── Status Filter ─── */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        {['', 'pending', 'in_progress', 'passed', 'failed', 'expired'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : STATUS_LABELS[s as AmlCheckStatus]}
          </button>
        ))}
      </div>

      {/* ─── Checks Table ─── */}
      {checksLoading ? (
        <TableSkeleton />
      ) : (
        <ChecksTable checks={allChecks} />
      )}
    </div>
  );
}
