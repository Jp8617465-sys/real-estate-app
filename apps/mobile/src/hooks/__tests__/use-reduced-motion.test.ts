import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mock react-native AccessibilityInfo ────────────────────────────────────

const { mockIsReduceMotionEnabled, mockAddEventListener } = vi.hoisted(() => ({
  mockIsReduceMotionEnabled: vi.fn(),
  mockAddEventListener: vi.fn(),
}));

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: mockIsReduceMotionEnabled,
    addEventListener: mockAddEventListener,
  },
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { useReducedMotion } from '../use-reduced-motion';

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAddEventListener.mockReturnValue({ remove: vi.fn() });
});

describe('useReducedMotion (mobile)', () => {
  it('returns false by default before the async check resolves', () => {
    mockIsReduceMotionEnabled.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when OS has reduce motion enabled', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(true);
    const { result } = renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it('returns false when OS has reduce motion disabled', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    const { result } = renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('subscribes to reduceMotionChanged events', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(mockAddEventListener).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
  });

  it('removes subscription on unmount', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    const removeMock = vi.fn();
    mockAddEventListener.mockReturnValue({ remove: removeMock });

    const { unmount } = renderHook(() => useReducedMotion());
    await act(async () => {});
    unmount();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('updates when OS setting changes via event', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    let changeHandler: (value: boolean) => void = () => {};
    mockAddEventListener.mockImplementation((_event: string, handler: (v: boolean) => void) => {
      changeHandler = handler;
      return { remove: vi.fn() };
    });

    const { result } = renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(false);

    act(() => { changeHandler(true); });
    expect(result.current).toBe(true);
  });
});
