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
  useSocialLeads,
  useSocialLeadStats,
  useConvertSocialLead,
  useDismissSocialLead,
} from '../use-social-leads';

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

describe('useSocialLeads', () => {
  it('fetches social leads and returns data', async () => {
    const leads = [
      { id: '00000000-0000-0000-0000-000000000001', channel: 'facebook_dm', status: 'pending' },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: leads }),
    });

    const { result } = renderHook(() => useSocialLeads(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/social/leads'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
    expect(result.current.data).toEqual(leads);
  });

  it('applies status filter query param when provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const { result } = renderHook(() => useSocialLeads('converted'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('status=converted'),
      expect.any(Object),
    );
  });

  it('enters error state on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useSocialLeads(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useConvertSocialLead', () => {
  it('posts to convert endpoint and invalidates social-leads and contacts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { contactId: '00000000-0000-0000-0000-000000000002' } }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useConvertSocialLead(), { wrapper });
    result.current.mutate({ leadId: '00000000-0000-0000-0000-000000000001' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/social/leads/00000000-0000-0000-0000-000000000001/convert'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['social-leads'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts'] });
  });
});

describe('useDismissSocialLead', () => {
  it('calls DELETE and invalidates social-leads query', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDismissSocialLead(), { wrapper });
    result.current.mutate('00000000-0000-0000-0000-000000000001');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/social/leads/00000000-0000-0000-0000-000000000001'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['social-leads'] });
  });
});

describe('useSocialLeadStats', () => {
  it('fetches stats from the stats endpoint', async () => {
    const stats = {
      total: 17,
      pending: 5,
      converted: 10,
      dismissed: 2,
      conversionRate: 66.7,
      byChannel: {},
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: stats }),
    });

    const { result } = renderHook(() => useSocialLeadStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/social/leads/stats'),
      expect.any(Object),
    );
    expect(result.current.data).toEqual(stats);
  });
});
