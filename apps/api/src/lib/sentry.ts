/**
 * Sentry Integration for RealFlow API
 *
 * Initializes Sentry error tracking for the Fastify API server.
 * Configuration is driven entirely by environment variables.
 *
 * @requires @sentry/node — install via: npm install @sentry/node
 */

// NOTE: Requires installation of @sentry/node
// npm install @sentry/node
import * as Sentry from '@sentry/node';

// ─── Types ──────────────────────────────────────────────────────────

interface SentryConfig {
  readonly dsn: string | undefined;
  readonly environment: string;
  readonly release?: string;
  readonly sampleRate?: number;
}

/** Minimal Sentry event shape used by beforeSend / beforeSendTransaction callbacks. */
interface SentryEvent {
  request?: {
    url?: string;
    headers?: Record<string, string>;
  };
  [key: string]: unknown;
}

/** Minimal Sentry scope shape used by withScope callback. */
interface SentryScope {
  setTag(key: string, value: string): void;
  setUser(user: { id: string }): void;
  setExtra(key: string, value: unknown): void;
}

// ─── Initialization ─────────────────────────────────────────────────

let isInitialized = false;

/**
 * Initialize Sentry for the API server.
 * No-ops gracefully if SENTRY_DSN is not configured.
 */
export function initSentry(config: SentryConfig): void {
  if (isInitialized) return;

  if (!config.dsn) {
    console.info('[Sentry] SENTRY_DSN not configured — error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release ?? `realflow-api@${process.env['npm_package_version'] ?? '0.1.0'}`,
    tracesSampleRate: config.sampleRate ?? 0.1,

    // Filter out health check transactions
    beforeSendTransaction(event: SentryEvent) {
      const url = event.request?.url ?? '';
      if (url.includes('/health')) {
        return null;
      }
      return event;
    },

    // Scrub sensitive data from error reports
    beforeSend(event: SentryEvent) {
      if (event.request?.headers) {
        const headers = { ...event.request.headers };
        delete headers['authorization'];
        delete headers['cookie'];
        delete headers['x-api-key'];
        event.request.headers = headers;
      }
      return event;
    },
  });

  isInitialized = true;
  console.info('[Sentry] Initialized for API server');
}

/**
 * Report an error to Sentry with optional context.
 * No-ops if Sentry is not initialized.
 */
export function captureError(
  error: Error,
  context?: {
    readonly requestId?: string;
    readonly userId?: string;
    readonly tags?: Record<string, string>;
    readonly extra?: Record<string, unknown>;
  },
): void {
  if (!isInitialized) return;

  Sentry.withScope((scope: SentryScope) => {
    if (context?.requestId) {
      scope.setTag('requestId', context.requestId);
    }
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
    Sentry.captureException(error);
  });
}

/**
 * Flush pending Sentry events before shutdown.
 * Call this during graceful shutdown.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!isInitialized) return;
  await Sentry.close(timeoutMs);
}
