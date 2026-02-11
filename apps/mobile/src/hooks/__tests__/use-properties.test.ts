import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Mock Supabase ─────────────────────────────────────────────────

function createChainedQuery(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
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

import { useProperties, useProperty } from '../use-properties';

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

describe('useProperties', () => {
  it('fetches all properties', async () => {
    const properties = [{ id: '1', address: {}, listing_status: 'active' }];
    const chain = createChainedQuery({ data: properties, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useProperties(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('properties');
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(result.current.data).toEqual(properties);
  });

  it('filters by listing status when provided', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useProperties('active'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('listing_status', 'active');
  });
});

describe('useProperty', () => {
  it('fetches a single property by id', async () => {
    const property = { id: '1', address: {}, listing_status: 'active' };
    const chain = createChainedQuery({ data: property, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useProperty('1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(chain.single).toHaveBeenCalled();
    expect(result.current.data).toEqual(property);
  });

  it('does not fetch when id is empty', () => {
    const chain = createChainedQuery({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useProperty(''), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
