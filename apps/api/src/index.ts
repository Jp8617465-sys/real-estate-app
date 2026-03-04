import { env } from './config/env';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createLogger } from '@realflow/shared/src/logger';
import { errorHandlerPlugin } from './plugins/error-handler';
import { requestLoggerPlugin } from './plugins/request-logger';
import { healthRoutes } from './routes/health';
import { initSentry, flushSentry } from './lib/sentry';
import { contactRoutes } from './routes/contacts';
import { propertyRoutes } from './routes/properties';
import { pipelineRoutes } from './routes/pipeline';
import { webhookRoutes } from './routes/webhooks';
import { clientBriefRoutes } from './routes/client-briefs';
import { propertyMatchRoutes } from './routes/property-matches';
import { inspectionRoutes } from './routes/inspections';
import { offerRoutes } from './routes/offers';
import { dueDiligenceRoutes } from './routes/due-diligence';
import { keyDateRoutes } from './routes/key-dates';
import { feeRoutes } from './routes/fees';
import { sellingAgentRoutes } from './routes/selling-agents';
import { inboxRoutes } from './routes/inbox';
import { inboxWebhookRoutes } from './routes/inbox-webhooks';
import { taskRoutes } from './routes/tasks';
import { workflowRoutes } from './routes/workflows';
import { documentRoutes } from './routes/documents';
import { portalRoutes } from './routes/portal';
import { settingsRoutes } from './routes/settings';
import { socialPostRoutes } from './routes/social-posts';
import { pipelineMigrationRoutes } from './routes/pipeline-migration';
import { aiRoutes } from './routes/ai';
import { dailyActionRoutes } from './routes/daily-actions';
import { notificationRoutes } from './routes/notifications';
import { pushTokenRoutes } from './routes/push-tokens';
import { followUpSequenceRoutes } from './routes/follow-up-sequences';
import { getWorkflowScheduler } from './services/workflow-scheduler';
import { domainSyncRoutes } from './routes/domain-sync';
import { analyticsRoutes } from './routes/analytics';
import { complianceRoutes } from './routes/compliance';
import { consolidationReportRoutes } from './routes/consolidation-reports';
import { cache } from './lib/cache';
import { CachedQueryService } from './services/cached-queries';
import { createSupabaseServiceClient } from './middleware/supabase';

// ─── Initialize Observability ───────────────────────────────────────

const isProduction = env.NODE_ENV === 'production';

// Initialize structured logger
const logger = createLogger({
  level: env.LOG_LEVEL,
  serviceName: 'realflow-api',
  environment: env.NODE_ENV,
});

// Initialize Sentry (no-ops if SENTRY_DSN not set)
initSentry({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
});

// ─── Create Fastify Instance ────────────────────────────────────────

const fastify = Fastify({
  // Disable Fastify's built-in logger — we use our own structured logger
  logger: false,
});

async function start() {
  // Register observability plugins first
  await fastify.register(requestLoggerPlugin, { logger });
  await fastify.register(errorHandlerPlugin, { logger, isProduction });

  await fastify.register(cors, {
    origin: [
      'http://localhost:3000', // Next.js dev
      'http://localhost:8081', // Expo dev
      'http://localhost:3002', // Portal dev
    ],
  });

  // Health check routes (registered before auth-protected routes)
  await fastify.register(healthRoutes, { prefix: '/health' });

  // Register routes
  await fastify.register(contactRoutes, { prefix: '/api/v1/contacts' });
  await fastify.register(propertyRoutes, { prefix: '/api/v1/properties' });
  await fastify.register(pipelineRoutes, { prefix: '/api/v1/pipeline' });
  await fastify.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await fastify.register(clientBriefRoutes, { prefix: '/api/v1/client-briefs' });
  await fastify.register(propertyMatchRoutes, { prefix: '/api/v1/property-matches' });
  await fastify.register(inspectionRoutes, { prefix: '/api/v1/inspections' });
  await fastify.register(offerRoutes, { prefix: '/api/v1/offers' });
  await fastify.register(dueDiligenceRoutes, { prefix: '/api/v1/due-diligence' });
  await fastify.register(keyDateRoutes, { prefix: '/api/v1/key-dates' });
  await fastify.register(feeRoutes, { prefix: '/api/v1/fees' });
  await fastify.register(sellingAgentRoutes, { prefix: '/api/v1/selling-agents' });
  await fastify.register(inboxRoutes, { prefix: '/api/v1/inbox' });
  await fastify.register(inboxWebhookRoutes, { prefix: '/api/v1/inbox/webhooks' });
  await fastify.register(taskRoutes, { prefix: '/api/v1/tasks' });
  await fastify.register(workflowRoutes, { prefix: '/api/v1/workflows' });
  await fastify.register(documentRoutes, { prefix: '/api/v1/documents' });
  await fastify.register(portalRoutes, { prefix: '/api/v1/portal' });
  await fastify.register(settingsRoutes, { prefix: '/api/v1/settings' });
  await fastify.register(socialPostRoutes, { prefix: '/api/v1/social-posts' });
  await fastify.register(pipelineMigrationRoutes, { prefix: '/api/v1/pipeline-migration' });
  await fastify.register(aiRoutes, { prefix: '/api/v1/ai' });
  await fastify.register(domainSyncRoutes, { prefix: '/api/v1/domain' });
  await fastify.register(dailyActionRoutes, { prefix: '/api/v1/daily-actions' });
  await fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await fastify.register(pushTokenRoutes, { prefix: '/api/v1/push-tokens' });
  await fastify.register(followUpSequenceRoutes, { prefix: '/api/v1/follow-up-sequences' });
  await fastify.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await fastify.register(complianceRoutes, { prefix: '/api/v1/compliance' });
  await fastify.register(consolidationReportRoutes, { prefix: '/api/v1/consolidation-reports' });

  // Scheduler tick — manual trigger for dev/test environments
  fastify.post('/api/v1/scheduler/tick', async () => {
    const result = await getWorkflowScheduler().tick();
    return { data: result };
  });

  // ─── Initialize Redis cache (graceful — continues if unavailable) ───
  await cache.connect();

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`RealFlow API running on port ${env.PORT}`, {
    port: env.PORT,
    environment: env.NODE_ENV,
  });

  // Start workflow scheduler after server is up
  getWorkflowScheduler().start();

  // Warm cache in background after server is ready
  if (cache.isConnected()) {
    const serviceClient = createSupabaseServiceClient();
    void CachedQueryService.warmCache(serviceClient).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Cache warming failed: ${message}`);
    });
  }
}

// ─── Graceful Shutdown ──────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  await fastify.close();
  await cache.disconnect();
  await flushSentry();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start().catch((err) => {
  logger.fatal('Failed to start server', { error: err instanceof Error ? err : new Error(String(err)) });
  process.exit(1);
});
