import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Mock Supabase ─────────────────────────────────────────────────

function createChainedQuery(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(finalResult));
  return chain;
}

const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import { usePipeline, useUpdateTransactionStage } from '../use-pipeline';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePipeline', () => {
  it('fetches transactions for buying pipeline', async () => {
    const transactions = [
      { id: '1', pipeline_type: 'buying', current_stage: 'enquiry' },
    ];
    const chain = createChainedQuery({ data: transactions, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => usePipeline('buying'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('transactions');
    expect(chain.eq).toHaveBeenCalledWith('pipeline_type', 'buying');
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(result.current.data).toEqual(transactions);
  });

  it('fetches transactions for selling pipeline', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => usePipeline('selling'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('pipeline_type', 'selling');
  });
});

describe('useUpdateTransactionStage', () => {
  it('updates transaction stage and invalidates pipeline queries', async () => {
    const updated = { id: '1', current_stage: 'under-contract' };
    const chain = createChainedQuery({ data: updated, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => useUpdateTransactionStage('1'),
      { wrapper },
    );

    result.current.mutate({ stage: 'under-contract' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.update).toHaveBeenCalledWith({ current_stage: 'under-contract' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['pipeline'] });
  });
});
