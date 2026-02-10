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
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(finalResult));
  return chain;
}

const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import { useClientBrief, useClientBriefs } from '../use-client-briefs';

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

describe('useClientBrief', () => {
  it('fetches a client brief by client id', async () => {
    const brief = { id: '1', contact_id: 'client-1', purchase_type: 'owner_occupier' };
    const chain = createChainedQuery({ data: brief, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useClientBrief('client-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('client_briefs');
    expect(chain.eq).toHaveBeenCalledWith('contact_id', 'client-1');
    expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(chain.single).toHaveBeenCalled();
    expect(result.current.data).toEqual(brief);
  });

  it('does not fetch when client id is empty', () => {
    const chain = createChainedQuery({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useClientBrief(''),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useClientBriefs', () => {
  it('fetches all client briefs with contact relation', async () => {
    const briefs = [
      { id: '1', contact: { id: 'c1', first_name: 'Jane', last_name: 'Doe' } },
    ];
    const chain = createChainedQuery({ data: briefs, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useClientBriefs(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('client_briefs');
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(result.current.data).toEqual(briefs);
  });
});
