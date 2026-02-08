import Fastify from 'fastify';
import cors from '@fastify/cors';
import { contactRoutes } from './routes/contacts';
import { propertyRoutes } from './routes/properties';
import { pipelineRoutes } from './routes/pipeline';
import { webhookRoutes } from './routes/webhooks';

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

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', service: 'realflow-api' }));

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`RealFlow API running on port ${port}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
