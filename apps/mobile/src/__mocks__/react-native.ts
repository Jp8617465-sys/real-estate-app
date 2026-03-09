/**
 * Minimal react-native stub for the Vitest / jsdom test environment.
 * Real RN modules are Rollup-incompatible (Flow types), so we stub the
 * subset needed by the unit-tested hooks.
 */
export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  addEventListener: () => ({ remove: () => {} }),
};

export const Platform = { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios };
export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
