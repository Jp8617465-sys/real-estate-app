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

import {
  usePropertyMatches,
  usePropertyMatch,
  useUpdatePropertyMatchStatus,
} from '../use-property-matches';

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

describe('usePropertyMatches', () => {
  it('fetches all property matches', async () => {
    const matches = [{ id: '1', overall_score: 85, status: 'new' }];
    const chain = createChainedQuery({ data: matches, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => usePropertyMatches(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('property_matches');
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(chain.order).toHaveBeenCalledWith('overall_score', { ascending: false });
    expect(result.current.data).toEqual(matches);
  });

  it('filters by brief id when provided', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => usePropertyMatches('brief-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('client_brief_id', 'brief-1');
  });
});

describe('usePropertyMatch', () => {
  it('fetches a single match with relations', async () => {
    const match = { id: '1', overall_score: 85, property: {}, client_brief: {} };
    const chain = createChainedQuery({ data: match, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => usePropertyMatch('1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(chain.single).toHaveBeenCalled();
    expect(result.current.data).toEqual(match);
  });

  it('does not fetch when id is empty', () => {
    const chain = createChainedQuery({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => usePropertyMatch(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useUpdatePropertyMatchStatus', () => {
  it('updates match status and invalidates queries', async () => {
    const updated = { id: '1', status: 'client_interested' };
    const chain = createChainedQuery({ data: updated, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => useUpdatePropertyMatchStatus('1'),
      { wrapper },
    );

    result.current.mutate({ status: 'client_interested' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'client_interested' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['property-matches'] });
  });

  it('includes rejection reason when rejecting', async () => {
    const updated = { id: '1', status: 'rejected' };
    const chain = createChainedQuery({ data: updated, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => useUpdatePropertyMatchStatus('1'),
      { wrapper },
    );

    result.current.mutate({
      status: 'rejected',
      rejectionReason: 'Too expensive',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        rejection_reason: 'Too expensive',
      }),
    );
  });
});
