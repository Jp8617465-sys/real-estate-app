'use client';

import { useRef } from 'react';
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Upload,
  Download,
  Clock,
  Loader2,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { useDocuments, useUploadDocument, useDownloadDocument } from '@/hooks/use-documents';
import type { PortalDocument } from '@/hooks/use-documents';

type FileType = 'pdf' | 'image' | 'spreadsheet' | 'other';

const FILE_ICONS: Record<FileType, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  image: FileImage,
  spreadsheet: FileSpreadsheet,
  other: File,
};

function getFileType(mimeType: string): FileType {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  )
    return 'spreadsheet';
  return 'other';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupByCategory(
  docs: PortalDocument[],
): Record<string, PortalDocument[]> {
  const grouped: Record<string, PortalDocument[]> = {};
  for (const doc of docs) {
    const cat = doc.category ?? 'other';
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(doc);
  }
  return grouped;
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function DocumentsPage() {
  const { data: documents, isLoading, error } = useDocuments();
  const uploadMutation = useUploadDocument();
  const downloadMutation = useDownloadDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadMutation.mutate(
      { file, category: 'other' },
      {
        onSuccess: () => {
          // Reset the input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        },
      },
    );
  };

  const handleDownload = async (doc: PortalDocument) => {
    downloadMutation.mutate(doc.file_path, {
      onSuccess: (url) => {
        window.open(url, '_blank');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Unable to load documents</h2>
        <p className="mt-1 text-sm text-gray-500">Please try again later.</p>
      </div>
    );
  }

  const docs = documents ?? [];
  const grouped = groupByCategory(docs);
  const sortedCategories = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            {docs.length} files across {sortedCategories.length} categories
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={uploadMutation.isPending}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-portal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-700 disabled:opacity-50"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-10 w-10 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">No documents yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Documents shared by your agent will appear here. You can also upload your own.
          </p>
        </div>
      ) : (
        /* Document categories */
        <div className="space-y-4">
          {sortedCategories.map((category) => {
            const categoryDocs = grouped[category];
            return (
              <div
                key={category}
                className="rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="border-b border-gray-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-gray-700">
                    {formatCategory(category)}{' '}
                    <span className="font-normal text-gray-400">
                      ({categoryDocs.length})
                    </span>
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {categoryDocs.map((doc) => {
                    const fileType = getFileType(doc.mime_type);
                    const Icon = FILE_ICONS[fileType];
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                          <Icon className="h-5 w-5 text-gray-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {doc.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{formatFileSize(doc.size_bytes)}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(doc.created_at)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadMutation.isPending}
                          className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
