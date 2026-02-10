import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Upload,
  Download,
  Clock,
} from 'lucide-react';

// ── Mock data ────────────────────────────────────────────────────────
interface MockDocument {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'spreadsheet' | 'other';
  category: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
}

const MOCK_DOCUMENTS: MockDocument[] = [
  {
    id: '1',
    name: 'Contract of Sale - 42 Latrobe Tce.pdf',
    type: 'pdf',
    category: 'Contracts',
    size: '2.4 MB',
    uploadedBy: 'Henderson & Partners',
    uploadedAt: '2026-02-05T14:30:00Z',
  },
  {
    id: '2',
    name: 'Building & Pest Report.pdf',
    type: 'pdf',
    category: 'Inspections',
    size: '8.1 MB',
    uploadedBy: 'Brisbane Building Inspections',
    uploadedAt: '2026-02-10T16:00:00Z',
  },
  {
    id: '3',
    name: 'Title Search - Lot 42 SP123456.pdf',
    type: 'pdf',
    category: 'Legal',
    size: '1.2 MB',
    uploadedBy: 'Henderson & Partners',
    uploadedAt: '2026-02-06T09:15:00Z',
  },
  {
    id: '4',
    name: 'Pre-approval Letter - Westpac.pdf',
    type: 'pdf',
    category: 'Finance',
    size: '340 KB',
    uploadedBy: 'Sarah Johnson',
    uploadedAt: '2026-01-15T11:00:00Z',
  },
  {
    id: '5',
    name: 'Property Photos - 42 Latrobe.zip',
    type: 'image',
    category: 'Property',
    size: '45.2 MB',
    uploadedBy: 'Your Agent',
    uploadedAt: '2026-02-04T10:30:00Z',
  },
  {
    id: '6',
    name: 'Flood Map - Paddington.pdf',
    type: 'pdf',
    category: 'Environmental',
    size: '890 KB',
    uploadedBy: 'Your Agent',
    uploadedAt: '2026-02-07T14:00:00Z',
  },
  {
    id: '7',
    name: 'Council Rates Notice.pdf',
    type: 'pdf',
    category: 'Council',
    size: '156 KB',
    uploadedBy: 'Henderson & Partners',
    uploadedAt: '2026-02-08T09:45:00Z',
  },
  {
    id: '8',
    name: 'Settlement Estimate.xlsx',
    type: 'spreadsheet',
    category: 'Finance',
    size: '78 KB',
    uploadedBy: 'Your Agent',
    uploadedAt: '2026-02-06T15:30:00Z',
  },
  {
    id: '9',
    name: 'Strata Search.pdf',
    type: 'pdf',
    category: 'Legal',
    size: '2.8 MB',
    uploadedBy: 'Henderson & Partners',
    uploadedAt: '2026-02-09T11:20:00Z',
  },
  {
    id: '10',
    name: 'Engagement Agreement - Signed.pdf',
    type: 'pdf',
    category: 'Contracts',
    size: '1.1 MB',
    uploadedBy: 'Sarah Johnson',
    uploadedAt: '2026-01-10T09:00:00Z',
  },
  {
    id: '11',
    name: 'Comparable Sales Report.pdf',
    type: 'pdf',
    category: 'Property',
    size: '3.4 MB',
    uploadedBy: 'Your Agent',
    uploadedAt: '2026-02-03T16:45:00Z',
  },
  {
    id: '12',
    name: 'Insurance Quote - QBE.pdf',
    type: 'pdf',
    category: 'Finance',
    size: '215 KB',
    uploadedBy: 'Sarah Johnson',
    uploadedAt: '2026-02-09T14:00:00Z',
  },
];

const FILE_ICONS: Record<
  MockDocument['type'],
  React.ComponentType<{ className?: string }>
> = {
  pdf: FileText,
  image: FileImage,
  spreadsheet: FileSpreadsheet,
  other: File,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function groupByCategory(
  docs: MockDocument[]
): Record<string, MockDocument[]> {
  const grouped: Record<string, MockDocument[]> = {};
  for (const doc of docs) {
    if (!grouped[doc.category]) {
      grouped[doc.category] = [];
    }
    grouped[doc.category].push(doc);
  }
  return grouped;
}

export default function DocumentsPage() {
  const grouped = groupByCategory(MOCK_DOCUMENTS);
  const sortedCategories = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            {MOCK_DOCUMENTS.length} files across{' '}
            {sortedCategories.length} categories
          </p>
        </div>
        <button
          type="button"
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-portal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-700"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {/* Document categories */}
      <div className="space-y-4">
        {sortedCategories.map((category) => {
          const docs = grouped[category];
          return (
            <div
              key={category}
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  {category}{' '}
                  <span className="font-normal text-gray-400">
                    ({docs.length})
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {docs.map((doc) => {
                  const Icon = FILE_ICONS[doc.type];
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
                          <span>{doc.size}</span>
                          <span className="hidden sm:inline">
                            {doc.uploadedBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(doc.uploadedAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
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
    </div>
  );
}
