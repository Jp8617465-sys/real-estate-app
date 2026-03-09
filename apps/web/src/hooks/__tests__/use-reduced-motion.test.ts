import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../use-reduced-motion';

type MockMQ = {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

let mockMQ: MockMQ;
let changeHandler: ((e: { matches: boolean }) => void) | null = null;

beforeEach(() => {
  changeHandler = null;
  mockMQ = {
    matches: false,
    addEventListener: vi.fn((_, handler) => { changeHandler = handler; }),
    removeEventListener: vi.fn(),
  };
  vi.spyOn(window, 'matchMedia').mockReturnValue(mockMQ as unknown as MediaQueryList);
});

describe('useReducedMotion', () => {
  it('returns false when media query does not match', () => {
    mockMQ.matches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when media query matches on mount', () => {
    mockMQ.matches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when system preference changes', () => {
    mockMQ.matches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      changeHandler?.({ matches: true });
    });

    expect(result.current).toBe(true);
  });

  it('removes the event listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(mockMQ.removeEventListener).toHaveBeenCalled();
  });
});
