'use client';

import { useState, useCallback } from 'react';
import {
  useImportJobs,
  useCreateImportJob,
  useImportPreview,
  useSetFieldMappings,
  useExecuteImport,
} from '@/hooks/use-imports';

const STATUS_BADGES: Record<string, string> = {
  uploaded: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  mapping: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  previewing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

export default function ImportsPage() {
  const { data: jobs, isLoading } = useImportJobs();
  const createJob = useCreateImportJob();
  const importPreview = useImportPreview();
  const setMappings = useSetFieldMappings();
  const executeImport = useExecuteImport();

  const [step, setStep] = useState<'list' | 'upload' | 'preview' | 'mapping' | 'executing'>('list');
  const [entityType, setEntityType] = useState<'contacts' | 'properties'>('contacts');
  const [parsedRows, setParsedRows] = useState<Array<Record<string, string>>>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const headers = lines[0]!.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, i) => { row[header] = values[i] ?? ''; });
        return row;
      });

      setParsedRows(rows);

      createJob.mutate(
        { source: 'csv', entityType, fileName: file.name, fileSize: file.size },
        {
          onSuccess: (data) => {
            const jobData = data as Record<string, unknown>;
            setActiveJobId(jobData.id as string);

            importPreview.mutate(
              { id: jobData.id as string, rows: rows.slice(0, 100) },
              {
                onSuccess: (previewData) => {
                  setPreview(previewData as Record<string, unknown>);
                  setStep('preview');
                },
              },
            );
          },
        },
      );
    };
    reader.readAsText(file);
  }, [entityType, createJob, importPreview]);

  const handleConfirmMappings = () => {
    if (!activeJobId || !preview) return;
    const mappings = (preview.suggestedMappings as unknown[]) ?? [];

    setMappings.mutate(
      { id: activeJobId, fieldMappings: mappings, skipDuplicates: true },
      {
        onSuccess: () => {
          setStep('executing');
          executeImport.mutate(
            { id: activeJobId, rows: parsedRows },
            { onSuccess: () => setStep('list') },
          );
        },
      },
    );
  };

  const jobList = (jobs as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Import</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Import contacts and properties from CSV, HubSpot, Rex, or other CRMs
          </p>
        </div>
        {step === 'list' && (
          <button
            onClick={() => setStep('upload')}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New Import
          </button>
        )}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload CSV File</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Import Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setEntityType('contacts')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${entityType === 'contacts' ? 'bg-brand-600 text-white' : 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'}`}
              >
                Contacts
              </button>
              <button
                onClick={() => setEntityType('properties')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${entityType === 'properties' ? 'bg-brand-600 text-white' : 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'}`}
              >
                Properties
              </button>
            </div>
          </div>
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Drop your CSV file here or click to browse
              </p>
              <p className="mt-1 text-sm text-gray-500">Supports .csv files up to 10MB</p>
            </label>
          </div>
          <button
            onClick={() => setStep('list')}
            className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200"
          >
            Back
          </button>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && preview && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Import Preview</h2>
          <p className="text-sm text-gray-500 mb-4">
            {preview.totalRows as number} rows detected · {(preview.suggestedMappings as unknown[])?.length ?? 0} fields auto-mapped
            {(preview.duplicateCount as number) > 0 && (
              <span className="text-amber-600"> · {preview.duplicateCount as number} potential duplicates</span>
            )}
          </p>

          {/* Suggested Mappings */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Field Mappings</h3>
            <div className="space-y-1">
              {((preview.suggestedMappings as Array<Record<string, string>>) ?? []).map((mapping, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    {mapping.sourceColumn}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="rounded bg-brand-100 px-2 py-0.5 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                    {mapping.targetField}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Rows */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-left font-medium text-gray-500">Row</th>
                  {((preview.detectedColumns as string[]) ?? []).slice(0, 5).map(col => (
                    <th key={col} className="pb-2 text-left font-medium text-gray-500">{col}</th>
                  ))}
                  <th className="pb-2 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {((preview.previewRows as Array<Record<string, unknown>>) ?? []).map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-1 text-gray-500">{row.rowNumber as number}</td>
                    {((preview.detectedColumns as string[]) ?? []).slice(0, 5).map(col => (
                      <td key={col} className="py-1 text-gray-900 dark:text-gray-100">
                        {String((row.mapped as Record<string, unknown>)?.[col] ?? '-')}
                      </td>
                    ))}
                    <td className="py-1">
                      {Boolean(row.isDuplicate) && <span className="text-amber-600 text-xs">Duplicate</span>}
                      {((row.warnings as string[]) ?? []).length > 0 && <span className="text-red-600 text-xs">Warning</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirmMappings}
              disabled={setMappings.isPending || executeImport.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {setMappings.isPending || executeImport.isPending ? 'Importing...' : `Import ${preview.totalRows as number} Rows`}
            </button>
            <button
              onClick={() => setStep('list')}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Executing Step */}
      {step === 'executing' && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="animate-spin h-8 w-8 border-4 border-brand-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Importing data...</p>
          <p className="text-sm text-gray-500 mt-1">This may take a moment for large files</p>
        </div>
      )}

      {/* Job History (List Step) */}
      {step === 'list' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Import History</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />)}
            </div>
          ) : jobList.length === 0 ? (
            <p className="text-sm text-gray-500">No imports yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-left font-medium text-gray-500">File</th>
                  <th className="pb-2 text-left font-medium text-gray-500">Type</th>
                  <th className="pb-2 text-left font-medium text-gray-500">Status</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Rows</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Success</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Errors</th>
                  <th className="pb-2 text-left font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {jobList.map(job => (
                  <tr key={job.id as string} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 text-gray-900 dark:text-gray-100">{job.file_name as string}</td>
                    <td className="py-2 text-gray-500 capitalize">{job.entity_type as string}</td>
                    <td className="py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[job.status as string] ?? STATUS_BADGES.uploaded}`}>
                        {job.status as string}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-900 dark:text-gray-100">{job.total_rows as number}</td>
                    <td className="py-2 text-right text-green-600">{job.success_count as number}</td>
                    <td className="py-2 text-right text-red-600">{job.error_count as number}</td>
                    <td className="py-2 text-gray-500">
                      {new Date(job.created_at as string).toLocaleDateString('en-AU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
