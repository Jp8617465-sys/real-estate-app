/**
 * Structured Logger for RealFlow
 *
 * Provides a structured, JSON-based logging interface built on pino.
 * Environment-aware: pretty-printed in development, JSON in production.
 *
 * @requires pino — install via: npm install pino
 * @requires pino-pretty — install as devDependency: npm install -D pino-pretty
 */

// NOTE: Requires installation of pino and pino-pretty
// npm install pino
// npm install -D pino-pretty
import type { Logger as PinoLogger } from 'pino';
import pino from 'pino';

// ─── Log Level ──────────────────────────────────────────────────────
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ─── Logger Context ─────────────────────────────────────────────────
export interface LogContext {
  readonly module?: string;
  readonly requestId?: string;
  readonly userId?: string;
  readonly [key: string]: unknown;
}

// ─── Logger Configuration ───────────────────────────────────────────
export interface LoggerConfig {
  readonly level: LogLevel;
  readonly serviceName: string;
  readonly environment: 'development' | 'production' | 'test';
  readonly version?: string;
}

// ─── Structured Logger ─────────────────────────────────────────────
export interface StructuredLogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext & { error?: Error }): void;
  fatal(message: string, context?: LogContext & { error?: Error }): void;
  child(bindings: LogContext): StructuredLogger;
}

function wrapPinoLogger(pinoInstance: PinoLogger): StructuredLogger {
  return {
    debug(message: string, context?: LogContext) {
      if (context) {
        pinoInstance.debug(context, message);
      } else {
        pinoInstance.debug(message);
      }
    },

    info(message: string, context?: LogContext) {
      if (context) {
        pinoInstance.info(context, message);
      } else {
        pinoInstance.info(message);
      }
    },

    warn(message: string, context?: LogContext) {
      if (context) {
        pinoInstance.warn(context, message);
      } else {
        pinoInstance.warn(message);
      }
    },

    error(message: string, context?: LogContext & { error?: Error }) {
      if (context) {
        const { error: err, ...rest } = context;
        if (err) {
          pinoInstance.error({ ...rest, err }, message);
        } else {
          pinoInstance.error(rest, message);
        }
      } else {
        pinoInstance.error(message);
      }
    },

    fatal(message: string, context?: LogContext & { error?: Error }) {
      if (context) {
        const { error: err, ...rest } = context;
        if (err) {
          pinoInstance.fatal({ ...rest, err }, message);
        } else {
          pinoInstance.fatal(rest, message);
        }
      } else {
        pinoInstance.fatal(message);
      }
    },

    child(bindings: LogContext): StructuredLogger {
      return wrapPinoLogger(pinoInstance.child(bindings));
    },
  };
}

/**
 * Create a structured logger instance.
 *
 * In development, logs are pretty-printed for readability.
 * In production, logs are structured JSON for aggregation tools.
 * In test, logging is suppressed by default (level: 'fatal').
 */
export function createLogger(config: LoggerConfig): StructuredLogger {
  const isDevelopment = config.environment === 'development';
  const isTest = config.environment === 'test';

  const pinoInstance = pino({
    level: isTest ? 'fatal' : config.level,
    base: {
      service: config.serviceName,
      env: config.environment,
      ...(config.version ? { version: config.version } : {}),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Redact sensitive fields from logs
    redact: {
      paths: [
        'authorization',
        'cookie',
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'apiKey',
        'secret',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    ...(isDevelopment
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
  });

  return wrapPinoLogger(pinoInstance);
}

/**
 * Create a child logger for a specific module.
 * Convenience function for per-module logging.
 */
export function createModuleLogger(
  parent: StructuredLogger,
  moduleName: string,
): StructuredLogger {
  return parent.child({ module: moduleName });
}
