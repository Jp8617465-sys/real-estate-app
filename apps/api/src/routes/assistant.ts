import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';
import { isAIEnabled, getAnthropicClientOrNull, checkAIRateLimit } from '../services/ai-service-factory';
import { AssistantService } from '../services/ai-assistant/assistant-service';
import type { ProductType } from '@realflow/shared';

// ─── Helpers ────────────────────────────────────────────────────────

function extractUserIdFromToken(request: FastifyRequest): string | null {
  const token = request.headers.authorization?.slice(7);
  if (!token) return null;
  try {
    const parts = token.split('.');
    const payloadB64 = parts[1];
    if (!payloadB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

async function getAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ supabase: ReturnType<typeof createSupabaseClient>; userId: string; productAccess: ProductType } | null> {
  if (!isAIEnabled()) {
    reply.status(503).send({ error: 'AI assistant is not configured. Set ANTHROPIC_API_KEY.' });
    return null;
  }

  let supabase: ReturnType<typeof createSupabaseClient>;
  try {
    supabase = createSupabaseClient(request);
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  // Rate limit
  const rateLimitKey = extractUserIdFromToken(request) ?? request.ip;
  if (!checkAIRateLimit(rateLimitKey)) {
    reply.status(429).send({ error: 'Too many AI requests. Please wait a moment before retrying.' });
    return null;
  }

  // Get internal user ID and product access
  const { data: profile } = await supabase
    .from('users')
    .select('id, product_access, offices(product_type)')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    reply.status(401).send({ error: 'User profile not found' });
    return null;
  }

  const officeProductType =
    profile.offices && typeof profile.offices === 'object' && 'product_type' in profile.offices
      ? (profile.offices as { product_type: ProductType }).product_type
      : 'both';

  const productAccess: ProductType = (profile.product_access as ProductType) ?? officeProductType;

  return { supabase, userId: profile.id, productAccess };
}

// ─── Routes ─────────────────────────────────────────────────────────

export async function assistantRoutes(fastify: FastifyInstance) {
  // POST /chat — non-streaming chat
  fastify.post('/chat', async (request, reply) => {
    const auth = await getAuthenticatedUser(request, reply);
    if (!auth) return;

    const body = request.body as { conversationId?: string; message?: string } | undefined;
    if (!body?.message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    const client = getAnthropicClientOrNull();
    if (!client) {
      return reply.status(503).send({ error: 'AI assistant is not configured.' });
    }

    const service = new AssistantService(client, auth.supabase);

    try {
      const result = await service.chat({
        conversationId: body.conversationId,
        userMessage: body.message,
        userId: auth.userId,
        productAccess: auth.productAccess,
      });
      return { data: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'Assistant chat failed');
      return reply.status(500).send({ error: `Assistant error: ${message}` });
    }
  });

  // POST /chat/stream — SSE streaming chat
  fastify.post('/chat/stream', async (request, reply) => {
    const auth = await getAuthenticatedUser(request, reply);
    if (!auth) return;

    const body = request.body as { conversationId?: string; message?: string } | undefined;
    if (!body?.message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    const client = getAnthropicClientOrNull();
    if (!client) {
      return reply.status(503).send({ error: 'AI assistant is not configured.' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const service = new AssistantService(client, auth.supabase);

    try {
      for await (const event of service.streamChat({
        conversationId: body.conversationId,
        userMessage: body.message,
        userId: auth.userId,
        productAccess: auth.productAccess,
      })) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    }

    reply.raw.end();
  });

  // GET /conversations — list user's conversations
  fastify.get('/conversations', async (request, reply) => {
    if (!isAIEnabled()) {
      return reply.status(503).send({ error: 'AI assistant is not configured.' });
    }

    let supabase: ReturnType<typeof createSupabaseClient>;
    try {
      supabase = createSupabaseClient(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return reply.status(401).send({ error: 'User profile not found' });
    }

    const client = getAnthropicClientOrNull();
    if (!client) {
      return reply.status(503).send({ error: 'AI assistant is not configured.' });
    }

    const service = new AssistantService(client, supabase);
    const conversations = await service.getConversations(profile.id);
    return { data: conversations };
  });

  // GET /conversations/:id/messages — get messages for a conversation
  fastify.get('/conversations/:id/messages', async (request, reply) => {
    if (!isAIEnabled()) {
      return reply.status(503).send({ error: 'AI assistant is not configured.' });
    }

    let supabase: ReturnType<typeof createSupabaseClient>;
    try {
      supabase = createSupabaseClient(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const params = request.params as { id: string };
    const client = getAnthropicClientOrNull();
    if (!client) {
      return reply.status(503).send({ error: 'AI assistant is not configured.' });
    }

    const service = new AssistantService(client, supabase);
    const messages = await service.getConversationMessages(params.id);
    return { data: messages };
  });

  // DELETE /conversations/:id — delete a conversation
  fastify.delete('/conversations/:id', async (request, reply) => {
    if (!isAIEnabled()) {
      return reply.status(503).send({ error: 'AI assistant is not configured.' });
    }

    let supabase: ReturnType<typeof createSupabaseClient>;
    try {
      supabase = createSupabaseClient(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const params = request.params as { id: string };
    const client = getAnthropicClientOrNull();
    if (!client) {
      return reply.status(503).send({ error: 'AI assistant is not configured.' });
    }

    const service = new AssistantService(client, supabase);
    await service.deleteConversation(params.id);
    return { success: true };
  });
}
