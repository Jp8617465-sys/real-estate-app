import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Mock Supabase ─────────────────────────────────────────────────

function createChainedQuery(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
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

import { useOffer, useOffers, useCreateOffer, useAddOfferRound, useUpdateAuctionResult } from '../use-offers';

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

describe('useOffer', () => {
  it('fetches a single offer with rounds and auction event', async () => {
    const offer = { id: '1', status: 'active', rounds: [], auction_event: null };
    const chain = createChainedQuery({ data: offer, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useOffer('1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('offers');
    expect(chain.select).toHaveBeenCalledWith('*, rounds:offer_rounds(*), auction_event:auction_events(*)');
    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(result.current.data).toEqual(offer);
  });

  it('does not fetch when id is empty', () => {
    const chain = createChainedQuery({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useOffer(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useOffers', () => {
  it('fetches all offers', async () => {
    const offers = [{ id: '1', status: 'active' }];
    const chain = createChainedQuery({ data: offers, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useOffers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('offers');
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false);
  });

  it('filters by client id when provided', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useOffers('client-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('client_id', 'client-1');
  });
});

describe('useAddOfferRound', () => {
  it('adds an offer round and invalidates the offer query', async () => {
    const newRound = { id: 'round-1', amount: 1050000 };
    const chain = createChainedQuery({ data: newRound, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useAddOfferRound('offer-1'), { wrapper });

    result.current.mutate({
      offerId: 'offer-1',
      amount: 1050000,
      conditions: [],
      response: 'pending',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('offer_rounds');
    expect(chain.insert).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['offers', 'offer-1'] });
  });
});

describe('useUpdateAuctionResult', () => {
  it('updates auction result and invalidates offer query', async () => {
    const updated = { id: 'event-1', result: 'won' };
    const chain = createChainedQuery({ data: updated, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateAuctionResult('offer-1'), { wrapper });

    result.current.mutate({
      result: 'won',
      finalPrice: 1200000,
      numberOfBidders: 5,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('auction_events');
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'won',
        final_price: 1200000,
        number_of_bidders: 5,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['offers', 'offer-1'] });
  });
});
