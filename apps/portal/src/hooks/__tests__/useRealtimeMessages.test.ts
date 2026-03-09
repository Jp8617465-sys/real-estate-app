import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ─── Mock dependencies ─────────────────────────────────────────────

const { mockChannel, mockRemoveChannel, mockCreateClient, mockSubscribeCb } =
  vi.hoisted(() => {
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

import { useRealtimeMessages } from '../useRealtimeMessages';

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

// ─── useRealtimeMessages ──────────────────────────────────────────

describe('useRealtimeMessages', () => {
  it('starts as connecting then transitions to connected on SUBSCRIBED', async () => {
    const { result } = renderHook(() => useRealtimeMessages(), {
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

  it('sets status to disconnected on TIMED_OUT', async () => {
    const { result } = renderHook(() => useRealtimeMessages(), {
      wrapper: createWrapper(),
    });

    act(() => {
      mockSubscribeCb('TIMED_OUT');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });
  });

  it('sets status to disconnected on CLOSED', async () => {
    const { result } = renderHook(() => useRealtimeMessages(), {
      wrapper: createWrapper(),
    });

    act(() => {
      mockSubscribeCb('CLOSED');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });
  });

  it('invalidates portal-messages on INSERT payload', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useRealtimeMessages(), { wrapper });

    const onCall = mockChannel.on.mock.calls[0];
    const payloadHandler = onCall[2] as (payload: unknown) => void;

    act(() => {
      payloadHandler({
        eventType: 'INSERT',
        new: { id: 'msg-1', contact_id: 'contact-1' },
        old: {},
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portal-messages', 'contact-1'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['portal-dashboard'] }),
    );
  });

  it('removes the channel on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeMessages(), {
      wrapper: createWrapper(),
    });

    act(() => {
      mockSubscribeCb('SUBSCRIBED');
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
