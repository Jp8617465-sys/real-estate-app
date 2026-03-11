import { createHmac, timingSafeEqual } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ─── Webhook Provider Types ────────────────────────────────────────────

type WebhookProvider = 'sendgrid' | 'mailgun';

// ─── Signature Verification ────────────────────────────────────────────

/**
 * Verify a SendGrid Inbound Parse webhook signature.
 *
 * SendGrid signs webhooks by computing an HMAC-SHA256 of the raw request body
 * using the webhook verification key, then sending the signature in the
 * `X-Twilio-Email-Event-Webhook-Signature` header.
 */
function verifySendGridSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secret: string,
): boolean {
  if (!signature || !timestamp || !secret) return false;

  const payload = timestamp + rawBody;
  const expected = createHmac('sha256', secret).update(payload).digest('base64');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Verify a Mailgun webhook signature.
 *
 * Mailgun signs webhooks by computing an HMAC-SHA256 of `timestamp + token`
 * using the webhook signing key.
 */
function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
  secret: string,
): boolean {
  if (!timestamp || !token || !signature || !secret) return false;

  const expected = createHmac('sha256', secret)
    .update(timestamp + token)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Validate a webhook signature for the given provider.
 * Returns true when no secret is configured (development/testing mode).
 */
export function validateWebhookSignature(
  provider: WebhookProvider,
  request: FastifyRequest,
  secret: string | undefined,
): boolean {
  // Skip validation when no secret is configured (dev/test)
  if (!secret) return true;

  const headers = request.headers as Record<string, string | undefined>;
  const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

  switch (provider) {
    case 'sendgrid': {
      const signature = headers['x-twilio-email-event-webhook-signature'] ?? '';
      const timestamp = headers['x-twilio-email-event-webhook-timestamp'] ?? '';
      return verifySendGridSignature(rawBody, signature, timestamp, secret);
    }

    case 'mailgun': {
      const body = request.body as Record<string, unknown>;
      const signatureBlock = body['signature'] as Record<string, string> | undefined;
      if (!signatureBlock) return false;

      return verifyMailgunSignature(
        signatureBlock['timestamp'] ?? '',
        signatureBlock['token'] ?? '',
        signatureBlock['signature'] ?? '',
        secret,
      );
    }

    default:
      return false;
  }
}

// ─── Rate Limiting ─────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Simple in-memory sliding-window rate limiter for webhook endpoints.
 *
 * Keyed by IP address. Not suitable for multi-instance deployments --
 * replace with Redis-backed limiter in production at scale.
 */
export class WebhookRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Returns true if the request is within the rate limit, false if it should be rejected.
   */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Prune expired entries to prevent memory leaks.
   * Call periodically (e.g. every 60s via setInterval).
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > this.windowMs) {
        this.store.delete(key);
      }
    }
  }
}

// ─── Idempotency Guard ─────────────────────────────────────────────────

/**
 * In-memory idempotency store that tracks processed message IDs.
 *
 * Prevents duplicate processing when a webhook provider retries delivery
 * of the same email. Each entry expires after `ttlMs` milliseconds.
 */
export class IdempotencyGuard {
  private processed: Map<string, number> = new Map();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /**
   * Check whether a message ID has already been processed.
   * If not, marks it as processed and returns false (meaning "not a duplicate").
   * If it has, returns true (meaning "is a duplicate, skip processing").
   */
  isDuplicate(messageId: string): boolean {
    const now = Date.now();
    const existing = this.processed.get(messageId);

    if (existing !== undefined && now - existing < this.ttlMs) {
      return true;
    }

    this.processed.set(messageId, now);
    return false;
  }

  /**
   * Prune expired entries to prevent memory leaks.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.processed.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.processed.delete(key);
      }
    }
  }
}

// ─── Fastify Plugin: Webhook Guards ────────────────────────────────────

/**
 * Create rate limiter and idempotency guard instances with sensible defaults
 * for the email webhook endpoint.
 */
export function createWebhookGuards() {
  // 100 requests per 60 seconds per IP
  const rateLimiter = new WebhookRateLimiter(100, 60_000);

  // Track processed message IDs for 24 hours
  const idempotencyGuard = new IdempotencyGuard(24 * 60 * 60 * 1000);

  // Prune expired entries every 5 minutes
  const pruneInterval = setInterval(
    () => {
      rateLimiter.prune();
      idempotencyGuard.prune();
    },
    5 * 60 * 1000,
  );

  // Ensure interval does not prevent Node from exiting
  if (pruneInterval.unref) {
    pruneInterval.unref();
  }

  return { rateLimiter, idempotencyGuard };
}
