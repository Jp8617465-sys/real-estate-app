'use client';

import { useState } from 'react';
import {
  useReports,
  useReportTemplates,
  useCreateReport,
  useExecuteReport,
  useDeleteReport,
} from '@/hooks/use-reports';

export default function ReportsPage() {
  const { data: reports, isLoading: reportsLoading } = useReports();
  const { data: templates } = useReportTemplates();
  const createReport = useCreateReport();
  const executeReport = useExecuteReport();
  const deleteReport = useDeleteReport();
  const [_activeReport, _setActiveReport] = useState<Record<string, unknown> | null>(null);
  const [reportResult, setReportResult] = useState<Record<string, unknown> | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleCreateFromTemplate = (template: Record<string, unknown>) => {
    createReport.mutate({
      name: template.name as string,
      description: template.description as string,
      type: template.type as string,
      chartType: template.chartType as string,
      dateRange: template.dateRange as Record<string, unknown>,
    });
    setShowTemplates(false);
  };

  const handleRunReport = (reportId: string) => {
    executeReport.mutate(reportId, {
      onSuccess: (data) => setReportResult(data as Record<string, unknown>),
    });
  };

  const reportList = (reports as Array<Record<string, unknown>>) ?? [];
  const templateList = (templates as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Build custom reports and track business performance
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            Templates
          </button>
          <button
            onClick={() => createReport.mutate({
              name: 'New Report',
              type: 'custom',
              chartType: 'table',
              dateRange: { preset: 'last_30_days' },
            })}
            disabled={createReport.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Create Report
          </button>
        </div>
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Report Templates</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {templateList.map((template) => (
              <button
                key={template.id as string}
                onClick={() => handleCreateFromTemplate(template)}
                className="rounded-lg border border-gray-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{template.name as string}</h3>
                <p className="mt-1 text-xs text-gray-500">{template.description as string}</p>
                <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {template.chartType as string}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reports List */}
      {reportsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />)}
        </div>
      ) : reportList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
          <p className="text-gray-500 dark:text-gray-400">No reports yet. Create one or start from a template.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reportList.map((report) => (
            <div
              key={report.id as string}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{report.name as string}</h3>
                <p className="text-sm text-gray-500">
                  {report.type as string} · {report.chart_type as string}
                  {Boolean(report.is_shared) && ' · Shared'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRunReport(report.id as string)}
                  disabled={executeReport.isPending}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                >
                  {executeReport.isPending ? 'Running...' : 'Run'}
                </button>
                <button
                  onClick={() => deleteReport.mutate(report.id as string)}
                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:bg-gray-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Results */}
      {reportResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Results</h2>
            <p className="text-xs text-gray-500">
              {reportResult.rowCount as number} rows · Generated {new Date(reportResult.generatedAt as string).toLocaleString('en-AU')}
            </p>
          </div>
          {(reportResult.columns as Array<Record<string, string>> ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {(reportResult.columns as Array<Record<string, string>>).map((col) => (
                      <th key={col.key} className="pb-2 text-left font-medium text-gray-500">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(reportResult.rows as Array<Record<string, unknown>> ?? []).map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                      {(reportResult.columns as Array<Record<string, string>>).map((col) => (
                        <td key={col.key} className="py-2 text-gray-900 dark:text-gray-100">
                          {col.type === 'currency'
                            ? `$${Number(row[col.key] ?? 0).toLocaleString('en-AU')}`
                            : String(row[col.key] ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data for this report configuration.</p>
          )}
        </div>
      )}
    </div>
  );
}
