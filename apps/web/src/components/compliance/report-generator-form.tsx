'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AUSTRAC_REPORT_TYPE_LABELS,
  type AUSTRACReportType,
  type GenerateAUSTRACReport,
} from '@realflow/shared';

interface ReportGeneratorFormProps {
  onSubmit: (report: GenerateAUSTRACReport) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ReportGeneratorForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ReportGeneratorFormProps) {
  const [reportType, setReportType] = useState<AUSTRACReportType | ''>('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!reportType) {
      newErrors.reportType = 'Please select a report type';
    }
    if (!periodStart) {
      newErrors.periodStart = 'Start date is required';
    }
    if (!periodEnd) {
      newErrors.periodEnd = 'End date is required';
    }
    if (periodStart && periodEnd && new Date(periodStart) > new Date(periodEnd)) {
      newErrors.periodEnd = 'End date must be after start date';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      type: reportType as AUSTRACReportType,
      periodStart,
      periodEnd,
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Generate AUSTRAC Report
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Generate a compliance report for submission to AUSTRAC
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Report Type */}
        <div>
          <label
            htmlFor="report-type"
            className="block text-sm font-medium text-gray-700"
          >
            Report Type <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id="report-type"
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value as AUSTRACReportType);
              setErrors((prev) => ({ ...prev, reportType: '' }));
            }}
            className={cn(
              'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500',
              errors.reportType ? 'border-red-300' : 'border-gray-300',
            )}
            required
            aria-describedby={errors.reportType ? 'report-type-error' : undefined}
            aria-invalid={!!errors.reportType}
          >
            <option value="">Select report type...</option>
            <option value="suspicious_matter">
              {AUSTRAC_REPORT_TYPE_LABELS.suspicious_matter}
            </option>
            <option value="threshold_transaction">
              {AUSTRAC_REPORT_TYPE_LABELS.threshold_transaction}
            </option>
            <option value="international_transfer">
              {AUSTRAC_REPORT_TYPE_LABELS.international_transfer}
            </option>
          </select>
          {errors.reportType && (
            <p id="report-type-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.reportType}
            </p>
          )}
        </div>

        {/* Report type description */}
        {reportType === 'suspicious_matter' && (
          <div className="rounded-md bg-yellow-50 p-3">
            <p className="text-xs text-yellow-800">
              A Suspicious Matter Report (SMR) must be submitted to AUSTRAC within 24 hours
              of forming a suspicion, or 3 business days for less urgent matters. Under
              section 41 of the AML/CTF Act 2006.
            </p>
          </div>
        )}
        {reportType === 'threshold_transaction' && (
          <div className="rounded-md bg-blue-50 p-3">
            <p className="text-xs text-blue-800">
              A Threshold Transaction Report (TTR) must be submitted for any cash transaction
              of $10,000 AUD or more, or foreign currency equivalent. Under section 43 of the
              AML/CTF Act 2006.
            </p>
          </div>
        )}
        {reportType === 'international_transfer' && (
          <div className="rounded-md bg-indigo-50 p-3">
            <p className="text-xs text-indigo-800">
              An International Funds Transfer Instruction (IFTI) report is required for all
              international electronic funds transfers. Under section 45 of the AML/CTF Act 2006.
            </p>
          </div>
        )}

        {/* Date range */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="period-start"
              className="block text-sm font-medium text-gray-700"
            >
              Period Start <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              type="date"
              id="period-start"
              value={periodStart}
              onChange={(e) => {
                setPeriodStart(e.target.value);
                setErrors((prev) => ({ ...prev, periodStart: '' }));
              }}
              className={cn(
                'mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500',
                errors.periodStart ? 'border-red-300' : 'border-gray-300',
              )}
              required
              aria-describedby={errors.periodStart ? 'period-start-error' : undefined}
              aria-invalid={!!errors.periodStart}
            />
            {errors.periodStart && (
              <p id="period-start-error" className="mt-1 text-xs text-red-600" role="alert">
                {errors.periodStart}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="period-end"
              className="block text-sm font-medium text-gray-700"
            >
              Period End <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              type="date"
              id="period-end"
              value={periodEnd}
              onChange={(e) => {
                setPeriodEnd(e.target.value);
                setErrors((prev) => ({ ...prev, periodEnd: '' }));
              }}
              className={cn(
                'mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500',
                errors.periodEnd ? 'border-red-300' : 'border-gray-300',
              )}
              required
              aria-describedby={errors.periodEnd ? 'period-end-error' : undefined}
              aria-invalid={!!errors.periodEnd}
            />
            {errors.periodEnd && (
              <p id="period-end-error" className="mt-1 text-xs text-red-600" role="alert">
                {errors.periodEnd}
              </p>
            )}
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
            disabled={isSubmitting || !reportType || !periodStart || !periodEnd}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </form>
    </div>
  );
}
