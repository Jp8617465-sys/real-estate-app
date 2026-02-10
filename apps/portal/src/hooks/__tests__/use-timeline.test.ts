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

import { useTimeline } from '../use-timeline';

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

// ─── useTimeline ──────────────────────────────────────────────────

describe('useTimeline', () => {
  it('fetches and computes status for key dates', async () => {
    const transaction = { id: 'tx-1' };
    const keyDates = [
      {
        id: 'kd-1',
        label: 'Contract exchange',
        date: '2025-12-01T10:00:00Z',
        is_critical: true,
        status: 'completed',
        notes: 'Done.',
      },
      {
        id: 'kd-2',
        label: 'Settlement',
        date: '2027-04-07T14:00:00Z',
        is_critical: true,
        status: 'upcoming',
        notes: 'Target date.',
      },
    ];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // transactions query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      // key_dates query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: keyDates, error: null }),
          }),
        }),
      };
    });

    const { result } = renderHook(() => useTimeline(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(2);
    // Completed stays completed
    expect(result.current.data?.[0].status).toBe('completed');
    // Future date should be 'upcoming'
    expect(result.current.data?.[1].status).toBe('upcoming');
  });

  it('returns empty array when no transaction found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useTimeline(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toEqual([]);
  });
});
