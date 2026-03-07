'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

/**
 * Next.js global error page.
 * Rendered when an unhandled error occurs in any route segment.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log error to console and external error tracking
    console.error('[GlobalError] Unhandled error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-red-500"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Something went wrong
        </h1>

        <p className="mb-8 text-gray-600">
          We encountered an unexpected error. Our team has been notified
          and is looking into it.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-left">
            <p className="text-sm font-medium text-red-800">
              {error.message}
            </p>
            {error.digest && (
              <p className="mt-1 text-xs text-red-600">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try again
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
