'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RealFlow] Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mb-6 text-sm text-gray-500">
          An error occurred while loading this page. Please try again.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
            <summary className="cursor-pointer text-sm font-medium text-red-800">
              Error details
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-red-700">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
            {error.digest && (
              <p className="mt-2 text-xs text-red-600">Digest: {error.digest}</p>
            )}
          </details>
        )}
        {error.digest && process.env.NODE_ENV !== 'development' && (
          <p className="mb-4 text-xs text-gray-400">Error ID: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
