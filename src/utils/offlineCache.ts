/**
 * Offline Cache Manager
 * Manages offline data persistence using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt?: number;
}

const CACHE_PREFIX = '@furgokid_cache_';
const DEFAULT_TTL = 1000 * 60 * 60; // 1 hour

export class OfflineCache {
  /**
   * Store data in cache with optional TTL
   */
  static async set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL): Promise<void> {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : undefined,
    };

    try {
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.error(`[OfflineCache] Error saving ${key}:`, error);
    }
  }

  /**
   * Retrieve data from cache
   * Returns null if expired or not found
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!value) return null;

      const cacheItem: CacheItem<T> = JSON.parse(value);

      // Check expiration
      if (cacheItem.expiresAt && Date.now() > cacheItem.expiresAt) {
        await this.remove(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error(`[OfflineCache] Error reading ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove item from cache
   */
  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error(`[OfflineCache] Error removing ${key}:`, error);
    }
  }

  /**
   * Clear all cached data
   */
  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('[OfflineCache] Error clearing cache:', error);
    }
  }

  /**
   * Get cache age in milliseconds
   */
  static async getAge(key: string): Promise<number | null> {
    try {
      const value = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!value) return null;

      const cacheItem: CacheItem<any> = JSON.parse(value);
      return Date.now() - cacheItem.timestamp;
    } catch {
      return null;
    }
  }
}

/**
 * Offline-first data fetcher
 * Returns cached data immediately, then fetches fresh data
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    staleWhileRevalidate?: boolean;
  } = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL, staleWhileRevalidate = true } = options;

  // Try to get cached data first
  const cached = await OfflineCache.get<T>(key);

  if (staleWhileRevalidate && cached) {
    // Return cached data immediately
    // Fetch fresh data in background
    fetcher()
      .then((fresh) => OfflineCache.set(key, fresh, ttl))
      .catch((error) =>
        console.error(`[fetchWithCache] Background refresh failed for ${key}:`, error)
      );
    return cached;
  }

  // No cache or not using stale-while-revalidate
  try {
    const fresh = await fetcher();
    await OfflineCache.set(key, fresh, ttl);
    return fresh;
  } catch (error) {
    // If fetch fails, return cached data if available
    if (cached) {
      console.warn(`[fetchWithCache] Using stale cache for ${key} due to fetch error`);
      return cached;
    }
    throw error;
  }
}
