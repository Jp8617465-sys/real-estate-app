import { env } from './config/env';
import Fastify from 'fastify';
import cors from '@fastify/cors';
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

const fastify = Fastify({
  logger: true,
});

async function start() {
  await fastify.register(cors, {
    origin: [
      'http://localhost:3000', // Next.js dev
      'http://localhost:8081', // Expo dev
    ],
  });

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

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', service: 'realflow-api' }));

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`RealFlow API running on port ${env.PORT}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
