'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { CreateAmlSmr } from '@realflow/shared';

interface SmrFormProps {
  onSubmit: (data: CreateAmlSmr) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function SmrForm({ onSubmit, onCancel, isSubmitting = false }: SmrFormProps) {
  const [contactId, setContactId] = useState('');
  const [description, setDescription] = useState('');
  const [suspicionBasis, setSuspicionBasis] = useState('');
  const [amountAud, setAmountAud] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!description || description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }
    if (!suspicionBasis || suspicionBasis.length < 10) {
      newErrors.suspicionBasis = 'Basis for suspicion must be at least 10 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const data: CreateAmlSmr = {
      description,
      suspicionBasis,
      ...(contactId && { contactId }),
      ...(amountAud && { amountAud: parseFloat(amountAud) }),
    };

    onSubmit(data);
  }

  return (
    <div className="rounded-lg border border-red-200 bg-white">
      <div className="border-b border-red-200 bg-red-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-red-900">
          Suspicious Matter Report (SMR)
        </h3>
        <p className="mt-0.5 text-xs text-red-700">
          Under s.41 of the AML/CTF Act 2006, you must report suspicious matters to AUSTRAC
          within 24 hours (or 3 business days for non-urgent matters).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Contact ID (optional) */}
        <div>
          <label
            htmlFor="smr-contact-id"
            className="block text-sm font-medium text-gray-700"
          >
            Related Contact ID (optional)
          </label>
          <input
            type="text"
            id="smr-contact-id"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            placeholder="UUID of the related contact"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="smr-description"
            className="block text-sm font-medium text-gray-700"
          >
            Description of Suspicious Activity{' '}
            <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="smr-description"
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((prev) => ({ ...prev, description: '' }));
            }}
            placeholder="Describe the suspicious activity in detail, including what occurred, when, and who was involved..."
            className={cn(
              'mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500',
              errors.description ? 'border-red-300' : 'border-gray-300',
            )}
            required
            aria-describedby={errors.description ? 'smr-description-error' : undefined}
            aria-invalid={!!errors.description}
          />
          {errors.description && (
            <p id="smr-description-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.description}
            </p>
          )}
        </div>

        {/* Suspicion Basis */}
        <div>
          <label
            htmlFor="smr-suspicion-basis"
            className="block text-sm font-medium text-gray-700"
          >
            Basis for Suspicion{' '}
            <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="smr-suspicion-basis"
            rows={3}
            value={suspicionBasis}
            onChange={(e) => {
              setSuspicionBasis(e.target.value);
              setErrors((prev) => ({ ...prev, suspicionBasis: '' }));
            }}
            placeholder="Explain why this activity is suspicious, including any indicators or red flags observed..."
            className={cn(
              'mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500',
              errors.suspicionBasis ? 'border-red-300' : 'border-gray-300',
            )}
            required
            aria-describedby={errors.suspicionBasis ? 'smr-basis-error' : undefined}
            aria-invalid={!!errors.suspicionBasis}
          />
          {errors.suspicionBasis && (
            <p id="smr-basis-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.suspicionBasis}
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label
            htmlFor="smr-amount"
            className="block text-sm font-medium text-gray-700"
          >
            Amount (AUD) (optional)
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500">
              $
            </span>
            <input
              type="number"
              id="smr-amount"
              value={amountAud}
              onChange={(e) => setAmountAud(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Warning */}
        <div className="rounded-md bg-yellow-50 p-3">
          <div className="flex gap-2">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-yellow-800">
              Do not inform the client or any other person that an SMR has been or will be
              submitted. Tipping off is a criminal offence under s.123 of the AML/CTF Act 2006.
            </p>
          </div>
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
            disabled={isSubmitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit SMR'}
          </button>
        </div>
      </form>
    </div>
  );
}
