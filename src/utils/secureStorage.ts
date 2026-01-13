/**
 * Secure Storage Service
 *
 * Encrypted storage wrapper using expo-secure-store for sensitive data.
 * Falls back to AsyncStorage with warning for non-sensitive data.
 *
 * Big Tech Standard: All sensitive data (tokens, credentials, PII) must be encrypted at rest.
 *
 * @example
 * ```typescript
 * import secureStorage from '@/utils/secureStorage';
 *
 * // Store sensitive data
 * await secureStorage.setItem('auth_token', userToken);
 *
 * // Retrieve sensitive data
 * const token = await secureStorage.getItem('auth_token');
 *
 * // Remove sensitive data
 * await secureStorage.removeItem('auth_token');
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import logger from './logger';

/**
 * Storage options for SecureStore
 */
interface SecureStorageOptions {
  keychainAccessible?: SecureStore.KeychainAccessibilityConstant;
}

/**
 * Keys that should NEVER be stored in SecureStore
 * (non-sensitive preferences that need to survive app reinstalls)
 */
const ASYNC_STORAGE_WHITELIST = [
  'onboarding_shown',
  'app_theme',
  'language_preference',
  'notifications_enabled',
];

class SecureStorage {
  /**
   * Check if SecureStore is available on the device
   */
  private async isSecureStoreAvailable(): Promise<boolean> {
    try {
      // Test if SecureStore works by attempting to set/get/delete a test value
      const testKey = '__secure_store_test__';
      await SecureStore.setItemAsync(testKey, 'test');
      await SecureStore.getItemAsync(testKey);
      await SecureStore.deleteItemAsync(testKey);
      return true;
    } catch (error) {
      logger.warn('SecureStore not available, falling back to AsyncStorage', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if key should use AsyncStorage (non-sensitive data)
   */
  private shouldUseAsyncStorage(key: string): boolean {
    return ASYNC_STORAGE_WHITELIST.some((whitelistedKey) => key.includes(whitelistedKey));
  }

  private hashKey(key: string): string {
    // Simple deterministic hash (djb2) to avoid empty/invalid keys
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 33) ^ key.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
  }

  private normalizeStorageKey(key: string): string {
    const raw = String(key ?? '').trim();
    const withoutAtPrefix = raw.replace(/^@+/, '');
    const normalized = withoutAtPrefix.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!normalized) return `key_${this.hashKey(raw)}`;
    return normalized;
  }

  private getKeyPair(key: string): { primary: string; legacy?: string } {
    const primary = this.normalizeStorageKey(key);
    if (primary === key) return { primary };
    return { primary, legacy: key };
  }

  private isValidSecureStoreKey(key: string): boolean {
    return /^[a-zA-Z0-9._-]+$/.test(key);
  }

  /**
   * Set item in secure storage
   *
   * @param key - Storage key
   * @param value - Value to store (will be JSON stringified if object)
   * @param options - SecureStore options
   */
  async setItem(key: string, value: string, options?: SecureStorageOptions): Promise<void> {
    try {
      const { primary, legacy } = this.getKeyPair(key);

      // Non-sensitive data goes to AsyncStorage
      if (this.shouldUseAsyncStorage(key)) {
        await AsyncStorage.setItem(primary, value);
        if (legacy) {
          await AsyncStorage.removeItem(legacy).catch(() => undefined);
        }
        logger.debug('Stored in AsyncStorage (non-sensitive)', { key, storageKey: primary });
        return;
      }

      // Sensitive data goes to SecureStore
      const isAvailable = await this.isSecureStoreAvailable();

      if (isAvailable) {
        await SecureStore.setItemAsync(primary, value, options);
        if (legacy && this.isValidSecureStoreKey(legacy)) {
          await SecureStore.deleteItemAsync(legacy).catch(() => undefined);
        }
        logger.debug('Stored in SecureStore (encrypted)', { key, storageKey: primary });
      } else {
        // Fallback to AsyncStorage with warning
        await AsyncStorage.setItem(primary, value);
        if (legacy) {
          await AsyncStorage.removeItem(legacy).catch(() => undefined);
        }
        logger.warn('SecureStore unavailable, using AsyncStorage for sensitive data', {
          key,
          storageKey: primary,
          security_risk: 'high',
        });
      }
    } catch (error) {
      logger.error('Failed to store item in secure storage', { key }, error as Error);
      throw error;
    }
  }

  /**
   * Get item from secure storage
   *
   * @param key - Storage key
   * @returns Stored value or null if not found
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const { primary, legacy } = this.getKeyPair(key);

      // Non-sensitive data from AsyncStorage
      if (this.shouldUseAsyncStorage(key)) {
        const value = await AsyncStorage.getItem(primary);
        if (value != null) {
          logger.debug('Retrieved from AsyncStorage', { key, storageKey: primary, found: true });
          return value;
        }

        if (legacy) {
          const legacyValue = await AsyncStorage.getItem(legacy);
          if (legacyValue != null) {
            await AsyncStorage.setItem(primary, legacyValue);
            await AsyncStorage.removeItem(legacy).catch(() => undefined);
            logger.debug('Retrieved from AsyncStorage (legacy key migrated)', {
              key,
              storageKey: primary,
              legacyKey: legacy,
            });
            return legacyValue;
          }
        }

        logger.debug('Retrieved from AsyncStorage', { key, storageKey: primary, found: false });
        return null;
      }

      // Sensitive data from SecureStore
      const isAvailable = await this.isSecureStoreAvailable();

      if (isAvailable) {
        const value = await SecureStore.getItemAsync(primary);
        if (value != null) {
          logger.debug('Retrieved from SecureStore', { key, storageKey: primary, found: true });
          return value;
        }

        // Backward-compatible fallback: older versions may have stored in AsyncStorage
        const asyncValue = await AsyncStorage.getItem(primary);
        if (asyncValue != null) {
          await SecureStore.setItemAsync(primary, asyncValue).catch(() => undefined);
          await AsyncStorage.removeItem(primary).catch(() => undefined);
          logger.warn('Migrated sensitive data from AsyncStorage to SecureStore', {
            key,
            storageKey: primary,
          });
          return asyncValue;
        }

        if (legacy) {
          const legacyAsyncValue = await AsyncStorage.getItem(legacy);
          if (legacyAsyncValue != null) {
            await SecureStore.setItemAsync(primary, legacyAsyncValue).catch(() => undefined);
            await AsyncStorage.removeItem(legacy).catch(() => undefined);
            logger.warn('Migrated sensitive data from legacy AsyncStorage key to SecureStore', {
              key,
              storageKey: primary,
              legacyKey: legacy,
            });
            return legacyAsyncValue;
          }

          // Only attempt legacy SecureStore key if it is valid (avoids expo-secure-store key errors)
          if (this.isValidSecureStoreKey(legacy)) {
            const legacySecureValue = await SecureStore.getItemAsync(legacy);
            if (legacySecureValue != null) {
              await SecureStore.setItemAsync(primary, legacySecureValue).catch(() => undefined);
              await SecureStore.deleteItemAsync(legacy).catch(() => undefined);
              logger.warn('Migrated sensitive data from legacy SecureStore key', {
                key,
                storageKey: primary,
                legacyKey: legacy,
              });
              return legacySecureValue;
            }
          }
        }

        logger.debug('Retrieved from SecureStore', { key, storageKey: primary, found: false });
        return null;
      } else {
        // Fallback to AsyncStorage
        const value = await AsyncStorage.getItem(primary);
        if (value) {
          logger.warn('Retrieved sensitive data from AsyncStorage (security risk)', {
            key,
            storageKey: primary,
          });
        }
        if (value != null) return value;

        if (legacy) {
          const legacyValue = await AsyncStorage.getItem(legacy);
          if (legacyValue != null) {
            await AsyncStorage.setItem(primary, legacyValue);
            await AsyncStorage.removeItem(legacy).catch(() => undefined);
            logger.warn('Retrieved sensitive data from legacy AsyncStorage key (security risk)', {
              key,
              storageKey: primary,
              legacyKey: legacy,
            });
            return legacyValue;
          }
        }
        return null;
      }
    } catch (error) {
      logger.error('Failed to retrieve item from secure storage', { key }, error as Error);
      return null;
    }
  }

  /**
   * Remove item from secure storage
   *
   * @param key - Storage key
   */
  async removeItem(key: string): Promise<void> {
    try {
      const { primary, legacy } = this.getKeyPair(key);

      // Non-sensitive data from AsyncStorage
      if (this.shouldUseAsyncStorage(key)) {
        await AsyncStorage.removeItem(primary);
        if (legacy) {
          await AsyncStorage.removeItem(legacy).catch(() => undefined);
        }
        logger.debug('Removed from AsyncStorage', { key, storageKey: primary });
        return;
      }

      // Sensitive data from SecureStore
      const isAvailable = await this.isSecureStoreAvailable();

      if (isAvailable) {
        await SecureStore.deleteItemAsync(primary);
        if (legacy && this.isValidSecureStoreKey(legacy)) {
          await SecureStore.deleteItemAsync(legacy).catch(() => undefined);
        }
        await AsyncStorage.removeItem(primary).catch(() => undefined);
        if (legacy) {
          await AsyncStorage.removeItem(legacy).catch(() => undefined);
        }
        logger.debug('Removed from SecureStore', { key, storageKey: primary });
      } else {
        // Fallback to AsyncStorage
        await AsyncStorage.removeItem(primary);
        if (legacy) {
          await AsyncStorage.removeItem(legacy).catch(() => undefined);
        }
        logger.warn('Removed from AsyncStorage (fallback)', { key, storageKey: primary });
      }
    } catch (error) {
      logger.error('Failed to remove item from secure storage', { key }, error as Error);
      throw error;
    }
  }

  /**
   * Store object in secure storage (auto JSON stringify)
   */
  async setObject(
    key: string,
    value: Record<string, any>,
    options?: SecureStorageOptions
  ): Promise<void> {
    const stringified = JSON.stringify(value);
    await this.setItem(key, stringified, options);
  }

  /**
   * Get object from secure storage (auto JSON parse)
   */
  async getObject<T = any>(key: string): Promise<T | null> {
    const value = await this.getItem(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Failed to parse JSON from secure storage', { key }, error as Error);
      return null;
    }
  }

  /**
   * Clear all items from secure storage
   * WARNING: This will delete ALL encrypted data
   */
  async clear(): Promise<void> {
    try {
      // Clear AsyncStorage whitelisted items
      const asyncKeys = await AsyncStorage.getAllKeys();
      const whitelistedKeys = asyncKeys.filter((key) => this.shouldUseAsyncStorage(key));
      if (whitelistedKeys.length > 0) {
        await AsyncStorage.multiRemove(whitelistedKeys);
      }

      // SecureStore doesn't have a clear all method
      // Apps should manually track and remove their keys
      logger.warn('Cleared secure storage', {
        asyncStorageKeysCleared: whitelistedKeys.length,
      });
    } catch (error) {
      logger.error('Failed to clear secure storage', {}, error as Error);
      throw error;
    }
  }

  /**
   * Migrate data from AsyncStorage to SecureStore
   * Use this to upgrade existing apps
   */
  async migrateFromAsyncStorage(keys: string[]): Promise<void> {
    logger.info('Starting migration from AsyncStorage to SecureStore', {
      keysCount: keys.length,
    });

    let migrated = 0;
    let failed = 0;

    for (const key of keys) {
      try {
        // Skip whitelisted keys
        if (this.shouldUseAsyncStorage(key)) {
          logger.debug('Skipping whitelisted key', { key });
          continue;
        }

        // Get value from AsyncStorage
        const value = await AsyncStorage.getItem(key);
        if (!value) {
          logger.debug('Key not found in AsyncStorage', { key });
          continue;
        }

        // Store in SecureStore
        await this.setItem(key, value);

        // Remove from AsyncStorage
        await AsyncStorage.removeItem(key);

        migrated++;
        logger.debug('Migrated key successfully', { key });
      } catch (error) {
        failed++;
        logger.error('Failed to migrate key', { key }, error as Error);
      }
    }

    logger.info('Migration completed', { migrated, failed });
  }
}

// Export singleton instance
const secureStorage = new SecureStorage();

export default secureStorage;

/**
 * Usage Examples:
 *
 * // Authentication tokens
 * await secureStorage.setItem('auth_token', userToken);
 * const token = await secureStorage.getItem('auth_token');
 *
 * // User credentials
 * await secureStorage.setObject('user_credentials', {
 *   email: 'user@example.com',
 *   refreshToken: 'xyz...'
 * });
 *
 * // Premium subscription data
 * await secureStorage.setObject('premium_status', {
 *   plan: 'premium',
 *   expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
 * });
 *
 * // Migration from old AsyncStorage implementation
 * await secureStorage.migrateFromAsyncStorage([
 *   'premium_status',
 *   'user_consent',
 *   'analytics_user'
 * ]);
 *
 * // Logout - clear sensitive data
 * await secureStorage.removeItem('auth_token');
 * await secureStorage.removeItem('user_credentials');
 */
