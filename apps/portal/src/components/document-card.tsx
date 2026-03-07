'use client';

import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Clock,
  Loader2,
  CheckCircle2,
  Pen,
} from 'lucide-react';
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

/** Status derived from document category / metadata in a real app */
type DocumentStatus = 'pending_review' | 'approved' | 'requires_signature' | 'none';

const STATUS_CONFIG: Record<DocumentStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
} | null> = {
  pending_review: {
    label: 'Pending Review',
    icon: Clock,
    className: 'text-amber-600 bg-amber-50',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'text-green-600 bg-green-50',
  },
  requires_signature: {
    label: 'Requires Signature',
    icon: Pen,
    className: 'text-red-600 bg-red-50',
  },
  none: null,
};

function deriveStatus(doc: PortalDocument): DocumentStatus {
  if (doc.category === 'contracts') return 'requires_signature';
  if (doc.category === 'inspections' || doc.category === 'legal') return 'pending_review';
  return 'none';
}

interface DocumentCardProps {
  document: PortalDocument;
  onDownload: (doc: PortalDocument) => void;
  isDownloading?: boolean;
}

export function DocumentCard({ document: doc, onDownload, isDownloading }: DocumentCardProps) {
  const fileType = getFileType(doc.mime_type);
  const Icon = FILE_ICONS[fileType];
  const status = deriveStatus(doc);
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <Icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{doc.name}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span>{formatFileSize(doc.size_bytes)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatDate(doc.created_at)}
          </span>
          {statusConfig && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusConfig.className}`}
            >
              <statusConfig.icon className="h-3 w-3" aria-hidden="true" />
              {statusConfig.label}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDownload(doc)}
        disabled={isDownloading}
        className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500"
        aria-label={`Download ${doc.name}`}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
