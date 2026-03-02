import type { AITokenUsage } from '@realflow/shared';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tokenUsage: AITokenUsage;
  createdAt: number;
}

export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  totalTokensSaved: { input: number; output: number };
  totalCostSavedAud: number;
}

/**
 * In-memory cache for AI responses with TTL and LRU eviction.
 * Tracks token savings for cost monitoring.
 *
 * For v1, an in-memory Map is appropriate. When scaling to multiple
 * API server instances, swap this for a Redis-backed implementation.
 */
export class AICache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;
  private maxEntries: number;
  private hits = 0;
  private misses = 0;
  private tokensSaved = { input: 0, output: 0 };
  private costSavedAud = 0;

  constructor(options?: { defaultTtlMs?: number; maxEntries?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 24 * 60 * 60 * 1000; // 24 hours
    this.maxEntries = options?.maxEntries ?? 10_000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    this.tokensSaved.input += entry.tokenUsage.inputTokens;
    this.tokensSaved.output += entry.tokenUsage.outputTokens;
    this.costSavedAud += entry.tokenUsage.estimatedCostAud;

    return entry.value as T;
  }

  set<T>(key: string, value: T, tokenUsage: AITokenUsage, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      tokenUsage,
      createdAt: Date.now(),
    });
  }

  generateKey(operation: string, ...inputs: string[]): string {
    const content = [operation, ...inputs].join('|');
    // Simple hash — sufficient for cache keys
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return `${operation}:${hash.toString(36)}`;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.tokensSaved = { input: 0, output: 0 };
    this.costSavedAud = 0;
  }

  getStats(): CacheStats {
    return {
      entries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      totalTokensSaved: { ...this.tokensSaved },
      totalCostSavedAud: this.costSavedAud,
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
