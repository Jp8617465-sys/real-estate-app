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
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(finalResult));
  return chain;
}

const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import { useTasks, useTask, useCreateTask, useCompleteTask, useUpdateTask } from '../use-tasks';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTasks', () => {
  it('fetches all tasks', async () => {
    const tasks = [
      { id: '1', title: 'Call John', status: 'pending', priority: 'high' },
    ];
    const chain = createChainedQuery({ data: tasks, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useTasks(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('tasks');
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(chain.order).toHaveBeenCalledWith('due_date', { ascending: true });
    expect(result.current.data).toEqual(tasks);
  });

  it('applies status filter', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useTasks({ status: 'pending' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('applies priority filter', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useTasks({ priority: 'urgent' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('priority', 'urgent');
  });

  it('applies due date filter', async () => {
    const chain = createChainedQuery({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useTasks({ dueDate: '2026-02-10' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.lte).toHaveBeenCalledWith('due_date', '2026-02-10');
  });
});

describe('useTask', () => {
  it('fetches a single task', async () => {
    const task = { id: '1', title: 'Call John' };
    const chain = createChainedQuery({ data: task, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useTask('1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(chain.single).toHaveBeenCalled();
  });

  it('does not fetch when id is empty', () => {
    const chain = createChainedQuery({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useTask(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCompleteTask', () => {
  it('marks task as completed and invalidates queries', async () => {
    const chain = createChainedQuery({ data: { id: '1', status: 'completed' }, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useCompleteTask('1'), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] });
  });
});

describe('useCreateTask', () => {
  it('creates a task and invalidates queries', async () => {
    const newTask = { id: 'new-1', title: 'New Task' };
    const chain = createChainedQuery({ data: newTask, error: null });
    mockFrom.mockReturnValue(chain);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useCreateTask(), { wrapper });

    result.current.mutate({
      title: 'New Task',
      type: 'follow_up',
      priority: 'medium',
      status: 'pending',
      dueDate: '2026-02-15',
      createdBy: 'agent-1',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(chain.insert).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] });
  });
});
