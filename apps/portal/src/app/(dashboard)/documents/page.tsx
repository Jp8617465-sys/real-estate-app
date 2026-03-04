'use client';

import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { useDocuments, useUploadDocument, useDownloadDocument } from '@/hooks/use-documents';
import type { PortalDocument } from '@/hooks/use-documents';
import { LoadingSpinner } from '@/components/loading-spinner';
import { EmptyState } from '@/components/empty-state';
import { DocumentCard } from '@/components/document-card';
import { FileUpload } from '@/components/file-upload';

const CATEGORY_LABELS: Record<string, string> = {
  contracts: 'Contracts',
  inspections: 'Inspection Reports',
  legal: 'Legal',
  finance: 'Finance',
  property: 'Property',
  environmental: 'Environmental',
  council: 'Council',
  identification: 'Identification',
  other: 'Other',
};

function groupByCategory(docs: PortalDocument[]): Record<string, PortalDocument[]> {
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

export default function DocumentsPage() {
  const { data: documents, isLoading, error } = useDocuments();
  const uploadMutation = useUploadDocument();
  const downloadMutation = useDownloadDocument();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleFileSelect = (file: File) => {
    uploadMutation.mutate({ file, category: 'other' });
  };

  const handleDownload = (doc: PortalDocument) => {
    downloadMutation.mutate(doc.file_path, {
      onSuccess: (url) => {
        window.open(url, '_blank');
      },
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading documents..." />;
  }

  if (error) {
    return (
      <EmptyState
        icon={FolderOpen}
        heading="Unable to load documents"
        description="Please try again later."
      />
    );
  }

  const docs = documents ?? [];
  const grouped = groupByCategory(docs);
  const allCategories = Object.keys(grouped).sort();

  const filteredCategories =
    selectedCategory === 'all'
      ? allCategories
      : allCategories.filter((c) => c === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          {docs.length} file{docs.length !== 1 ? 's' : ''} across{' '}
          {allCategories.length} categor{allCategories.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {/* Upload area */}
      <FileUpload
        onFileSelect={handleFileSelect}
        isUploading={uploadMutation.isPending}
      />

      {uploadMutation.isError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          Upload failed. Please try again.
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
          File uploaded successfully.
        </div>
      )}

      {/* Category filter */}
      {allCategories.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter documents by category">
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-portal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({docs.length})
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-portal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat} ({grouped[cat].length})
            </button>
          ))}
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          heading="No documents yet"
          description="Documents shared by your agent will appear here. You can also upload your own."
        />
      ) : (
        <div className="space-y-4" role="tabpanel">
          {filteredCategories.map((category) => {
            const categoryDocs = grouped[category];
            return (
              <div
                key={category}
                className="rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="border-b border-gray-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-gray-700">
                    {CATEGORY_LABELS[category] ?? category}{' '}
                    <span className="font-normal text-gray-400">
                      ({categoryDocs.length})
                    </span>
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {categoryDocs.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      onDownload={handleDownload}
                      isDownloading={downloadMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
