'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatDate } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/stat-card';
import {
  BUYER_STAGE_LABELS,
  BUYERS_AGENT_STAGE_LABELS,
  type BuyerStage,
  type BuyersAgentStage,
} from '@realflow/shared';

// ─── Types ──────────────────────────────────────────────────────────

interface MigrationTransaction {
  transactionId: string;
  contactName: string;
  currentStage: BuyerStage;
  targetStage: BuyersAgentStage;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  requiresBrief: boolean;
  edgeCases: string[];
}

interface MigrationPreview {
  totalTransactions: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  requiresBrief: number;
  transactions: MigrationTransaction[];
}

interface MigrationHistoryItem {
  id: string;
  batchId: string;
  transactionCount: number;
  performedBy: string;
  performedByName: string;
  createdAt: string;
  reason?: string;
}

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  failedCount: number;
  batchId: string;
  errors?: Array<{ transactionId: string; error: string }>;
}

// ─── API Hooks ──────────────────────────────────────────────────────

function useMigrationPreview() {
  return useQuery<MigrationPreview>({
    queryKey: ['pipeline-migration-preview'],
    queryFn: async () => {
      const response = await fetch('/api/v1/pipeline-migration/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Failed to load migration preview');
      }
      const json = await response.json();
      return json.data;
    },
    enabled: false, // Manual trigger only
  });
}

function useMigrationHistory() {
  return useQuery<MigrationHistoryItem[]>({
    queryKey: ['pipeline-migration-history'],
    queryFn: async () => {
      const response = await fetch('/api/v1/pipeline-migration/history');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Failed to load migration history');
      }
      const json = await response.json();
      return json.data;
    },
  });
}

function useExecuteMigration() {
  const queryClient = useQueryClient();

  return useMutation<MigrationResult, Error, { transactionIds: string[]; userId: string; reason?: string }>({
    mutationFn: async ({ transactionIds, userId, reason }) => {
      const response = await fetch('/api/v1/pipeline-migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds, userId, reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Failed to execute migration');
      }
      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-migration-preview'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-migration-history'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// ─── Components ─────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        confidence === 'high' && 'bg-green-100 text-green-700',
        confidence === 'medium' && 'bg-yellow-100 text-yellow-700',
        confidence === 'low' && 'bg-orange-100 text-orange-700',
      )}
    >
      {confidence}
    </span>
  );
}

function EdgeCaseAlert({ cases }: { cases: string[] }) {
  if (cases.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 p-2">
      <p className="text-xs font-medium text-orange-800">Edge Cases:</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-orange-700">
        {cases.map((edgeCase, idx) => (
          <li key={idx}>{edgeCase}</li>
        ))}
      </ul>
    </div>
  );
}

function TransactionRow({
  transaction,
  isSelected,
  onToggle,
}: {
  transaction: MigrationTransaction;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-medium text-gray-900">{transaction.contactName}</p>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {BUYER_STAGE_LABELS[transaction.currentStage]}
          </span>
          <span className="text-gray-400">→</span>
          <span className="text-sm font-medium text-brand-600">
            {BUYERS_AGENT_STAGE_LABELS[transaction.targetStage]}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <ConfidenceBadge confidence={transaction.confidence} />
      </td>
      <td className="px-6 py-4">
        {transaction.requiresBrief && (
          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            Brief Required
          </span>
        )}
      </td>
      <td className="px-6 py-4">
        <div>
          <p className="text-sm text-gray-600">{transaction.reason}</p>
          <EdgeCaseAlert cases={transaction.edgeCases} />
        </div>
      </td>
    </tr>
  );
}

function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  isExecuting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedCount: number;
  isExecuting: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Confirm Migration</h3>
        <p className="mt-2 text-sm text-gray-600">
          You are about to migrate <span className="font-semibold">{selectedCount}</span> transaction(s) from the Buying pipeline to the Buyers Agent pipeline.
        </p>
        <p className="mt-2 text-sm text-orange-600">
          This action cannot be undone. Please review the selected transactions before proceeding.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isExecuting}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {isExecuting ? 'Migrating...' : 'Confirm Migration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

type ViewTab = 'preview' | 'history';

export default function PipelineMigrationPage() {
  const [tab, setTab] = useState<ViewTab>('preview');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [migrationReason, setMigrationReason] = useState('');

  const { data: preview, isLoading: isLoadingPreview, error: previewError, refetch: refetchPreview } = useMigrationPreview();
  const { data: history, isLoading: isLoadingHistory, error: historyError } = useMigrationHistory();
  const { mutate: executeMigration, isPending: isExecuting, data: migrationResult, error: executionError } = useExecuteMigration();

  const handleToggleTransaction = (transactionId: string) => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!preview?.transactions) return;
    if (selectedTransactionIds.size === preview.transactions.length) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(preview.transactions.map((t) => t.transactionId)));
    }
  };

  const handleLoadPreview = () => {
    setSelectedTransactionIds(new Set());
    refetchPreview();
  };

  const handleMigrateSelected = () => {
    if (selectedTransactionIds.size === 0) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmMigration = () => {
    // Use a placeholder user ID (would come from auth context in production)
    const userId = '00000000-0000-0000-0000-000000000001';
    executeMigration({
      transactionIds: Array.from(selectedTransactionIds),
      userId,
      reason: migrationReason || undefined,
    }, {
      onSuccess: () => {
        setShowConfirmDialog(false);
        setSelectedTransactionIds(new Set());
        setMigrationReason('');
      },
    });
  };

  const allSelected = preview?.transactions && selectedTransactionIds.size === preview.transactions.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pipeline Migration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Migrate transactions from Buying pipeline to Buyers Agent pipeline
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        {(['preview', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Preview Tab */}
      {tab === 'preview' && (
        <>
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadPreview}
              disabled={isLoadingPreview}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {isLoadingPreview ? 'Loading...' : 'Load Preview'}
            </button>
            {preview && preview.transactions.length > 0 && (
              <>
                <button
                  onClick={handleSelectAll}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleMigrateSelected}
                  disabled={selectedTransactionIds.size === 0 || isExecuting}
                  className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  Migrate Selected ({selectedTransactionIds.size})
                </button>
              </>
            )}
          </div>

          {/* Error Display */}
          {(previewError || executionError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="mt-1 text-sm text-red-700">
                {previewError?.message || executionError?.message}
              </p>
            </div>
          )}

          {/* Success Display */}
          {migrationResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">Migration Complete</p>
              <p className="mt-1 text-sm text-green-700">
                Successfully migrated {migrationResult.migratedCount} transaction(s).
                {migrationResult.failedCount > 0 && ` ${migrationResult.failedCount} failed.`}
              </p>
              {migrationResult.errors && migrationResult.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-green-700">
                  {migrationResult.errors.map((err, idx) => (
                    <li key={idx}>Transaction {err.transactionId}: {err.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Overview Cards */}
          {preview && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                title="Total Transactions"
                value={String(preview.totalTransactions)}
                change="To migrate"
                changeType="neutral"
              />
              <StatCard
                title="High Confidence"
                value={String(preview.highConfidence)}
                change="Safe to migrate"
                changeType="positive"
              />
              <StatCard
                title="Medium Confidence"
                value={String(preview.mediumConfidence)}
                change="Review recommended"
                changeType="neutral"
              />
              <StatCard
                title="Low Confidence"
                value={String(preview.lowConfidence)}
                change="Manual review required"
                changeType="negative"
              />
              <StatCard
                title="Brief Required"
                value={String(preview.requiresBrief)}
                change="Will auto-create"
                changeType="neutral"
              />
            </div>
          )}

          {/* Optional Reason Input */}
          {preview && preview.transactions.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <label htmlFor="migration-reason" className="block text-sm font-medium text-gray-700">
                Migration Reason (Optional)
              </label>
              <input
                id="migration-reason"
                type="text"
                value={migrationReason}
                onChange={(e) => setMigrationReason(e.target.value)}
                placeholder="e.g., Converting to buyers agent service"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}

          {/* Transaction Table */}
          {preview && preview.transactions.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-8 px-6 py-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Stage Mapping
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Confidence
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Brief Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {preview.transactions.map((transaction) => (
                      <TransactionRow
                        key={transaction.transactionId}
                        transaction={transaction}
                        isSelected={selectedTransactionIds.has(transaction.transactionId)}
                        onToggle={() => handleToggleTransaction(transaction.transactionId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingPreview && !preview && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
              <p className="text-sm font-medium text-gray-900">No preview loaded</p>
              <p className="mt-1 text-sm text-gray-500">
                Click "Load Preview" to analyze transactions for migration.
              </p>
            </div>
          )}

          {/* No Transactions State */}
          {preview && preview.transactions.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
              <p className="text-sm font-medium text-gray-900">No transactions to migrate</p>
              <p className="mt-1 text-sm text-gray-500">
                All eligible transactions have been processed or none exist.
              </p>
            </div>
          )}
        </>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <>
          {/* Loading State */}
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-gray-500">Loading history...</div>
            </div>
          )}

          {/* Error State */}
          {historyError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">Failed to load history. Please try again.</p>
            </div>
          )}

          {/* History Table */}
          {!isLoadingHistory && history && history.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Batch ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Transactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Performed By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <code className="text-xs text-gray-600">{item.batchId.slice(0, 8)}</code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {item.transactionCount}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{item.performedByName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{formatDate(item.createdAt)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{item.reason || '-'}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingHistory && history && history.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
              <p className="text-sm font-medium text-gray-900">No migration history</p>
              <p className="mt-1 text-sm text-gray-500">
                Migration history will appear here once you perform migrations.
              </p>
            </div>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmMigration}
        selectedCount={selectedTransactionIds.size}
        isExecuting={isExecuting}
      />
    </div>
  );
}
