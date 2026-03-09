import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ─── Mock dependencies ─────────────────────────────────────────────

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
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
    },
    isLoading: false,
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────

import { usePortalProperties } from '../use-portal-properties';

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

// ─── usePortalProperties ──────────────────────────────────────────

describe('usePortalProperties', () => {
  it('fetches property matches for the portal client', async () => {
    const matchData = [
      {
        id: 'match-1',
        overall_score: 92,
        status: 'shortlisted',
        agent_notes: 'Great location',
        property: {
          id: 'prop-1',
          address: {
            street: '12 Harbour Rd',
            suburb: 'Mosman',
            state: 'NSW',
            postcode: '2088',
          },
          property_type: 'house',
          bedrooms: 4,
          bathrooms: 2,
          car_spaces: 2,
          price_guide: '$2.2m - $2.4m',
        },
      },
      {
        id: 'match-2',
        overall_score: 78,
        status: 'under_review',
        agent_notes: null,
        property: {
          id: 'prop-2',
          address: {
            street: '5 Beach Ave',
            suburb: 'Manly',
            state: 'NSW',
            postcode: '2095',
          },
          property_type: 'apartment',
          bedrooms: 3,
          bathrooms: 2,
          car_spaces: 1,
          price_guide: null,
        },
      },
    ];

    // property_matches — .select().eq().order()
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: matchData, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => usePortalProperties(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].overall_score).toBe(92);
    expect(result.current.data![0].property.address.suburb).toBe('Mosman');
    expect(result.current.data![1].agent_notes).toBeNull();
  });

  it('propagates errors from supabase', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Permission denied' },
          }),
        }),
      }),
    });

    const { result } = renderHook(() => usePortalProperties(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('returns an empty array when no matches exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => usePortalProperties(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(0);
  });
});
