/**
 * Global Error Handler Plugin for Fastify
 *
 * Maps errors to proper HTTP status codes, produces structured error responses,
 * and ensures stack traces are never leaked in production.
 */

import type { FastifyInstance, FastifyError } from 'fastify';
import type { ZodError } from 'zod';
import type { StructuredLogger } from '@realflow/shared/src/logger';

// ─── Error Response Types ───────────────────────────────────────────

interface ErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;
}

interface ZodFieldError {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

// ─── Error Classification ───────────────────────────────────────────

function isZodError(err: unknown): err is ZodError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'ZodError' &&
    'issues' in err
  );
}

function getStatusCode(err: FastifyError | Error): number {
  // Fastify errors carry statusCode
  if ('statusCode' in err && typeof err.statusCode === 'number') {
    return err.statusCode;
  }

  // Zod validation errors
  if (isZodError(err)) {
    return 400;
  }

  // Default to 500 for unexpected errors
  return 500;
}

function getErrorCode(statusCode: number, err: FastifyError | Error): string {
  // Fastify errors may have a code
  if ('code' in err && typeof err.code === 'string') {
    return err.code;
  }

  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

function formatZodErrors(err: ZodError): ReadonlyArray<ZodFieldError> {
  return err.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
}

// ─── Plugin ─────────────────────────────────────────────────────────

interface ErrorHandlerPluginOptions {
  readonly logger: StructuredLogger;
  readonly isProduction: boolean;
}

export async function errorHandlerPlugin(
  fastify: FastifyInstance,
  options: ErrorHandlerPluginOptions,
) {
  const { logger, isProduction } = options;

  fastify.setErrorHandler((err, request, reply) => {
    const statusCode = getStatusCode(err);
    const errorCode = getErrorCode(statusCode, err);
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? request.id;

    // Build structured log context
    const logContext = {
      requestId,
      userId: (request.headers['x-user-id'] as string | undefined),
      method: request.method,
      url: request.url,
      statusCode,
      errorCode,
      error: err,
    };

    // Log at appropriate level
    if (statusCode >= 500) {
      logger.error('Unhandled server error', logContext);
    } else if (statusCode >= 400) {
      logger.warn('Client error', logContext);
    }

    // Build error response
    const response: ErrorResponse = {
      error: statusCode >= 500 && isProduction
        ? 'Internal server error'
        : err.message,
      code: errorCode,
      requestId,
    };

    // Attach Zod validation details for 400 errors
    if (isZodError(err)) {
      return reply.status(400).send({
        ...response,
        code: 'VALIDATION_ERROR',
        details: { fields: formatZodErrors(err) },
      } satisfies ErrorResponse);
    }

    // Attach additional details in non-production environments
    if (!isProduction && statusCode >= 500) {
      return reply.status(statusCode).send({
        ...response,
        details: { stack: err.stack },
      } satisfies ErrorResponse);
    }

    return reply.status(statusCode).send(response);
  });
}
