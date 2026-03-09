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

// useAuth provides user; usePortalClient provides contact_id
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

import { useRealtimeDocuments } from '../useRealtimeDocuments';

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

  // Re-wire subscribe so mockSubscribeCb tracks the callback each time
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

// ─── useRealtimeDocuments ─────────────────────────────────────────

describe('useRealtimeDocuments', () => {
  it('starts as connecting then moves to connected when SUBSCRIBED fires', async () => {
    const { result } = renderHook(() => useRealtimeDocuments(), {
      wrapper: createWrapper(),
    });

    // Initial state before subscription callback fires
    expect(result.current.status).toBe('connecting');

    // Simulate Supabase firing SUBSCRIBED
    act(() => {
      mockSubscribeCb('SUBSCRIBED');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });
  });

  it('sets status to disconnected on CHANNEL_ERROR', async () => {
    const { result } = renderHook(() => useRealtimeDocuments(), {
      wrapper: createWrapper(),
    });

    act(() => {
      mockSubscribeCb('CHANNEL_ERROR');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });

  });

  it('calls onNewDocument callback when an INSERT payload arrives', async () => {
    const onNewDocument = vi.fn();

    renderHook(() => useRealtimeDocuments({ onNewDocument }), {
      wrapper: createWrapper(),
    });

    // Grab the payload handler registered via channel.on()
    const onCall = mockChannel.on.mock.calls[0];
    // The third argument to .on() is the payload handler
    const payloadHandler = onCall[2] as (payload: unknown) => void;

    act(() => {
      payloadHandler({
        eventType: 'INSERT',
        new: {
          id: 'doc-abc',
          name: 'Contract.pdf',
          category: 'contracts',
        },
        old: {},
      });
    });

    expect(onNewDocument).toHaveBeenCalledWith({
      documentId: 'doc-abc',
      name: 'Contract.pdf',
      category: 'contracts',
    });
  });

  it('removes the channel on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeDocuments(), {
      wrapper: createWrapper(),
    });

    act(() => {
      mockSubscribeCb('SUBSCRIBED');
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
