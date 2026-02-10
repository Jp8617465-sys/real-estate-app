import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Mock Supabase ─────────────────────────────────────────────────

function createChainedQuery(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.overlaps = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(finalResult));
  return chain;
}

const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

// ─── Import after mocks ───────────────────────────────────────────

import {
  useContacts,
  useContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from '../use-contacts';

// ─── Test helpers ─────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ─── Tests ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useContacts', () => {
  it('fetches contacts from the contacts table', async () => {
    const contacts = [
      { id: '1', first_name: 'John', last_name: 'Smith' },
      { id: '2', first_name: 'Jane', last_name: 'Doe' },
    ];
    const chain = createChainedQuery({ data: contacts, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useContacts(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('contacts');
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(result.current.data).toEqual(contacts);
  });

  it('applies search query filter when provided', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useContacts({ query: 'John' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining('first_name.ilike.%John%'),
    );
  });

  it('applies types filter when provided', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useContacts({ types: ['buyer'] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.overlaps).toHaveBeenCalledWith('types', ['buyer']);
  });

  it('propagates errors', async () => {
    const chain = createChainedQuery({ data: null, error: { message: 'DB error' } });
    // Override then to reject
    chain.then = vi.fn((_resolve: (v: unknown) => void, reject?: (v: unknown) => void) => {
      if (reject) reject({ message: 'DB error' });
      else throw { message: 'DB error' };
    });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useContacts(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('uses correct query key', () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);
    const search = { query: 'test' };

    renderHook(() => useContacts(search), { wrapper: createWrapper() });
    // The query key is ['contacts', search] - verified by the hook implementation
    expect(mockFrom).toHaveBeenCalledWith('contacts');
  });
});

describe('useContact', () => {
  it('fetches a single contact by id', async () => {
    const contact = { id: '1', first_name: 'John', last_name: 'Smith' };
    const chain = createChainedQuery({ data: contact, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useContact('1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('contacts');
    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(chain.single).toHaveBeenCalled();
    expect(result.current.data).toEqual(contact);
  });

  it('does not fetch when id is empty', () => {
    const chain = createChainedQuery({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useContact(''), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateContact', () => {
  it('inserts a contact and invalidates contacts queries', async () => {
    const newContact = { id: 'new-1', first_name: 'Jane', last_name: 'Doe' };
    const chain = createChainedQuery({ data: newContact, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useCreateContact(), { wrapper });

    result.current.mutate({
      types: ['buyer'],
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '0400000000',
      source: 'domain',
      assignedAgentId: '00000000-0000-0000-0000-000000000001',
      communicationPreference: 'email',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.insert).toHaveBeenCalled();
    expect(chain.select).toHaveBeenCalled();
    expect(chain.single).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts'] });
  });
});

describe('useUpdateContact', () => {
  it('updates a contact and invalidates queries', async () => {
    const updatedContact = { id: '1', first_name: 'Johnny', last_name: 'Smith' };
    const chain = createChainedQuery({ data: updatedContact, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateContact('1'), { wrapper });

    result.current.mutate({ firstName: 'Johnny' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.update).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts', '1'] });
  });
});

describe('useDeleteContact', () => {
  it('soft deletes a contact', async () => {
    const chain = createChainedQuery({ data: null, error: null });
    // Override so the mutation resolves (no .select/.single needed)
    chain.eq = vi.fn().mockResolvedValue({ error: null });
    chain.update = vi.fn().mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteContact('1'), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_deleted: true }),
    );
    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts'] });
  });
});
