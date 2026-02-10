import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Mock Supabase ─────────────────────────────────────────────────

function createChainedQuery(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
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

import { useInspection, useInspections, useCreateInspection } from '../use-inspections';

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

describe('useInspections', () => {
  it('fetches all inspections', async () => {
    const inspections = [{ id: '1', overall_impression: 'positive' }];
    const chain = createChainedQuery({ data: inspections, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useInspections(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('inspections');
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(result.current.data).toEqual(inspections);
  });

  it('filters by property id when provided', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useInspections('prop-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('property_id', 'prop-1');
  });
});

describe('useInspection', () => {
  it('fetches a single inspection', async () => {
    const inspection = { id: '1', overall_impression: 'positive' };
    const chain = createChainedQuery({ data: inspection, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useInspection('1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(chain.single).toHaveBeenCalled();
  });

  it('does not fetch when id is empty', () => {
    const chain = createChainedQuery({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useInspection(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateInspection', () => {
  it('creates an inspection and invalidates queries', async () => {
    const newInspection = { id: 'new-1', overall_impression: 'positive' };
    const chain = createChainedQuery({ data: newInspection, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useCreateInspection(), { wrapper });

    result.current.mutate({
      propertyId: 'prop-1',
      inspectionDate: '2026-02-10T10:00:00Z',
      overallImpression: 'positive',
      photos: [],
      createdBy: 'agent-1',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.insert).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inspections'] });
  });
});
