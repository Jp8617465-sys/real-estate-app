'use client';

import { useState, useEffect } from 'react';

/**
 * Browser hook — reads the OS-level "prefers-reduced-motion" media query.
 * Returns true when the user has requested reduced motion.
 * Safe for SSR: returns false on the server.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
