import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { storageGet, storageSet, StorageKeys } from '../lib/offline-storage';
import { enqueue, subscribeSyncQueue, type SyncQueueStatus } from '../lib/sync-queue';
import { useNetworkStatus } from './useNetworkStatus';
import type { Transaction, PipelineType } from '@realflow/shared';

// ─── Types ─────────────────────────────────────────────────────────

interface TransactionWithContact extends Transaction {
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    buyer_profile: Record<string, unknown> | null;
  };
}

interface UseOfflinePipelineResult {
  /** List of pipeline transactions (from cache or server) */
  transactions: TransactionWithContact[];
  /** Whether transactions are being loaded */
  isLoading: boolean;
  /** Whether the displayed data is from cache */
  isStale: boolean;
  /** Error from the last fetch attempt */
  error: Error | null;
  /** ISO timestamp of last successful sync */
  lastSyncedAt: string | null;
  /** Move a deal to a new stage (works offline) */
  moveToStage: (transactionId: string, newStage: string) => Promise<TransactionWithContact>;
  /** Update a transaction (works offline) */
  updateTransaction: (
    transactionId: string,
    data: Partial<Transaction>,
  ) => Promise<TransactionWithContact>;
  /** Manually refresh pipeline from the server */
  refresh: () => Promise<void>;
}

// ─── Constants ─────────────────────────────────────────────────────

const PIPELINE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Hook ──────────────────────────────────────────────────────────

export function useOfflinePipeline(
  userId: string,
  pipelineType: PipelineType,
): UseOfflinePipelineResult {
  const [transactions, setTransactions] = useState<TransactionWithContact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  const cacheKey = StorageKeys.pipeline(userId, pipelineType);

  // ─── Load cached pipeline on mount ─────────────────────────────
  useEffect(() => {
    void loadCachedPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pipelineType]);

  async function loadCachedPipeline(): Promise<void> {
    const cached = await storageGet<TransactionWithContact[]>(cacheKey);
    if (cached && mountedRef.current) {
      setTransactions(cached);
      setIsStale(true);
      setIsLoading(false);
    }
  }

  // ─── Fetch from server when online ─────────────────────────────
  const fetchFromServer = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*, contact:contacts(id, first_name, last_name, buyer_profile)')
        .eq('pipeline_type', pipelineType)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (fetchError) throw new Error(fetchError.message);

      const serverTransactions = data as TransactionWithContact[];

      if (!mountedRef.current) return;

      setTransactions(serverTransactions);
      setIsStale(false);
      setLastSyncedAt(new Date().toISOString());

      // Persist to cache
      await storageSet(cacheKey, serverTransactions, PIPELINE_TTL_MS);

      // Update React Query cache
      queryClient.setQueryData(['pipeline', pipelineType], serverTransactions);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err : new Error('Failed to fetch pipeline'),
      );
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, pipelineType, queryClient]);

  useEffect(() => {
    if (isOnline) {
      void fetchFromServer();
    }
  }, [isOnline, fetchFromServer]);

  // ─── Listen for sync queue changes ─────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeSyncQueue((status: SyncQueueStatus) => {
      if (!status.isProcessing && status.pendingCount === 0 && isOnline) {
        void fetchFromServer();
      }
    });
    return unsubscribe;
  }, [isOnline, fetchFromServer]);

  // ─── Move deal to stage (works offline) ────────────────────────
  const moveToStage = useCallback(
    async (
      transactionId: string,
      newStage: string,
    ): Promise<TransactionWithContact> => {
      const now = new Date().toISOString();
      let updatedTransaction: TransactionWithContact | null = null;

      // Optimistic update
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id !== transactionId) return t;
          const updated: TransactionWithContact = {
            ...t,
            currentStage: newStage,
            updatedAt: now,
          };
          updatedTransaction = updated;
          return updated;
        }),
      );

      if (!updatedTransaction) {
        throw new Error(
          `Transaction with id ${transactionId} not found in local state`,
        );
      }

      // Persist to cache
      const cached =
        (await storageGet<TransactionWithContact[]>(cacheKey)) ?? [];
      await storageSet(
        cacheKey,
        cached.map((t) =>
          t.id === transactionId ? updatedTransaction : t,
        ),
        PIPELINE_TTL_MS,
      );

      // Queue for sync
      await enqueue(
        'update',
        'transactions',
        { current_stage: newStage },
        transactionId,
      );

      // If online, try to sync immediately
      if (isOnline) {
        try {
          const { data: serverData, error: updateError } = await supabase
            .from('transactions')
            .update({ current_stage: newStage })
            .eq('id', transactionId)
            .select('*, contact:contacts(id, first_name, last_name, buyer_profile)')
            .single();

          if (updateError) throw new Error(updateError.message);

          const serverTransaction = serverData as TransactionWithContact;

          setTransactions((prev) =>
            prev.map((t) =>
              t.id === transactionId ? serverTransaction : t,
            ),
          );

          const currentCache =
            (await storageGet<TransactionWithContact[]>(cacheKey)) ?? [];
          await storageSet(
            cacheKey,
            currentCache.map((t) =>
              t.id === transactionId ? serverTransaction : t,
            ),
            PIPELINE_TTL_MS,
          );

          queryClient.invalidateQueries({ queryKey: ['pipeline'] });
          return serverTransaction;
        } catch {
          // Failed to sync immediately, queue will handle it
        }
      }

      return updatedTransaction;
    },
    [cacheKey, isOnline, queryClient],
  );

  // ─── Update transaction (works offline) ────────────────────────
  const updateTransaction = useCallback(
    async (
      transactionId: string,
      data: Partial<Transaction>,
    ): Promise<TransactionWithContact> => {
      const now = new Date().toISOString();
      let updatedTransaction: TransactionWithContact | null = null;

      // Build the DB payload (snake_case)
      const dbPayload: Record<string, unknown> = {};
      if (data.currentStage) dbPayload.current_stage = data.currentStage;
      if (data.offerAmount !== undefined) dbPayload.offer_amount = data.offerAmount;
      if (data.offerConditions !== undefined) dbPayload.offer_conditions = data.offerConditions;
      if (data.offerStatus) dbPayload.offer_status = data.offerStatus;
      if (data.contractPrice !== undefined) dbPayload.contract_price = data.contractPrice;
      if (data.exchangeDate !== undefined) dbPayload.exchange_date = data.exchangeDate;
      if (data.settlementDate !== undefined) dbPayload.settlement_date = data.settlementDate;
      if (data.depositAmount !== undefined) dbPayload.deposit_amount = data.depositAmount;
      if (data.depositPaid !== undefined) dbPayload.deposit_paid = data.depositPaid;
      if (data.notes !== undefined) dbPayload.notes = data.notes;

      // Optimistic update
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id !== transactionId) return t;
          const updated: TransactionWithContact = {
            ...t,
            ...data,
            updatedAt: now,
          };
          updatedTransaction = updated;
          return updated;
        }),
      );

      if (!updatedTransaction) {
        throw new Error(
          `Transaction with id ${transactionId} not found in local state`,
        );
      }

      // Persist to cache
      const cached =
        (await storageGet<TransactionWithContact[]>(cacheKey)) ?? [];
      await storageSet(
        cacheKey,
        cached.map((t) =>
          t.id === transactionId ? updatedTransaction : t,
        ),
        PIPELINE_TTL_MS,
      );

      // Queue for sync
      await enqueue('update', 'transactions', dbPayload, transactionId);

      // If online, try to sync immediately
      if (isOnline) {
        try {
          const { data: serverData, error: updateError } = await supabase
            .from('transactions')
            .update(dbPayload)
            .eq('id', transactionId)
            .select('*, contact:contacts(id, first_name, last_name, buyer_profile)')
            .single();

          if (updateError) throw new Error(updateError.message);

          const serverTransaction = serverData as TransactionWithContact;

          setTransactions((prev) =>
            prev.map((t) =>
              t.id === transactionId ? serverTransaction : t,
            ),
          );

          const currentCache =
            (await storageGet<TransactionWithContact[]>(cacheKey)) ?? [];
          await storageSet(
            cacheKey,
            currentCache.map((t) =>
              t.id === transactionId ? serverTransaction : t,
            ),
            PIPELINE_TTL_MS,
          );

          queryClient.invalidateQueries({ queryKey: ['pipeline'] });
          return serverTransaction;
        } catch {
          // Failed to sync immediately, queue will handle it
        }
      }

      return updatedTransaction;
    },
    [cacheKey, isOnline, queryClient],
  );

  // ─── Refresh ───────────────────────────────────────────────────
  const refresh = useCallback(async (): Promise<void> => {
    if (isOnline) {
      await fetchFromServer();
    }
  }, [isOnline, fetchFromServer]);

  // ─── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    transactions,
    isLoading,
    isStale,
    error,
    lastSyncedAt,
    moveToStage,
    updateTransaction,
    refresh,
  };
}
