import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ─── Mock dependencies ─────────────────────────────────────────────

const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: mockStorageFrom },
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

import { useDocuments, useDownloadDocument } from '../use-documents';

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

// ─── useDocuments ─────────────────────────────────────────────────

describe('useDocuments', () => {
  it('fetches documents for the portal client', async () => {
    const documents = [
      {
        id: 'doc-1',
        name: 'Contract.pdf',
        file_path: 'documents/contact-1/Contract.pdf',
        mime_type: 'application/pdf',
        size_bytes: 2400000,
        category: 'contracts',
        uploaded_by: 'agent-1',
        created_at: '2026-02-05T14:30:00Z',
      },
      {
        id: 'doc-2',
        name: 'Report.pdf',
        file_path: 'documents/contact-1/Report.pdf',
        mime_type: 'application/pdf',
        size_bytes: 8100000,
        category: 'inspections',
        uploaded_by: 'agent-1',
        created_at: '2026-02-10T16:00:00Z',
      },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: documents, error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useDocuments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe('Contract.pdf');
  });
});

// ─── useDownloadDocument ──────────────────────────────────────────

describe('useDownloadDocument', () => {
  it('generates a signed download URL', async () => {
    mockStorageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-download' },
        error: null,
      }),
    });

    const { result } = renderHook(() => useDownloadDocument(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('documents/contact-1/Contract.pdf');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe('https://example.com/signed-download');
  });
});
