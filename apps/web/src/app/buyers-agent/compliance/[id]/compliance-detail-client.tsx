'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AmlCheck,
  AmlIdentityDocument,
  AmlCheckStatus,
  AmlDocumentType,
} from '@realflow/shared';
import { AML_DOCUMENT_POINTS, AML_DOCUMENT_CATEGORIES } from '@realflow/shared';

// ─── API Helpers ──────────────────────────────────────────────────────────────

const API_BASE = '/api/v1/compliance';

interface CheckWithDocuments extends AmlCheck {
  documents: AmlIdentityDocument[];
}

async function fetchCheck(id: string): Promise<CheckWithDocuments> {
  const res = await fetch(`${API_BASE}/checks/${id}`);
  if (!res.ok) throw new Error('Failed to load AML check');
  const json = (await res.json()) as { data: CheckWithDocuments };
  return json.data;
}

interface AddDocumentPayload {
  documentType: AmlDocumentType;
  documentNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

interface AddDocumentResponse {
  document: AmlIdentityDocument;
  check: AmlCheck;
}

async function addDocument(
  checkId: string,
  payload: AddDocumentPayload,
): Promise<AddDocumentResponse> {
  const res = await fetch(`${API_BASE}/checks/${checkId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? 'Failed to add document');
  }
  const json = (await res.json()) as { data: AddDocumentResponse };
  return json.data;
}

async function deleteDocument(checkId: string, docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/checks/${checkId}/documents/${docId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove document');
}

async function completeCheck(
  checkId: string,
  outcome: 'passed' | 'failed',
  rejectionReason?: string,
): Promise<AmlCheck> {
  const res = await fetch(`${API_BASE}/checks/${checkId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome, rejectionReason }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? 'Failed to complete check');
  }
  const json = (await res.json()) as { data: AmlCheck };
  return json.data;
}

async function updateCheck(
  checkId: string,
  payload: { notes?: string; addressVerified?: boolean },
): Promise<AmlCheck> {
  const res = await fetch(`${API_BASE}/checks/${checkId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update check');
  const json = (await res.json()) as { data: AmlCheck };
  return json.data;
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

/**
 * Convert a snake_case document type to a human-readable Title Case label.
 * Special cases: drivers_licence -> "Driver's Licence", etc.
 */
const DOC_TYPE_LABELS: Record<AmlDocumentType, string> = {
  passport: 'Passport',
  birth_certificate: 'Birth Certificate',
  citizenship_certificate: 'Citizenship Certificate',
  drivers_licence: "Driver's Licence",
  government_id_card: 'Government ID Card',
  proof_of_age_card: 'Proof of Age Card',
  medicare_card: 'Medicare Card',
  credit_card: 'Credit Card',
  bank_card: 'Bank Card',
  utility_bill: 'Utility Bill',
  bank_statement: 'Bank Statement',
  council_rates: 'Council Rates Notice',
  lease_agreement: 'Lease Agreement',
  centrelink_letter: 'Centrelink Letter',
};

const CATEGORY_LABELS: Record<string, string> = {
  primary: 'Primary (70 pts)',
  secondary_a: 'Secondary A (40 pts)',
  secondary_b: 'Secondary B (25 pts)',
  supporting: 'Supporting (25 pts)',
};

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
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Points Meter ─────────────────────────────────────────────────────────────

function PointsMeter({
  current,
  required,
}: {
  current: number;
  required: number;
}) {
  const pct = Math.min((current / required) * 100, 100);
  const passed = current >= required;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">100-Point Check Progress</span>
        <span className={`font-semibold ${passed ? 'text-green-600' : 'text-yellow-600'}`}>
          {current} / {required} pts {passed ? '— Satisfied' : '— In progress'}
        </span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            passed ? 'bg-green-500' : 'bg-yellow-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {passed && (
        <p className="mt-1 text-xs text-green-600 font-medium">
          Identity verification threshold satisfied.
        </p>
      )}
      {!passed && (
        <p className="mt-1 text-xs text-gray-400">
          {required - current} more points required. Add additional identity documents below.
        </p>
      )}
    </div>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  checkId,
  onDelete,
}: {
  doc: AmlIdentityDocument;
  checkId: string;
  onDelete: (docId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(checkId, doc.id),
    onMutate: () => setDeleting(true),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aml-check', checkId] });
      onDelete(doc.id);
    },
    onError: () => setDeleting(false),
  });

  const category = AML_DOCUMENT_CATEGORIES[doc.documentType];

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">
            {DOC_TYPE_LABELS[doc.documentType]}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              doc.isExpired
                ? 'bg-red-100 text-red-600'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {doc.isExpired ? 'Expired' : `${doc.points} pts`}
          </span>
          <span className="text-xs text-gray-400">{CATEGORY_LABELS[category]}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
          {doc.documentNumber && <span>No. {doc.documentNumber}</span>}
          {doc.issuingAuthority && <span>{doc.issuingAuthority}</span>}
          {doc.expiryDate && (
            <span className={doc.isExpired ? 'text-red-500 font-medium' : ''}>
              Expires: {new Date(doc.expiryDate).toLocaleDateString('en-AU')}
            </span>
          )}
          {doc.verified && (
            <span className="text-green-600 font-medium">Verified</span>
          )}
        </div>
      </div>
      <button
        onClick={() => deleteMutation.mutate()}
        disabled={deleting}
        className="ml-3 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {deleting ? 'Removing...' : 'Remove'}
      </button>
    </div>
  );
}

// ─── Add Document Form ────────────────────────────────────────────────────────

const ALL_DOCUMENT_TYPES = Object.entries(DOC_TYPE_LABELS) as [AmlDocumentType, string][];

interface AddDocFormState {
  documentType: AmlDocumentType;
  documentNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
}

function AddDocumentForm({
  checkId,
  onSuccess,
  onCancel,
}: {
  checkId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AddDocFormState>({
    documentType: 'passport',
    documentNumber: '',
    issuingAuthority: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: AddDocumentPayload) => addDocument(checkId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aml-check', checkId] });
      onSuccess();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      const payload: AddDocumentPayload = {
        documentType: form.documentType,
      };
      if (form.documentNumber) payload.documentNumber = form.documentNumber;
      if (form.issuingAuthority) payload.issuingAuthority = form.issuingAuthority;
      if (form.issueDate) payload.issueDate = form.issueDate;
      if (form.expiryDate) payload.expiryDate = form.expiryDate;
      if (form.notes) payload.notes = form.notes;
      mutation.mutate(payload);
    },
    [form, mutation],
  );

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
      <h4 className="mb-4 text-sm font-semibold text-gray-900">Add Identity Document</h4>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Document Type</label>
          <select
            value={form.documentType}
            onChange={(e) =>
              setForm((f) => ({ ...f, documentType: e.target.value as AmlDocumentType }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {ALL_DOCUMENT_TYPES.map(([type, label]) => (
              <option key={type} value={type}>
                {label} — {AML_DOCUMENT_POINTS[type]} pts ({CATEGORY_LABELS[AML_DOCUMENT_CATEGORIES[type]]})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Document Number</label>
          <input
            type="text"
            placeholder="Optional"
            value={form.documentNumber}
            onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Issuing Authority</label>
          <input
            type="text"
            placeholder="e.g. DFAT, NSW Transport"
            value={form.issuingAuthority}
            onChange={(e) => setForm((f) => ({ ...f, issuingAuthority: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Issue Date</label>
          <input
            type="date"
            value={form.issueDate}
            onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Expiry Date</label>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
          <input
            type="text"
            placeholder="Optional notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
            {mutation.isPending ? 'Adding...' : 'Add Document'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Complete / Reject Panel ──────────────────────────────────────────────────

function CompletePanel({ checkId }: { checkId: string }) {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const passMutation = useMutation({
    mutationFn: () => completeCheck(checkId, 'passed'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['aml-check', checkId] }),
    onError: (err: Error) => setError(err.message),
  });

  const failMutation = useMutation({
    mutationFn: () => completeCheck(checkId, 'failed', rejectionReason || undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['aml-check', checkId] }),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Finalise Check</h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Rejection Reason (if failing)
          </label>
          <input
            type="text"
            placeholder="Reason for failure..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => passMutation.mutate()}
            disabled={passMutation.isPending || failMutation.isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {passMutation.isPending ? 'Marking...' : 'Mark as Passed'}
          </button>
          <button
            onClick={() => failMutation.mutate()}
            disabled={passMutation.isPending || failMutation.isPending}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {failMutation.isPending ? 'Failing...' : 'Mark as Failed'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-64 rounded bg-gray-200" />
        <div className="h-7 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 w-full rounded bg-gray-100" />
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-4 w-40 rounded bg-gray-200 mb-3" />
        <div className="h-4 w-full rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceDetailClient({ id }: { id: string }) {
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: check, isLoading, error } = useQuery({
    queryKey: ['aml-check', id],
    queryFn: () => fetchCheck(id),
    refetchOnWindowFocus: false,
  });

  const saveNotesMutation = useMutation({
    mutationFn: (n: string) => updateCheck(id, { notes: n }),
    onMutate: () => setNotesSaving(true),
    onSettled: () => setNotesSaving(false),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['aml-check', id] }),
  });

  const toggleAddressVerifiedMutation = useMutation({
    mutationFn: (verified: boolean) => updateCheck(id, { addressVerified: verified }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['aml-check', id] }),
  });

  // Initialise notes once check loads
  const handleNotesInit = useCallback((loadedNotes: string | null) => {
    if (notes === '' && loadedNotes) {
      setNotes(loadedNotes);
    }
  }, [notes]);

  if (isLoading) return <DetailSkeleton />;

  if (error || !check) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">AML check not found or failed to load.</p>
      </div>
    );
  }

  // Initialise notes state
  if (notes === '' && check.notes) {
    handleNotesInit(check.notes);
  }

  const documents = check.documents ?? [];
  const isEditable = check.status === 'in_progress' || check.status === 'pending';

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            AML Check — {check.fullLegalName ?? 'Unknown Contact'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Started: {check.startedAt ? new Date(check.startedAt).toLocaleDateString('en-AU') : 'Not started'}
            {check.expiryDate && (
              <span className="ml-3">
                Expires: {new Date(check.expiryDate).toLocaleDateString('en-AU')}
              </span>
            )}
          </p>
        </div>
        <StatusBadge status={check.status} />
      </div>

      {/* ─── Identity Information Card ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Identity Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Full Legal Name
            </p>
            <p className="mt-0.5 text-sm text-gray-900">{check.fullLegalName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Date of Birth
            </p>
            <p className="mt-0.5 text-sm text-gray-900">
              {check.dateOfBirth
                ? new Date(check.dateOfBirth).toLocaleDateString('en-AU')
                : '—'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Residential Address
            </p>
            <p className="mt-0.5 text-sm text-gray-900">{check.residentialAddress ?? '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="addr-verified"
              type="checkbox"
              checked={check.addressVerified}
              onChange={(e) => toggleAddressVerifiedMutation.mutate(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              disabled={!isEditable || toggleAddressVerifiedMutation.isPending}
            />
            <label htmlFor="addr-verified" className="text-sm text-gray-700">
              Address Verified
            </label>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Verification Method
            </p>
            <p className="mt-0.5 text-sm text-gray-900 capitalize">
              {check.verificationMethod?.replace('_', ' ') ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Points Meter ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <PointsMeter current={check.totalPoints} required={check.pointsRequired} />
      </div>

      {/* ─── Documents ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Identity Documents ({documents.length})
          </h2>
          {isEditable && (
            <button
              onClick={() => setShowAddDoc((v) => !v)}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {showAddDoc ? 'Cancel' : '+ Add Document'}
            </button>
          )}
        </div>

        {showAddDoc && (
          <div className="mb-4">
            <AddDocumentForm
              checkId={id}
              onSuccess={() => setShowAddDoc(false)}
              onCancel={() => setShowAddDoc(false)}
            />
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-gray-400">
            No documents added yet. Add at least one primary or secondary document to begin
            the 100-point check.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                checkId={id}
                onDelete={() => void queryClient.invalidateQueries({ queryKey: ['aml-check', id] })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Finalise Panel (shown only when editable) ─── */}
      {isEditable && <CompletePanel checkId={id} />}

      {/* ─── Outcome Summary (passed / failed) ─── */}
      {check.status === 'passed' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm font-semibold text-green-800">
            100-point check passed. Identity verified in accordance with AUSTRAC obligations.
          </p>
          {check.expiryDate && (
            <p className="mt-1 text-xs text-green-600">
              This verification expires on {new Date(check.expiryDate).toLocaleDateString('en-AU')}.
              A renewal check will be required after this date.
            </p>
          )}
        </div>
      )}

      {check.status === 'failed' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">Identity verification failed.</p>
          {check.rejectionReason && (
            <p className="mt-1 text-xs text-red-600">Reason: {check.rejectionReason}</p>
          )}
        </div>
      )}

      {/* ─── Compliance Notes ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Compliance Notes</h2>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about the verification process, concerns, or actions taken..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => saveNotesMutation.mutate(notes)}
            disabled={notesSaving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {notesSaving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
