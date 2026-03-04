'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useContact } from '@/hooks/use-contacts';
import {
  useVerifications,
  useVerification,
  useCreateVerification,
  useUpdateVerification,
  useCompleteVerification,
  useAddDocument,
} from '@/hooks/use-compliance';
import { VerificationChecklist } from '@/components/compliance/verification-checklist';
import { VerificationStatusBadge } from '@/components/compliance/verification-status-badge';
import { DocumentUploadSection } from '@/components/compliance/document-upload-section';
import { formatDate } from '@/lib/utils';
import type { AmlVerificationMethod, AddAmlDocument } from '@realflow/shared';

interface ClientVerificationClientProps {
  contactId: string;
}

export function ClientVerificationClient({ contactId }: ClientVerificationClientProps) {
  const router = useRouter();
  const { data: contact, isLoading: contactLoading } = useContact(contactId);
  const { data: verifications, isLoading: verificationsLoading } = useVerifications(contactId);
  const createVerification = useCreateVerification();

  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showStartForm, setShowStartForm] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Find the active (most recent) check
  const activeCheck = verifications?.[0] as Record<string, unknown> | undefined;
  const activeCheckId = activeCheck?.id as string | undefined;

  const updateVerification = useUpdateVerification(activeCheckId ?? '');
  const completeVerification = useCompleteVerification(activeCheckId ?? '');
  const addDocument = useAddDocument(activeCheckId ?? '');

  // Start verification form state
  const [fullLegalName, setFullLegalName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<AmlVerificationMethod>('face_to_face');

  const isLoading = contactLoading || verificationsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Not Found</h1>
          <p className="mt-1 text-sm text-gray-500">
            The requested contact could not be found.
          </p>
        </div>
        <button
          onClick={() => router.push('/compliance')}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to Compliance
        </button>
      </div>
    );
  }

  const contactRecord = contact as Record<string, unknown>;
  const contactName = `${contactRecord.first_name} ${contactRecord.last_name}`;

  async function handleStartVerification(e: React.FormEvent) {
    e.preventDefault();
    await createVerification.mutateAsync({
      contactId,
      verificationMethod,
      fullLegalName,
      dateOfBirth,
      residentialAddress,
    });
    setShowStartForm(false);
  }

  async function handleAddDocument(document: AddAmlDocument) {
    await addDocument.mutateAsync(document);
    setShowDocumentUpload(false);
  }

  async function handleComplete(outcome: 'passed' | 'failed') {
    await completeVerification.mutateAsync({
      outcome,
      ...(outcome === 'failed' && rejectionReason ? { rejectionReason } : {}),
    });
    setShowCompleteDialog(false);
    setRejectionReason('');
  }

  async function handleSaveNotes() {
    if (!activeCheckId) return;
    await updateVerification.mutateAsync({ notes });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/compliance')}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Back to compliance dashboard"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Verify: {contactName}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              AML/KYC identity verification under AML/CTF Act 2006
            </p>
          </div>
        </div>
        {activeCheck && (
          <VerificationStatusBadge status={activeCheck.status as string} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Client Details and Actions */}
        <div className="space-y-6 lg:col-span-1">
          {/* Client Details Card */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Client Details</h2>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Full Name
                </p>
                <p className="mt-1 text-sm text-gray-900">{contactName}</p>
              </div>
              {activeCheck?.date_of_birth && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Date of Birth
                  </p>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatDate(activeCheck.date_of_birth as string)}
                  </p>
                </div>
              )}
              {activeCheck?.residential_address && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Residential Address
                  </p>
                  <p className="mt-1 text-sm text-gray-900">
                    {activeCheck.residential_address as string}
                  </p>
                </div>
              )}
              {contactRecord.email && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Email
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{contactRecord.email as string}</p>
                </div>
              )}
              {contactRecord.phone && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Phone
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{contactRecord.phone as string}</p>
                </div>
              )}
              {activeCheck?.verification_method && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Verification Method
                  </p>
                  <p className="mt-1 text-sm text-gray-900">
                    {(activeCheck.verification_method as string).replace(/_/g, ' ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {activeCheck && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Verification Notes
                </h2>
              </div>
              <div className="p-4">
                <textarea
                  value={notes || (activeCheck.notes as string ?? '')}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add verification notes, observations, or audit comments..."
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label="Verification notes"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={updateVerification.isPending}
                  className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {updateVerification.isPending ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          )}

          {/* Approval/Rejection Actions */}
          {activeCheck &&
            (activeCheck.status === 'in_progress' || activeCheck.status === 'pending') && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Verification Decision
                </h2>
              </div>
              <div className="space-y-3 p-4">
                {!showCompleteDialog ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowCompleteDialog(true);
                      }}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setShowCompleteDialog(true);
                      }}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="rejection-reason"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Reason (required for rejection)
                      </label>
                      <textarea
                        id="rejection-reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={2}
                        placeholder="Provide reason for this decision..."
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleComplete('passed')}
                        disabled={completeVerification.isPending}
                        className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Confirm Approve
                      </button>
                      <button
                        onClick={() => handleComplete('failed')}
                        disabled={completeVerification.isPending || !rejectionReason}
                        className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm Reject
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setShowCompleteDialog(false);
                        setRejectionReason('');
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Checklist and Documents */}
        <div className="space-y-6 lg:col-span-2">
          {/* No active check - show start form */}
          {!activeCheck && !showStartForm && (
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No Verification Started
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Start an AML/KYC identity verification check for this client
              </p>
              <button
                onClick={() => {
                  setShowStartForm(true);
                  // Pre-fill with contact data if available
                  if (contactRecord.first_name && contactRecord.last_name) {
                    setFullLegalName(`${contactRecord.first_name} ${contactRecord.last_name}`);
                  }
                }}
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                Start Verification
              </button>
            </div>
          )}

          {/* Start verification form */}
          {!activeCheck && showStartForm && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Start AML/KYC Verification
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Begin the 100-point identity check process
                </p>
              </div>
              <form onSubmit={handleStartVerification} className="space-y-4 p-4">
                <div>
                  <label htmlFor="legal-name" className="block text-sm font-medium text-gray-700">
                    Full Legal Name <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    id="legal-name"
                    value={fullLegalName}
                    onChange={(e) => setFullLegalName(e.target.value)}
                    required
                    minLength={2}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label htmlFor="dob" className="block text-sm font-medium text-gray-700">
                    Date of Birth <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="date"
                    id="dob"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Residential Address <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    required
                    minLength={5}
                    placeholder="e.g. 42 Wallaby Way, Sydney NSW 2000"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label htmlFor="method" className="block text-sm font-medium text-gray-700">
                    Verification Method <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="method"
                    value={verificationMethod}
                    onChange={(e) => setVerificationMethod(e.target.value as AmlVerificationMethod)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="face_to_face">Face to Face</option>
                    <option value="certified_copies">Certified Copies</option>
                    <option value="electronic">Electronic Verification</option>
                    <option value="third_party">Third Party</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowStartForm(false)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createVerification.isPending}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {createVerification.isPending ? 'Starting...' : 'Start Verification'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Active check - show checklist */}
          {activeCheck && (
            <>
              <VerificationChecklist
                documents={(activeCheck as Record<string, unknown> & { documents?: Array<Record<string, unknown>> }).documents ?? []}
                totalPoints={(activeCheck.total_points as number) ?? 0}
                pointsRequired={(activeCheck.points_required as number) ?? 100}
                addressVerified={(activeCheck.address_verified as boolean) ?? false}
                onAddDocument={
                  activeCheck.status === 'in_progress' || activeCheck.status === 'pending'
                    ? () => setShowDocumentUpload(true)
                    : undefined
                }
              />

              {/* Document Upload Section */}
              {showDocumentUpload && (
                <DocumentUploadSection
                  onSubmit={handleAddDocument}
                  onCancel={() => setShowDocumentUpload(false)}
                  isSubmitting={addDocument.isPending}
                />
              )}

              {/* Rejection reason display */}
              {activeCheck.status === 'failed' && activeCheck.rejection_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <h3 className="text-sm font-semibold text-red-800">Rejection Reason</h3>
                  <p className="mt-1 text-sm text-red-700">
                    {activeCheck.rejection_reason as string}
                  </p>
                </div>
              )}

              {/* Completion info */}
              {activeCheck.status === 'passed' && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <h3 className="text-sm font-semibold text-green-800">Verification Complete</h3>
                  <p className="mt-1 text-sm text-green-700">
                    This client's identity has been verified with{' '}
                    {activeCheck.total_points as number} points.
                    {activeCheck.expiry_date && (
                      <>
                        {' '}Verification expires on {formatDate(activeCheck.expiry_date as string)}.
                      </>
                    )}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Previous verifications history */}
          {verifications && (verifications as Array<Record<string, unknown>>).length > 1 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Verification History
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {(verifications as Array<Record<string, unknown>>).slice(1).map((check) => (
                  <div
                    key={check.id as string}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-gray-900">
                        {(check.verification_method as string)?.replace(/_/g, ' ') ?? 'Unknown method'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Started {formatDate(check.created_at as string)}
                        {check.completed_at && ` -- Completed ${formatDate(check.completed_at as string)}`}
                      </p>
                    </div>
                    <VerificationStatusBadge status={check.status as string} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
