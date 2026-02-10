import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ─── Mock dependencies ─────────────────────────────────────────────

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock('../use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'sarah@test.com' },
    isLoading: false,
    signOut: vi.fn(),
  }),
  usePortalClient: () => ({
    data: {
      id: 'pc-1',
      contact_id: 'contact-1',
      agent_id: 'agent-1',
      contact: { id: 'contact-1', first_name: 'Sarah', last_name: 'Johnson' },
      agent: { id: 'agent-1', full_name: 'Alex Morgan' },
    },
    isLoading: false,
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import { usePortalMessages, useSendMessage } from '../use-portal-messages';

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
});

// ─── usePortalMessages ────────────────────────────────────────────

describe('usePortalMessages', () => {
  it('fetches messages for the portal client', async () => {
    const messages = [
      {
        id: 'msg-1',
        direction: 'inbound',
        content: { text: 'Hi Sarah!' },
        created_at: '2026-02-05T10:30:00Z',
        is_read: true,
      },
      {
        id: 'msg-2',
        direction: 'outbound',
        content: { text: 'Hello!' },
        created_at: '2026-02-05T10:45:00Z',
        is_read: true,
      },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: messages, error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => usePortalMessages(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].content.text).toBe('Hi Sarah!');
  });
});

// ─── useSendMessage ───────────────────────────────────────────────

describe('useSendMessage', () => {
  it('sends a message', async () => {
    const newMessage = {
      id: 'msg-new',
      channel: 'portal_notification',
      direction: 'outbound',
      contact_id: 'contact-1',
      agent_id: 'agent-1',
      content: { text: 'Hello agent!' },
    };

    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: newMessage, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ text: 'Hello agent!' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.content.text).toBe('Hello agent!');
  });
});
