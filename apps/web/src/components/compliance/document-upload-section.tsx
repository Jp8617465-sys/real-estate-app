'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AmlDocumentTypeSchema,
  AML_DOCUMENT_POINTS,
  AML_DOCUMENT_CATEGORIES,
  type AmlDocumentType,
  type AddAmlDocument,
} from '@realflow/shared';

interface DocumentUploadSectionProps {
  onSubmit: (document: AddAmlDocument) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const DOCUMENT_TYPE_OPTIONS: Array<{
  value: AmlDocumentType;
  label: string;
  points: number;
  category: string;
}> = [
  { value: 'passport', label: 'Australian Passport', points: 70, category: 'Primary' },
  { value: 'birth_certificate', label: 'Birth Certificate', points: 70, category: 'Primary' },
  { value: 'citizenship_certificate', label: 'Citizenship Certificate', points: 70, category: 'Primary' },
  { value: 'drivers_licence', label: "Driver's Licence", points: 40, category: 'Secondary A' },
  { value: 'government_id_card', label: 'Government ID Card', points: 40, category: 'Secondary A' },
  { value: 'proof_of_age_card', label: 'Proof of Age Card', points: 40, category: 'Secondary A' },
  { value: 'medicare_card', label: 'Medicare Card', points: 25, category: 'Secondary B' },
  { value: 'credit_card', label: 'Credit Card', points: 25, category: 'Secondary B' },
  { value: 'bank_card', label: 'Bank Card', points: 25, category: 'Secondary B' },
  { value: 'utility_bill', label: 'Utility Bill', points: 25, category: 'Supporting' },
  { value: 'bank_statement', label: 'Bank Statement', points: 25, category: 'Supporting' },
  { value: 'council_rates', label: 'Council Rates Notice', points: 25, category: 'Supporting' },
  { value: 'lease_agreement', label: 'Lease Agreement', points: 25, category: 'Supporting' },
  { value: 'centrelink_letter', label: 'Centrelink Letter', points: 25, category: 'Supporting' },
];

export function DocumentUploadSection({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: DocumentUploadSectionProps) {
  const [documentType, setDocumentType] = useState<AmlDocumentType | ''>('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedOption = DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === documentType);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!documentType) {
      newErrors.documentType = 'Please select a document type';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const document: AddAmlDocument = {
      documentType: documentType as AmlDocumentType,
      ...(documentNumber && { documentNumber }),
      ...(issuingAuthority && { issuingAuthority }),
      ...(issueDate && { issueDate }),
      ...(expiryDate && { expiryDate }),
      ...(notes && { notes }),
    };

    onSubmit(document);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Add Identity Document
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Record a client identity document for the 100-point check
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Document Type */}
        <div>
          <label
            htmlFor="document-type"
            className="block text-sm font-medium text-gray-700"
          >
            Document Type <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id="document-type"
            value={documentType}
            onChange={(e) => {
              setDocumentType(e.target.value as AmlDocumentType);
              setErrors((prev) => ({ ...prev, documentType: '' }));
            }}
            className={cn(
              'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500',
              errors.documentType ? 'border-red-300' : 'border-gray-300',
            )}
            required
            aria-describedby={errors.documentType ? 'document-type-error' : undefined}
            aria-invalid={!!errors.documentType}
          >
            <option value="">Select document type...</option>
            {['Primary', 'Secondary A', 'Secondary B', 'Supporting'].map((category) => (
              <optgroup key={category} label={category}>
                {DOCUMENT_TYPE_OPTIONS.filter((opt) => opt.category === category).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.points} pts)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.documentType && (
            <p id="document-type-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.documentType}
            </p>
          )}
          {selectedOption && (
            <p className="mt-1 text-xs text-gray-500">
              {selectedOption.category} document -- {selectedOption.points} points
            </p>
          )}
        </div>

        {/* Document Number */}
        <div>
          <label
            htmlFor="document-number"
            className="block text-sm font-medium text-gray-700"
          >
            Document Number
          </label>
          <input
            type="text"
            id="document-number"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder="e.g. PA1234567"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Issuing Authority */}
        <div>
          <label
            htmlFor="issuing-authority"
            className="block text-sm font-medium text-gray-700"
          >
            Issuing Authority
          </label>
          <input
            type="text"
            id="issuing-authority"
            value={issuingAuthority}
            onChange={(e) => setIssuingAuthority(e.target.value)}
            placeholder="e.g. Department of Foreign Affairs and Trade"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Date fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="issue-date"
              className="block text-sm font-medium text-gray-700"
            >
              Issue Date
            </label>
            <input
              type="date"
              id="issue-date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label
              htmlFor="expiry-date"
              className="block text-sm font-medium text-gray-700"
            >
              Expiry Date
            </label>
            <input
              type="date"
              id="expiry-date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="document-notes"
            className="block text-sm font-medium text-gray-700"
          >
            Notes
          </label>
          <textarea
            id="document-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about this document..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !documentType}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Document'}
          </button>
        </div>
      </form>
    </div>
  );
}
