'use client';

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// ─── Types ──────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
  readonly onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Error Boundary component that catches rendering errors in its children.
 * Displays a user-friendly error message with a retry button.
 * Logs errors with component stack for debugging.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error with component stack
    console.error('[ErrorBoundary] Rendering error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Report to external error tracking (e.g. Sentry) if callback provided
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-4xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
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

            <h2 className="mb-2 text-xl font-semibold text-gray-900">Something went wrong</h2>

            <p className="mb-6 text-sm text-gray-600">
              An unexpected error occurred while loading this section. Please try again, or contact
              support if the problem persists.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mb-4 max-h-32 overflow-auto rounded-md bg-red-50 p-3 text-left text-xs text-red-800">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            )}

            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
