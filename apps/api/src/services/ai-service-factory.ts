import { env } from '../config/env';
import { AnthropicClient, AICache } from '@realflow/integrations';
import { AIPropertyMatchingService } from './ai-property-matching';
import { AILeadScoringService } from './ai-lead-scoring';

// ─── Singletons ─────────────────────────────────────────────────────
// These are server-level singletons. The Anthropic API key is server-level
// (not per-user), unlike OAuth-based integrations which are per-user.

let _cache: AICache | null = null;
let _anthropicClient: AnthropicClient | null = null;

// ─── Per-user AI Rate Limiter ────────────────────────────────────────
// Simple sliding-window counter: max 20 AI requests per user per minute.
// Stored in-process (sufficient for single-instance v1; replace with Redis for multi-instance).
const AI_RATE_LIMIT = 20; // requests per window
const AI_RATE_WINDOW_MS = 60_000; // 1 minute

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const _userRateLimits = new Map<string, RateLimitEntry>();

/**
 * Check whether the given user ID is within the per-user AI rate limit.
 * Returns true if the request is allowed, false if the limit is exceeded.
 */
export function checkAIRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = _userRateLimits.get(userId);

  if (!entry || now - entry.windowStart >= AI_RATE_WINDOW_MS) {
    // Start a fresh window
    _userRateLimits.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= AI_RATE_LIMIT) {
    return false;
  }

  entry.count += 1;
  return true;
}

function getCache(): AICache {
  if (!_cache) {
    _cache = new AICache({
      defaultTtlMs: 24 * 60 * 60 * 1000, // 24 hours for property analysis
      maxEntries: 10_000,
    });
  }
  return _cache;
}

function getAnthropicClient(): AnthropicClient | null {
  if (!env.ANTHROPIC_API_KEY) return null;

  if (!_anthropicClient) {
    _anthropicClient = new AnthropicClient({
      apiKey: env.ANTHROPIC_API_KEY,
      ...(env.ANTHROPIC_MODEL && { model: env.ANTHROPIC_MODEL }),
      ...(env.ANTHROPIC_MAX_TOKENS && { maxTokens: env.ANTHROPIC_MAX_TOKENS }),
      ...(env.ANTHROPIC_RATE_LIMIT_PER_MINUTE && { rateLimitPerMinute: env.ANTHROPIC_RATE_LIMIT_PER_MINUTE }),
    });
  }

  return _anthropicClient;
}

// ─── Public Factory Functions ───────────────────────────────────────

/** Returns true if an Anthropic API key is configured. */
export function isAIEnabled(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** Get the shared AI response cache and its statistics. */
export function getAICacheStats() {
  return getCache().getStats();
}

/** Get the AI-enhanced property matching service. */
export function getAIPropertyMatchingService(): AIPropertyMatchingService {
  return new AIPropertyMatchingService(getAnthropicClient(), getCache());
}

/** Get the AI-enhanced lead scoring service. */
export function getAILeadScoringService(): AILeadScoringService {
  return new AILeadScoringService(getAnthropicClient(), getCache());
}

/** Get the raw Anthropic client (for operations not covered by the services). */
export function getAnthropicClientOrNull(): AnthropicClient | null {
  return getAnthropicClient();
}

/** Reset singletons — for testing only. */
export function _resetAIServicesForTesting(): void {
  _cache = null;
  _anthropicClient = null;
  _userRateLimits.clear();
}
