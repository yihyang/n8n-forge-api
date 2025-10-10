import { CacheEntry } from '../types';

/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 3600000) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Set a cache entry
   */
  set(key: string, value: T, ttl?: number): void {
    this.store.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Get a cache entry
   */
  get(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}
