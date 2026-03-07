import type { FastifyInstance } from 'fastify';
import { createSupabaseServiceClient } from '../middleware/supabase';

// ─── Types ──────────────────────────────────────────────────────────

interface HealthStatus {
  readonly status: 'ok' | 'degraded' | 'unhealthy';
  readonly service: string;
  readonly version: string;
  readonly uptime: number;
  readonly timestamp: string;
}

interface ReadinessCheck {
  readonly name: string;
  readonly status: 'ok' | 'error';
  readonly latencyMs: number;
  readonly message?: string;
}

interface ReadinessResponse {
  readonly status: 'ok' | 'degraded' | 'unhealthy';
  readonly service: string;
  readonly version: string;
  readonly uptime: number;
  readonly timestamp: string;
  readonly memory: {
    readonly rss: number;
    readonly heapUsed: number;
    readonly heapTotal: number;
  };
  readonly checks: ReadonlyArray<ReadinessCheck>;
}

interface LivenessResponse {
  readonly status: 'ok';
  readonly pid: number;
  readonly uptime: number;
  readonly timestamp: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const SERVICE_NAME = 'realflow-api';
const SERVICE_VERSION = process.env['npm_package_version'] ?? '0.1.0';

// ─── Helpers ────────────────────────────────────────────────────────

async function checkSupabaseConnection(): Promise<ReadinessCheck> {
  const start = Date.now();
  try {
    const supabase = createSupabaseServiceClient();
    // Simple query to verify database connectivity
    const { error } = await supabase.from('contacts').select('id').limit(1);
    const latencyMs = Date.now() - start;

    if (error) {
      return {
        name: 'supabase',
        status: 'error',
        latencyMs,
        message: error.message,
      };
    }

    return { name: 'supabase', status: 'ok', latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { name: 'supabase', status: 'error', latencyMs, message };
  }
}

// ─── Routes ─────────────────────────────────────────────────────────

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /health — Basic health check.
   * Returns 200 if the process is running. Suitable for load balancer checks.
   */
  fastify.get('/', async (): Promise<HealthStatus> => {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * GET /health/ready — Readiness check.
   * Verifies that the service can handle requests by checking dependencies.
   * Returns 200 if all checks pass, 503 if any critical check fails.
   */
  fastify.get('/ready', async (_request, reply) => {
    const checks = await Promise.all([checkSupabaseConnection()]);

    const allOk = checks.every((c) => c.status === 'ok');
    const memoryUsage = process.memoryUsage();

    const response: ReadinessResponse = {
      status: allOk ? 'ok' : 'unhealthy',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
      },
      checks,
    };

    if (!allOk) {
      return reply.status(503).send(response);
    }

    return response;
  });

  /**
   * GET /health/live — Liveness check.
   * Returns 200 if the process is alive. Used by orchestrators to detect hangs.
   */
  fastify.get('/live', async (): Promise<LivenessResponse> => {
    return {
      status: 'ok',
      pid: process.pid,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });
}
