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

import { usePortalDueDiligence } from '../use-due-diligence';

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

// ─── usePortalDueDiligence ────────────────────────────────────────

describe('usePortalDueDiligence', () => {
  it('fetches due diligence items and computes completion', async () => {
    const transaction = { id: 'tx-1' };
    const checklist = { id: 'cl-1', completion_percentage: 72 };
    const items = [
      { id: '1', name: 'Title search', category: 'legal', status: 'completed', assigned_to: 'solicitor', is_blocking: false, notes: null },
      { id: '2', name: 'Contract review', category: 'legal', status: 'in_progress', assigned_to: 'solicitor', is_blocking: true, notes: 'Awaiting response' },
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
      if (callCount === 2) {
        // checklists query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: checklist, error: null }),
              }),
            }),
          }),
        };
      }
      // items query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: items, error: null }),
          }),
        }),
      };
    });

    const { result } = renderHook(() => usePortalDueDiligence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.completion).toBe(72);
    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[1].is_blocking).toBe(true);
  });

  it('returns empty data when no transaction found', async () => {
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

    const { result } = renderHook(() => usePortalDueDiligence(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.completion).toBe(0);
    expect(result.current.data?.items).toEqual([]);
  });
});
