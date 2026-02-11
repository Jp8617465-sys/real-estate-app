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

// Mock useAuth and usePortalClient
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

import { useBrief } from '../use-brief';

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

// ─── useBrief ─────────────────────────────────────────────────────

describe('useBrief', () => {
  it('fetches client brief data', async () => {
    const briefData = {
      id: 'brief-1',
      contact_id: 'contact-1',
      purchase_type: 'owner_occupier',
      budget: { min: 950000, max: 1200000 },
      brief_version: 3,
      client_signed_off: true,
      updated_at: '2026-01-28T10:00:00Z',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: briefData, error: null }),
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useBrief(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.purchase_type).toBe('owner_occupier');
    expect(result.current.data?.brief_version).toBe(3);
  });

  it('handles error when brief not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useBrief(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });
});
