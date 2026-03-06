/**
 * Sentry Integration for RealFlow API
 *
 * Initializes Sentry error tracking for the Fastify API server.
 * Configuration is driven entirely by environment variables.
 *
 * When @sentry/node is not installed, all functions gracefully no-op.
 * Install via: npm install @sentry/node
 */

// ─── Types ──────────────────────────────────────────────────────────

interface SentryConfig {
  readonly dsn: string | undefined;
  readonly environment: string;
  readonly release?: string;
  readonly sampleRate?: number;
}

// ─── State ──────────────────────────────────────────────────────────

let isInitialized = false;
let SentryModule: {
  init: (options: Record<string, unknown>) => void;
  withScope: (callback: (scope: { setTag: (k: string, v: string) => void; setUser: (u: { id: string }) => void; setExtra: (k: string, v: unknown) => void }) => void) => void;
  captureException: (error: Error) => void;
  close: (timeout: number) => Promise<boolean>;
} | null = null;

// ─── Initialization ─────────────────────────────────────────────────

/**
 * Initialize Sentry for the API server.
 * No-ops gracefully if SENTRY_DSN is not configured or @sentry/node is not installed.
 */
export async function initSentry(config: SentryConfig): Promise<void> {
  if (isInitialized) return;

  if (!config.dsn) {
    console.info('[Sentry] SENTRY_DSN not configured — error tracking disabled');
    return;
  }

  try {
    SentryModule = await import('@sentry/node');
  } catch {
    console.info('[Sentry] @sentry/node not installed — error tracking disabled');
    return;
  }

  if (!SentryModule) return;

  SentryModule.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release ?? `realflow-api@${process.env['npm_package_version'] ?? '0.1.0'}`,
    tracesSampleRate: config.sampleRate ?? 0.1,
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
  if (!isInitialized || !SentryModule) return;

  SentryModule.withScope((scope) => {
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
    SentryModule?.captureException(error);
  });
}

/**
 * Flush pending Sentry events before shutdown.
 * Call this during graceful shutdown.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!isInitialized || !SentryModule) return;
  await SentryModule.close(timeoutMs);
}
