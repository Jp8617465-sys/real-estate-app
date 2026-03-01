import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AICache } from './cache';
import type { AITokenUsage } from '@realflow/shared';

const mockTokenUsage: AITokenUsage = {
  inputTokens: 100,
  outputTokens: 50,
  model: 'claude-sonnet-4-20250514',
  estimatedCostAud: 0.001,
};

describe('AICache', () => {
  let cache: AICache;

  beforeEach(() => {
    cache = new AICache({ defaultTtlMs: 1000, maxEntries: 5 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Get / Set ─────────────────────────────────────────────────

  it('returns null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('returns value after set', () => {
    cache.set('key1', { score: 80 }, mockTokenUsage);
    expect(cache.get('key1')).toEqual({ score: 80 });
  });

  it('stores and retrieves complex objects', () => {
    const value = { features: ['pool', 'garage'], score: 75, nested: { a: 1 } };
    cache.set('key2', value, mockTokenUsage);
    expect(cache.get('key2')).toEqual(value);
  });

  // ─── TTL Expiry ────────────────────────────────────────────────

  it('returns null after TTL expires', () => {
    cache.set('expiring', 'value', mockTokenUsage, 500);
    expect(cache.get('expiring')).toBe('value');

    vi.advanceTimersByTime(600);
    expect(cache.get('expiring')).toBeNull();
  });

  it('uses defaultTtlMs when no ttl provided', () => {
    cache.set('default-ttl', 'value', mockTokenUsage);
    vi.advanceTimersByTime(999);
    expect(cache.get('default-ttl')).toBe('value');

    vi.advanceTimersByTime(2);
    expect(cache.get('default-ttl')).toBeNull();
  });

  // ─── LRU Eviction ──────────────────────────────────────────────

  it('evicts oldest entry when at maxEntries capacity', () => {
    // Fill to capacity
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(10); // stagger creation times
      cache.set(`key${i}`, i, mockTokenUsage);
    }

    // Add one more — should evict key0
    cache.set('key5', 5, mockTokenUsage);

    expect(cache.get('key0')).toBeNull();  // evicted
    expect(cache.get('key5')).toBe(5);     // new entry present
  });

  // ─── Key Generation ────────────────────────────────────────────

  it('generates deterministic keys for same inputs', () => {
    const key1 = cache.generateKey('property-analysis', 'prop-1', 'brief-1');
    const key2 = cache.generateKey('property-analysis', 'prop-1', 'brief-1');
    expect(key1).toBe(key2);
  });

  it('generates different keys for different inputs', () => {
    const key1 = cache.generateKey('property-analysis', 'prop-1', 'brief-1');
    const key2 = cache.generateKey('property-analysis', 'prop-2', 'brief-1');
    expect(key1).not.toBe(key2);
  });

  it('generates different keys for different operations', () => {
    const key1 = cache.generateKey('property-analysis', 'input');
    const key2 = cache.generateKey('lead-scoring', 'input');
    expect(key1).not.toBe(key2);
  });

  it('prefixes key with operation name', () => {
    const key = cache.generateKey('my-operation', 'data');
    expect(key).toMatch(/^my-operation:/);
  });

  // ─── Stats ─────────────────────────────────────────────────────

  it('tracks hits and misses', () => {
    cache.set('tracked', 'value', mockTokenUsage);
    cache.get('tracked');       // hit
    cache.get('tracked');       // hit
    cache.get('nonexistent');   // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });

  it('tracks token savings on cache hits', () => {
    cache.set('hit-key', 'value', mockTokenUsage);
    cache.get('hit-key');
    cache.get('hit-key');

    const stats = cache.getStats();
    expect(stats.totalTokensSaved.input).toBe(200);  // 2 hits × 100
    expect(stats.totalTokensSaved.output).toBe(100); // 2 hits × 50
    expect(stats.totalCostSavedAud).toBeCloseTo(0.002, 4); // 2 hits × 0.001
  });

  it('reports correct entry count', () => {
    cache.set('a', 1, mockTokenUsage);
    cache.set('b', 2, mockTokenUsage);
    expect(cache.getStats().entries).toBe(2);
  });

  // ─── Clear ─────────────────────────────────────────────────────

  it('clears all entries and resets stats', () => {
    cache.set('a', 1, mockTokenUsage);
    cache.get('a');
    cache.clear();

    // Check stats are reset before any new get calls
    expect(cache.getStats().entries).toBe(0);
    expect(cache.getStats().hits).toBe(0);
    expect(cache.getStats().misses).toBe(0);
    // Verify the entry is gone (this get increments misses but is intentional)
    expect(cache.get('a')).toBeNull();
  });
});
