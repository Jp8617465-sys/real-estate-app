import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
    from: mockFrom,
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import { useAuth, usePortalClient } from '../use-auth';

// ─── Test wrapper ─────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── useAuth ──────────────────────────────────────────────────────

describe('useAuth', () => {
  it('returns user when authenticated', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'sarah@test.com',
      user_metadata: { full_name: 'Sarah Johnson' },
    };

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.signOut).toBeInstanceOf(Function);
  });

  it('returns null user when not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });
});

// ─── usePortalClient ──────────────────────────────────────────────

describe('usePortalClient', () => {
  it('fetches portal client when user is authenticated', async () => {
    const mockUser = { id: 'user-1', email: 'sarah@test.com' };
    const portalClient = {
      id: 'pc-1',
      auth_id: 'user-1',
      contact_id: 'contact-1',
      agent_id: 'agent-1',
      is_active: true,
      contact: {
        id: 'contact-1',
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah@test.com',
        phone: '0400000000',
      },
      agent: {
        id: 'agent-1',
        full_name: 'Alex Morgan',
        email: 'alex@test.com',
      },
    };

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: portalClient, error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => usePortalClient(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.contact.first_name).toBe('Sarah');
    expect(result.current.data?.agent.full_name).toBe('Alex Morgan');
  });
});
