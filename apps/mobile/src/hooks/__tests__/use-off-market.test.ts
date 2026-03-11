import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Mock Supabase ─────────────────────────────────────────────────

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
}));

// ─── Import after mocks ───────────────────────────────────────────

import {
  useOffMarketProperties,
  useOffMarketStats,
  useCreateOffMarketProperty,
  useDeleteOffMarketProperty,
} from '../use-off-market';

// ─── Helpers ──────────────────────────────────────────────────────

const mockFetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

// ─── Tests ────────────────────────────────────────────────────────

describe('useOffMarketProperties', () => {
  it('fetches off-market properties and returns data', async () => {
    const properties = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        addressLine1: '42 Test St',
        suburb: 'Paddington',
        status: 'active',
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: properties }),
    });

    const { result } = renderHook(() => useOffMarketProperties(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/off-market'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
    expect(result.current.data).toEqual(properties);
  });

  it('applies status filter query param when provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const { result } = renderHook(() => useOffMarketProperties('under_offer'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('status=under_offer'),
      expect.any(Object),
    );
  });
});

describe('useCreateOffMarketProperty', () => {
  it('posts to create endpoint and invalidates off-market queries', async () => {
    const created = {
      id: '00000000-0000-0000-0000-000000000002',
      addressLine1: '10 New St',
      suburb: 'Surry Hills',
      status: 'active',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: created }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useCreateOffMarketProperty(), { wrapper });

    result.current.mutate({
      addressLine1: '10 New St',
      suburb: 'Surry Hills',
      state: 'NSW',
      postcode: '2010',
      propertyType: 'house',
      source: 'vendor_direct',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/off-market'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['off-market'] });
    expect(result.current.data).toEqual(created);
  });
});

describe('useDeleteOffMarketProperty', () => {
  it('calls DELETE and invalidates off-market query', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteOffMarketProperty(), { wrapper });
    result.current.mutate('00000000-0000-0000-0000-000000000001');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/off-market/00000000-0000-0000-0000-000000000001'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['off-market'] });
  });
});

describe('useOffMarketStats', () => {
  it('fetches off-market stats from the stats endpoint', async () => {
    const stats = {
      totalOffMarket: 12,
      totalOnMarket: 48,
      offMarketClosed: 8,
      onMarketClosed: 30,
      offMarketSuccessRate: 66.7,
      onMarketSuccessRate: 62.5,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: stats }),
    });

    const { result } = renderHook(() => useOffMarketStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/off-market/stats'),
      expect.any(Object),
    );
    expect(result.current.data).toEqual(stats);
  });
});
