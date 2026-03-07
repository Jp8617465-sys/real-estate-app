/**
 * Cache Middleware — Fastify Plugin
 *
 * Automatically caches GET responses and invalidates on mutations.
 *
 * Features:
 * - Cache key = URL + query params + user ID (RLS-safe)
 * - Configurable TTL per route
 * - Cache-Control response headers
 * - Bypass with ?no-cache=true or Cache-Control: no-cache header
 * - Auto-invalidation on POST/PUT/PATCH/DELETE to same namespace
 *
 * Usage:
 *   await fastify.register(cacheMiddleware, {
 *     ttl: 30,
 *     namespace: 'contacts',
 *   });
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { cache, type CacheNamespace, DEFAULT_TTL } from '../lib/cache';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CacheMiddlewareOptions {
  /** Cache namespace — used for key prefixing and invalidation grouping */
  namespace: CacheNamespace;
  /** TTL in seconds. Defaults to the namespace default from cache config. */
  ttl?: number;
  /** HTTP methods to cache. Defaults to ['GET']. */
  methods?: ReadonlyArray<string>;
  /** Routes to exclude from caching (path suffixes). */
  excludeRoutes?: ReadonlyArray<string>;
}

interface CachedResponse {
  statusCode: number;
  body: unknown;
  cachedAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract user ID from the Authorization header JWT.
 * Decodes the payload without verification — auth is already handled
 * by the supabase middleware upstream.
 */
function extractUserId(request: FastifyRequest): string {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return 'anonymous';

  try {
    const token = authHeader.slice(7);
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return 'anonymous';

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8')) as {
      sub?: string;
    };
    return payload.sub ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}

/**
 * Build a deterministic cache key from the request.
 */
function buildCacheKey(
  namespace: CacheNamespace,
  request: FastifyRequest,
  userId: string,
): string {
  const url = request.url.split('?')[0] ?? request.url;
  const queryString = request.url.includes('?')
    ? request.url.slice(request.url.indexOf('?'))
    : '';

  // Sort query params for consistent keys
  const params = new URLSearchParams(queryString);
  params.delete('no-cache');
  params.sort();

  return `${userId}:${url}:${params.toString()}`;
}

/**
 * Check whether the request should bypass cache.
 */
function shouldBypassCache(request: FastifyRequest): boolean {
  // Check query parameter
  const query = request.query as Record<string, string | undefined>;
  if (query['no-cache'] === 'true') return true;

  // Check Cache-Control header
  const cacheControl = request.headers['cache-control'];
  if (cacheControl && cacheControl.includes('no-cache')) return true;

  return false;
}

// ─── Mutating methods that trigger invalidation ─────────────────────────────────

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ─── Plugin ─────────────────────────────────────────────────────────────────────

async function cacheMiddlewarePlugin(
  fastify: FastifyInstance,
  options: CacheMiddlewareOptions,
): Promise<void> {
  const {
    namespace,
    ttl = DEFAULT_TTL[namespace] ?? 60,
    methods = ['GET'],
    excludeRoutes = [],
  } = options;

  const cachedMethods = new Set(methods.map((m) => m.toUpperCase()));

  // Ensure cache is connected
  await cache.connect();

  // ─── Hook: onRequest — serve from cache or continue ───────────────────────

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only cache specified methods
    if (!cachedMethods.has(request.method)) return;

    // Check exclusions
    const path = request.url.split('?')[0] ?? '';
    const isExcluded = excludeRoutes.some((route) => path.endsWith(route));
    if (isExcluded) return;

    // Check bypass
    if (shouldBypassCache(request)) return;

    const userId = extractUserId(request);
    const cacheKey = buildCacheKey(namespace, request, userId);

    const cached = await cache.get<CachedResponse>(namespace, cacheKey);

    if (cached) {
      // Set cache headers
      reply.header('X-Cache', 'HIT');
      reply.header('X-Cache-Age', Math.floor((Date.now() - cached.cachedAt) / 1000).toString());
      reply.header('Cache-Control', `private, max-age=${ttl}`);

      await reply.status(cached.statusCode).send(cached.body);
    }
  });

  // ─── Hook: onSend — store successful responses in cache ───────────────────

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: string) => {
    // Only cache specified methods
    if (!cachedMethods.has(request.method)) return payload;

    // Check exclusions
    const path = request.url.split('?')[0] ?? '';
    const isExcluded = excludeRoutes.some((route) => path.endsWith(route));
    if (isExcluded) return payload;

    // Skip if already served from cache
    if (reply.getHeader('X-Cache') === 'HIT') return payload;

    // Skip if bypass was requested
    if (shouldBypassCache(request)) return payload;

    // Only cache successful responses
    if (reply.statusCode < 200 || reply.statusCode >= 300) return payload;

    const userId = extractUserId(request);
    const cacheKey = buildCacheKey(namespace, request, userId);

    try {
      const body = typeof payload === 'string' ? JSON.parse(payload) as unknown : payload;

      const cachedResponse: CachedResponse = {
        statusCode: reply.statusCode,
        body,
        cachedAt: Date.now(),
      };

      await cache.set(namespace, cacheKey, cachedResponse, { ttl });

      // Set cache headers for fresh responses
      reply.header('X-Cache', 'MISS');
      reply.header('Cache-Control', `private, max-age=${ttl}`);
    } catch {
      // Serialization failed — skip caching, do not break the response
    }

    return payload;
  });

  // ─── Hook: onResponse — invalidate cache on mutations ─────────────────────

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only invalidate on successful mutations
    if (!MUTATING_METHODS.has(request.method)) return;
    if (reply.statusCode < 200 || reply.statusCode >= 300) return;

    const deletedCount = await cache.invalidateNamespace(namespace);
    if (deletedCount > 0) {
      request.log.info(
        `[Cache] Invalidated ${deletedCount} entries in namespace "${namespace}" after ${request.method} ${request.url}`,
      );
    }
  });
}

// ─── Export as encapsulated Fastify plugin ───────────────────────────────────────

export const cacheMiddleware = fp(cacheMiddlewarePlugin, {
  name: 'realflow-cache-middleware',
  fastify: '5.x',
});
