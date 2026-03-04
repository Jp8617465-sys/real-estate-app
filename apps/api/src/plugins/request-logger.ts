/**
 * Request Logging Plugin for Fastify
 *
 * Logs every request with method, URL, status code, and duration.
 * Generates and propagates request IDs via X-Request-Id header.
 * Redacts sensitive headers and skips verbose logging for health checks.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { StructuredLogger } from '@realflow/shared/src/logger';

// ─── Types ──────────────────────────────────────────────────────────

interface RequestLoggerPluginOptions {
  readonly logger: StructuredLogger;
  readonly skipPaths?: ReadonlyArray<string>;
}

// ─── Constants ──────────────────────────────────────────────────────

const HEALTH_CHECK_PATHS = ['/health', '/health/ready', '/health/live'];

const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);

// ─── Helpers ────────────────────────────────────────────────────────

function redactHeaders(
  headers: Record<string, string | ReadonlyArray<string> | undefined>,
): Record<string, string | ReadonlyArray<string> | undefined> {
  const redacted: Record<string, string | ReadonlyArray<string> | undefined> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (REDACTED_HEADERS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

function shouldSkipLogging(
  url: string,
  skipPaths: ReadonlyArray<string>,
): boolean {
  return skipPaths.some((path) => url.startsWith(path));
}

// ─── Plugin ─────────────────────────────────────────────────────────

export async function requestLoggerPlugin(
  fastify: FastifyInstance,
  options: RequestLoggerPluginOptions,
) {
  const { logger } = options;
  const skipPaths = options.skipPaths ?? HEALTH_CHECK_PATHS;

  // Assign request ID on every incoming request
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const incomingId = request.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && incomingId.length > 0
      ? incomingId
      : randomUUID();

    // Store request ID for downstream use
    request.headers['x-request-id'] = requestId;

    // Propagate request ID in the response
    void reply.header('X-Request-Id', requestId);

    // Record start time
    (request as FastifyRequest & { startTime: bigint }).startTime = process.hrtime.bigint();
  });

  // Log completed requests
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.headers['x-request-id'] as string;
    const startTime = (request as FastifyRequest & { startTime: bigint }).startTime;
    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1_000_000;

    const isHealthCheck = shouldSkipLogging(request.url, skipPaths);

    // Always log at debug for health checks, info for everything else
    if (isHealthCheck) {
      logger.debug('Request completed', {
        requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
      return;
    }

    const logContext = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    if (reply.statusCode >= 500) {
      logger.error('Request completed with server error', logContext);
    } else if (reply.statusCode >= 400) {
      logger.warn('Request completed with client error', logContext);
    } else {
      logger.info('Request completed', logContext);
    }
  });

  // Log request details at debug level (useful for development troubleshooting)
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const isHealthCheck = shouldSkipLogging(request.url, skipPaths);
    if (isHealthCheck) return;

    logger.debug('Incoming request', {
      requestId: request.headers['x-request-id'] as string,
      method: request.method,
      url: request.url,
      headers: redactHeaders(
        request.headers as Record<string, string | ReadonlyArray<string> | undefined>,
      ),
    });
  });
}
