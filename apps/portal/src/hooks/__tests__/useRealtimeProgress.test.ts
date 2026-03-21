import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ─── Mock dependencies ─────────────────────────────────────────────

const { mockChannel, mockRemoveChannel, mockCreateClient, mockSubscribeCb } = vi.hoisted(() => {
  const mockSubscribeCb = vi.fn();

  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((cb: (status: string) => void) => {
      mockSubscribeCb.mockImplementation(cb);
      return mockChannel;
    }),
  };

  const mockRemoveChannel = vi.fn();

  const mockCreateClient = vi.fn(() => ({
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  }));

  return { mockChannel, mockRemoveChannel, mockCreateClient, mockSubscribeCb };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: mockCreateClient,
}));

vi.mock('../use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'sarah@test.com' },
    isLoading: false,
  }),
  usePortalClient: () => ({
    data: {
      id: 'pc-1',
      contact_id: 'contact-1',
      agent_id: 'agent-1',
    },
    isLoading: false,
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import { useRealtimeProgress } from '../useRealtimeProgress';

// ─── Test wrapper ─────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockChannel.on.mockReturnThis();
  mockChannel.subscribe.mockImplementation((cb: (status: string) => void) => {
    mockSubscribeCb.mockImplementation(cb);
    return mockChannel;
  });
  mockCreateClient.mockReturnValue({
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── useRealtimeProgress ──────────────────────────────────────────

describe('useRealtimeProgress', () => {
  it('starts as connecting then becomes connected on SUBSCRIBED', async () => {
    const { result } = renderHook(() => useRealtimeProgress(), {
      wrapper: createWrapper(),
    });

    expect(result.current.status).toBe('connecting');

    act(() => {
      mockSubscribeCb('SUBSCRIBED');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });
  });

  it('sets status to disconnected on CHANNEL_ERROR', async () => {
    const { result } = renderHook(() => useRealtimeProgress(), {
      wrapper: createWrapper(),
    });

    act(() => {
      mockSubscribeCb('CHANNEL_ERROR');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });
  });

  it('calls onStageChange when transaction current_stage changes', async () => {
    const onStageChange = vi.fn();

    renderHook(() => useRealtimeProgress({ onStageChange }), {
      wrapper: createWrapper(),
    });

    // The hook registers via channel.on() — grab the payload handler (3rd arg)
    const onCall = mockChannel.on.mock.calls[0];
    const payloadHandler = onCall[2] as (payload: unknown) => void;

    act(() => {
      payloadHandler({
        eventType: 'UPDATE',
        new: { id: 'tx-1', current_stage: 'due_diligence' },
        old: { id: 'tx-1', current_stage: 'shortlisting' },
      });
    });

    expect(onStageChange).toHaveBeenCalledWith({
      transactionId: 'tx-1',
      fromStage: 'shortlisting',
      toStage: 'due_diligence',
    });
  });

  it('does not call onStageChange when stage has not changed', async () => {
    const onStageChange = vi.fn();

    renderHook(() => useRealtimeProgress({ onStageChange }), {
      wrapper: createWrapper(),
    });

    const onCall = mockChannel.on.mock.calls[0];
    const payloadHandler = onCall[2] as (payload: unknown) => void;

    act(() => {
      payloadHandler({
        eventType: 'UPDATE',
        new: { id: 'tx-1', current_stage: 'shortlisting', some_other_field: 'new' },
        old: { id: 'tx-1', current_stage: 'shortlisting', some_other_field: 'old' },
      });
    });

    expect(onStageChange).not.toHaveBeenCalled();
  });

  it('invalidates portal-dashboard and portal-timeline on any UPDATE', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useRealtimeProgress(), { wrapper });

    const onCall = mockChannel.on.mock.calls[0];
    const payloadHandler = onCall[2] as (payload: unknown) => void;

    act(() => {
      payloadHandler({
        eventType: 'UPDATE',
        new: { id: 'tx-1', current_stage: 'due_diligence' },
        old: { id: 'tx-1', current_stage: 'shortlisting' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portal-dashboard'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portal-timeline', 'contact-1'] }),
    );
  });

  it('removes the channel on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeProgress(), {
      wrapper: createWrapper(),
    });

    act(() => {
      mockSubscribeCb('SUBSCRIBED');
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
