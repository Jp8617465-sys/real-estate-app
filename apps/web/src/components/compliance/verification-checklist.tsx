'use client';

import { cn } from '@/lib/utils';
import { VerificationStatusBadge } from './verification-status-badge';
import {
  AML_DOCUMENT_CATEGORIES,
  type AmlDocumentType,
  type AmlDocumentCategory,
} from '@realflow/shared';

interface VerificationChecklistProps {
  documents: Array<Record<string, unknown>>;
  totalPoints: number;
  pointsRequired: number;
  addressVerified: boolean;
  onAddDocument?: () => void;
}

const CATEGORY_LABELS: Record<AmlDocumentCategory, string> = {
  primary: 'Primary ID (70 pts)',
  secondary_a: 'Secondary A (40 pts)',
  secondary_b: 'Secondary B (25 pts)',
  supporting: 'Supporting (25 pts)',
};

const DOCUMENT_TYPE_LABELS: Record<AmlDocumentType, string> = {
  passport: 'Australian Passport',
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

interface ChecklistItem {
  label: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'passed' | 'failed';
}

export function VerificationChecklist({
  documents,
  totalPoints,
  pointsRequired,
  addressVerified,
  onAddDocument,
}: VerificationChecklistProps) {
  const progressPercentage = Math.min((totalPoints / pointsRequired) * 100, 100);

  // Group documents by category
  const documentsByCategory = documents.reduce<Record<string, Array<Record<string, unknown>>>>(
    (acc, doc) => {
      const docType = doc.document_type as AmlDocumentType;
      const category = AML_DOCUMENT_CATEGORIES[docType] ?? 'supporting';
      if (!acc[category]) acc[category] = [];
      acc[category].push(doc);
      return acc;
    },
    {},
  );

  // Build checklist items
  const hasPrimaryOrSecondaryA =
    (documentsByCategory['primary']?.length ?? 0) > 0 ||
    (documentsByCategory['secondary_a']?.length ?? 0) > 0;

  const checklist: ChecklistItem[] = [
    {
      label: 'Identity Verification',
      description: `${totalPoints}/${pointsRequired} points collected`,
      status: totalPoints >= pointsRequired ? 'passed' : documents.length > 0 ? 'in_progress' : 'not_started',
    },
    {
      label: 'Primary or Secondary A Document',
      description: 'At least one passport, birth certificate, or drivers licence required',
      status: hasPrimaryOrSecondaryA ? 'passed' : 'not_started',
    },
    {
      label: 'Address Verification',
      description: 'Residential address confirmed via supporting document or declaration',
      status: addressVerified ? 'passed' : 'not_started',
    },
    {
      label: 'Source of Funds',
      description: 'Declaration of source of funds for the transaction',
      status: 'not_started',
    },
    {
      label: 'PEP Check',
      description: 'Politically Exposed Person screening completed',
      status: 'not_started',
    },
    {
      label: 'Sanctions Screening',
      description: 'DFAT consolidated sanctions list check completed',
      status: 'not_started',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Points progress */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Identity Points Progress
          </h3>
          <span className="text-sm font-medium text-gray-600">
            {totalPoints} / {pointsRequired} pts
          </span>
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuenow={totalPoints}
          aria-valuemin={0}
          aria-valuemax={pointsRequired}
          aria-label={`${totalPoints} of ${pointsRequired} identity points collected`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              progressPercentage >= 100 ? 'bg-green-500' : 'bg-brand-500',
            )}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        {totalPoints < pointsRequired && (
          <p className="mt-2 text-xs text-gray-500">
            {pointsRequired - totalPoints} more points needed to meet the 100-point identification requirement
          </p>
        )}
      </div>

      {/* Checklist */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Verification Checklist
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            AML/CTF Act 2006 compliance requirements
          </p>
        </div>
        <ul className="divide-y divide-gray-100" role="list">
          {checklist.map((item, index) => (
            <li key={index} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex-shrink-0">
                {item.status === 'passed' ? (
                  <svg
                    className="h-5 w-5 text-green-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : item.status === 'in_progress' ? (
                  <svg
                    className="h-5 w-5 text-blue-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : item.status === 'failed' ? (
                  <svg
                    className="h-5 w-5 text-red-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
              <VerificationStatusBadge status={item.status} size="sm" />
            </li>
          ))}
        </ul>
      </div>

      {/* Documents by category */}
      {documents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Submitted Documents
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {(['primary', 'secondary_a', 'secondary_b', 'supporting'] as const).map((category) => {
              const categoryDocs = documentsByCategory[category];
              if (!categoryDocs?.length) return null;
              return (
                <div key={category} className="px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <ul className="mt-2 space-y-2" role="list">
                    {categoryDocs.map((doc) => (
                      <li
                        key={doc.id as string}
                        className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>
                          <span className="text-sm text-gray-900">
                            {DOCUMENT_TYPE_LABELS[doc.document_type as AmlDocumentType] ?? doc.document_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">
                            {doc.points as number} pts
                          </span>
                          {doc.is_expired ? (
                            <VerificationStatusBadge status="expired" size="sm" />
                          ) : doc.verified ? (
                            <VerificationStatusBadge status="passed" size="sm" />
                          ) : (
                            <VerificationStatusBadge status="pending" size="sm" />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add document button */}
      {onAddDocument && (
        <button
          type="button"
          onClick={onAddDocument}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:border-brand-400 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Identity Document
        </button>
      )}
    </div>
  );
}
