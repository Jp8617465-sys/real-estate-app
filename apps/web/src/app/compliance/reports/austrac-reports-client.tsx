'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useComplianceReports,
  useGenerateReport,
  useSuspiciousMatterReports,
  useCreateSmr,
} from '@/hooks/use-compliance';
import { VerificationStatusBadge } from '@/components/compliance/verification-status-badge';
import { ReportGeneratorForm } from '@/components/compliance/report-generator-form';
import { SmrForm } from '@/components/compliance/smr-form';
import { formatDate } from '@/lib/utils';
import { AUSTRAC_REPORT_TYPE_LABELS, type GenerateAUSTRACReport, type CreateAmlSmr } from '@realflow/shared';

type ActiveTab = 'reports' | 'smr';

export function AustracReportsClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('reports');
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [showSmrForm, setShowSmrForm] = useState(false);

  const { data: reports, isLoading: reportsLoading } = useComplianceReports();
  const { data: smrReports, isLoading: smrLoading } = useSuspiciousMatterReports();
  const generateReport = useGenerateReport();
  const createSmr = useCreateSmr();

  async function handleGenerateReport(input: GenerateAUSTRACReport) {
    await generateReport.mutateAsync(input);
    setShowGenerateForm(false);
  }

  async function handleCreateSmr(input: CreateAmlSmr) {
    await createSmr.mutateAsync(input);
    setShowSmrForm(false);
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
            <h1 className="text-2xl font-bold text-gray-900">AUSTRAC Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              Compliance reports and suspicious matter reporting
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === 'reports' && (
            <button
              onClick={() => setShowGenerateForm(true)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              Generate Report
            </button>
          )}
          {activeTab === 'smr' && (
            <button
              onClick={() => setShowSmrForm(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              File SMR
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200" role="tablist" aria-label="Report sections">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('reports')}
            role="tab"
            aria-selected={activeTab === 'reports'}
            aria-controls="reports-panel"
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'reports'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Compliance Reports
          </button>
          <button
            onClick={() => setActiveTab('smr')}
            role="tab"
            aria-selected={activeTab === 'smr'}
            aria-controls="smr-panel"
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'smr'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Suspicious Matter Reports
            {smrReports && smrReports.length > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-700">
                {smrReports.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Generate Report Form */}
      {showGenerateForm && (
        <ReportGeneratorForm
          onSubmit={handleGenerateReport}
          onCancel={() => setShowGenerateForm(false)}
          isSubmitting={generateReport.isPending}
        />
      )}

      {/* SMR Form */}
      {showSmrForm && (
        <SmrForm
          onSubmit={handleCreateSmr}
          onCancel={() => setShowSmrForm(false)}
          isSubmitting={createSmr.isPending}
        />
      )}

      {/* Reports Tab Panel */}
      {activeTab === 'reports' && (
        <div id="reports-panel" role="tabpanel" aria-labelledby="reports-tab">
          {reportsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Reports Generated</h3>
              <p className="mt-1 text-sm text-gray-500">
                Generate a compliance report to review AML/KYC activity for a specific period.
              </p>
              <button
                onClick={() => setShowGenerateForm(true)}
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Generate First Report
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Report Type
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Period
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Generated
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(reports as Array<Record<string, unknown>>).map((report) => (
                    <tr key={report.id as string} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {AUSTRAC_REPORT_TYPE_LABELS[(report.type as string) as keyof typeof AUSTRAC_REPORT_TYPE_LABELS] ?? report.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {formatDate(report.period_start as string)} -- {formatDate(report.period_end as string)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {formatDate(report.generated_at as string)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <VerificationStatusBadge status={report.status as string} size="sm" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            aria-label={`Download report as CSV`}
                          >
                            CSV
                          </button>
                          <button
                            className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            aria-label={`Download report as PDF`}
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SMR Tab Panel */}
      {activeTab === 'smr' && (
        <div id="smr-panel" role="tabpanel" aria-labelledby="smr-tab">
          {smrLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : !smrReports || smrReports.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No Suspicious Matter Reports
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                SMRs are filed when suspicious activity is detected under the AML/CTF Act 2006.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(smrReports as Array<Record<string, unknown>>).map((smr) => {
                const contact = smr.contacts as Record<string, string> | null;
                const contactName = contact
                  ? `${contact.first_name} ${contact.last_name}`
                  : 'No linked contact';

                return (
                  <div
                    key={smr.id as string}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">
                            SMR -- {formatDate(smr.report_date as string)}
                          </h3>
                          <VerificationStatusBadge status={smr.status as string} size="sm" />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Contact: {contactName}
                          {!!smr.amount_aud && ` | Amount: $${Number(smr.amount_aud).toLocaleString('en-AU')} AUD`}
                          {!!smr.austrac_ref && ` | Ref: ${String(smr.austrac_ref)}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Description
                        </p>
                        <p className="mt-0.5 text-sm text-gray-700">
                          {smr.description as string}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Basis for Suspicion
                        </p>
                        <p className="mt-0.5 text-sm text-gray-700">
                          {smr.suspicion_basis as string}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Threshold Transaction Summary */}
          <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Threshold Transaction Report (TTR) Summary
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Cash transactions of $10,000 AUD or more must be reported under s.43 of the AML/CTF Act 2006
              </p>
            </div>
            <div className="p-4">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Automatic TTR Detection
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      RealFlow automatically flags transactions at or above the $10,000 AUD
                      threshold. Use the "Generate Report" button to create a TTR for a
                      specific date range covering all flagged transactions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
