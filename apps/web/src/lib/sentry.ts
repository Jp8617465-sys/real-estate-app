/**
 * Sentry Integration for RealFlow Web
 *
 * Initializes Sentry error tracking for the Next.js web application.
 * Configuration is driven entirely by environment variables.
 *
 * @requires @sentry/nextjs — install via: npm install @sentry/nextjs
 *
 * Source maps upload configuration:
 * Add to next.config.js:
 *   const { withSentryConfig } = require('@sentry/nextjs');
 *   module.exports = withSentryConfig(nextConfig, {
 *     org: 'realflow',
 *     project: 'realflow-web',
 *     silent: true,
 *     widenClientFileUpload: true,
 *     hideSourceMaps: true,
 *   });
 */

// NOTE: Requires installation of @sentry/nextjs
// npm install @sentry/nextjs
import * as Sentry from '@sentry/nextjs';

// ─── Types ──────────────────────────────────────────────────────────

interface SentryWebConfig {
  readonly dsn: string | undefined;
  readonly environment: string;
  readonly release?: string;
  readonly sampleRate?: number;
  readonly replaysSampleRate?: number;
}

// ─── Initialization ─────────────────────────────────────────────────

let isInitialized = false;

/**
 * Initialize Sentry for the Next.js web application.
 * No-ops gracefully if NEXT_PUBLIC_SENTRY_DSN is not configured.
 *
 * Call this in your instrumentation.ts or _app.tsx:
 *   import { initWebSentry } from '@/lib/sentry';
 *   initWebSentry({
 *     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
 *     environment: process.env.NODE_ENV,
 *   });
 */
export function initWebSentry(config: SentryWebConfig): void {
  if (isInitialized) return;

  if (!config.dsn) {
    console.info('[Sentry] NEXT_PUBLIC_SENTRY_DSN not configured — error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release ?? `realflow-web@${process.env['npm_package_version'] ?? '0.1.0'}`,
    tracesSampleRate: config.sampleRate ?? 0.1,

    // Session replay for debugging user-facing issues
    replaysSessionSampleRate: config.replaysSampleRate ?? 0.0,
    replaysOnErrorSampleRate: 1.0,

    // Ignore common browser noise
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'AbortError',
      'ChunkLoadError',
    ],
  });

  isInitialized = true;
}

/**
 * Report an error to Sentry from the web application.
 * No-ops if Sentry is not initialized.
 */
export function captureWebError(
  error: Error,
  context?: {
    readonly userId?: string;
    readonly tags?: Record<string, string>;
    readonly extra?: Record<string, unknown>;
    readonly componentStack?: string;
  },
): void {
  if (!isInitialized) return;

  Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value);
      }
    }
    if (context?.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value);
      }
    }
    if (context?.componentStack) {
      scope.setExtra('componentStack', context.componentStack);
    }
    Sentry.captureException(error);
  });
}
