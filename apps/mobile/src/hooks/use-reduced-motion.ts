import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * React Native hook — reads the OS-level "Reduce Motion" accessibility setting.
 * Returns true when the user has requested reduced motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );

    return () => subscription.remove();
  }, []);

  return reduced;
}
