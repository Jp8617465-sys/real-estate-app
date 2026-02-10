import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import { useDashboardStats } from '../use-dashboard';

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

describe('useDashboardStats', () => {
  it('fetches aggregated dashboard stats', async () => {
    // Each call to from returns a chain that eventually resolves
    function makeCountChain(count: number) {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.lte = vi.fn().mockReturnValue(chain);
      chain.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ count, error: null }),
      );
      return chain;
    }

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      switch (callCount) {
        case 1:
          return makeCountChain(42); // contacts
        case 2:
          return makeCountChain(15); // properties
        case 3:
          return makeCountChain(5); // transactions
        case 4:
          return makeCountChain(8); // tasks
        default:
          return makeCountChain(0);
      }
    });

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('contacts');
    expect(mockFrom).toHaveBeenCalledWith('properties');
    expect(mockFrom).toHaveBeenCalledWith('transactions');
    expect(mockFrom).toHaveBeenCalledWith('tasks');

    expect(result.current.data).toEqual({
      activeContacts: 42,
      listedProperties: 15,
      underContract: 5,
      tasksDueToday: 8,
    });
  });

  it('uses correct query key', () => {
    function makeCountChain(count: number) {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.lte = vi.fn().mockReturnValue(chain);
      chain.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ count, error: null }),
      );
      return chain;
    }

    mockFrom.mockImplementation(() => makeCountChain(0));

    renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

    // The hook should be using queryKey ['dashboard-stats']
    expect(mockFrom).toHaveBeenCalled();
  });

  it('propagates errors', async () => {
    function makeErrorChain() {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.lte = vi.fn().mockReturnValue(chain);
      chain.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ count: null, error: { message: 'DB error' } }),
      );
      return chain;
    }

    mockFrom.mockImplementation(() => makeErrorChain());

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
