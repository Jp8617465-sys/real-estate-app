'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export function RestrictedBanner() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('restricted') === 'true') {
      setVisible(true);
      // Clean up the URL param without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete('restricted');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  if (!visible) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-amber-600 dark:text-amber-400">&#9888;</span>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            You don&apos;t have access to that feature. Contact your admin to
            update your product access.
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="ml-4 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          aria-label="Dismiss"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
