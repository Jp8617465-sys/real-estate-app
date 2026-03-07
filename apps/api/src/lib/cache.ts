/**
 * Redis Cache Layer
 *
 * Typed Redis client wrapper with namespaced keys, TTL support,
 * and graceful fallback when Redis is unavailable.
 *
 * Usage:
 *   import { cache } from './cache';
 *   await cache.get<Contact>('contacts', contactId);
 *   await cache.set('contacts', contactId, data, 30);
 *   await cache.del('contacts', contactId);
 */

import { createClient, type RedisClientType } from 'redis';

// ─── Configuration ──────────────────────────────────────────────────────────────

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const KEY_PREFIX = 'realflow';

/** Default TTLs (in seconds) per entity type */
export const DEFAULT_TTL: Record<string, number> = {
  contacts: 30,
  pipeline: 15,
  properties: 30,
  'market-data': 3600,
  'dashboard-stats': 60,
  analytics: 60,
  settings: 300,
  workflows: 60,
};

// ─── Types ──────────────────────────────────────────────────────────────────────

export type CacheNamespace = keyof typeof DEFAULT_TTL | (string & Record<never, never>);

interface CacheOptions {
  /** TTL in seconds. Falls back to namespace default, then 60s. */
  ttl?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
}

// ─── Cache Client ───────────────────────────────────────────────────────────────

class CacheClient {
  private client: RedisClientType | null = null;
  private connected = false;
  private connecting = false;
  private stats: CacheStats = { hits: 0, misses: 0, errors: 0 };

  /**
   * Build a namespaced cache key.
   * Format: realflow:{namespace}:{id}
   */
  buildKey(namespace: CacheNamespace, id: string): string {
    return `${KEY_PREFIX}:${namespace}:${id}`;
  }

  /**
   * Build a namespaced pattern for scanning keys.
   * Format: realflow:{namespace}:*
   */
  buildPattern(namespace: CacheNamespace): string {
    return `${KEY_PREFIX}:${namespace}:*`;
  }

  /**
   * Connect to Redis. Safe to call multiple times — will only connect once.
   * Returns false if connection fails (graceful degradation).
   */
  async connect(): Promise<boolean> {
    if (this.connected) return true;
    if (this.connecting) return false;

    this.connecting = true;

    try {
      this.client = createClient({ url: REDIS_URL });

      this.client.on('error', (err: Error) => {
        console.warn('[Cache] Redis client error:', err.message);
        this.connected = false;
      });

      this.client.on('reconnecting', () => {
        console.info('[Cache] Reconnecting to Redis...');
      });

      await this.client.connect();
      this.connected = true;
      console.info('[Cache] Connected to Redis');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Cache] Redis unavailable — continuing without cache: ${message}`);
      this.client = null;
      this.connected = false;
      return false;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Disconnect from Redis. Call on shutdown.
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      this.client = null;
    }
  }

  /**
   * Get a cached value by namespace and id.
   * Returns null on cache miss or when Redis is unavailable.
   */
  async get<T>(namespace: CacheNamespace, id: string): Promise<T | null> {
    if (!this.connected || !this.client) {
      this.stats.misses++;
      return null;
    }

    try {
      const key = this.buildKey(namespace, id);
      const raw = await this.client.get(key);

      if (raw === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.stats.errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Cache] GET error for ${namespace}:${id}: ${message}`);
      return null;
    }
  }

  /**
   * Set a cached value with an optional TTL.
   * Falls back to the namespace default TTL, then 60 seconds.
   * Silently fails when Redis is unavailable.
   */
  async set<T>(
    namespace: CacheNamespace,
    id: string,
    value: T,
    options?: CacheOptions,
  ): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      const key = this.buildKey(namespace, id);
      const ttl = options?.ttl ?? DEFAULT_TTL[namespace] ?? 60;
      const serialized = JSON.stringify(value);

      await this.client.setEx(key, ttl, serialized);
    } catch (err) {
      this.stats.errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Cache] SET error for ${namespace}:${id}: ${message}`);
    }
  }

  /**
   * Delete a specific cached key.
   */
  async del(namespace: CacheNamespace, id: string): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      const key = this.buildKey(namespace, id);
      await this.client.del(key);
    } catch (err) {
      this.stats.errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Cache] DEL error for ${namespace}:${id}: ${message}`);
    }
  }

  /**
   * Invalidate all cached keys for a given namespace.
   * Uses SCAN to avoid blocking Redis on large keysets.
   */
  async invalidateNamespace(namespace: CacheNamespace): Promise<number> {
    if (!this.connected || !this.client) return 0;

    try {
      const pattern = this.buildPattern(namespace);
      let deletedCount = 0;
      let cursor = 0;

      do {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });

        cursor = result.cursor;

        if (result.keys.length > 0) {
          await this.client.del(result.keys);
          deletedCount += result.keys.length;
        }
      } while (cursor !== 0);

      return deletedCount;
    } catch (err) {
      this.stats.errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Cache] Namespace invalidation error for ${namespace}: ${message}`);
      return 0;
    }
  }

  /**
   * Invalidate a cached key only if it exists, and return whether it existed.
   * Useful for conditional invalidation logic.
   */
  async invalidateIfExists(namespace: CacheNamespace, id: string): Promise<boolean> {
    if (!this.connected || !this.client) return false;

    try {
      const key = this.buildKey(namespace, id);
      const count = await this.client.del(key);
      return count > 0;
    } catch (err) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache statistics for monitoring.
   */
  getStats(): CacheStats & { connected: boolean } {
    return {
      ...this.stats,
      connected: this.connected,
    };
  }

  /**
   * Check whether the cache is connected and operational.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, errors: 0 };
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────────

export const cache = new CacheClient();
