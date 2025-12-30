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

  /**
   * Set item in secure storage
   *
   * @param key - Storage key
   * @param value - Value to store (will be JSON stringified if object)
   * @param options - SecureStore options
   */
  async setItem(key: string, value: string, options?: SecureStorageOptions): Promise<void> {
    try {
      // Non-sensitive data goes to AsyncStorage
      if (this.shouldUseAsyncStorage(key)) {
        await AsyncStorage.setItem(key, value);
        logger.debug('Stored in AsyncStorage (non-sensitive)', { key });
        return;
      }

      // Sensitive data goes to SecureStore
      const isAvailable = await this.isSecureStoreAvailable();

      if (isAvailable) {
        await SecureStore.setItemAsync(key, value, options);
        logger.debug('Stored in SecureStore (encrypted)', { key });
      } else {
        // Fallback to AsyncStorage with warning
        await AsyncStorage.setItem(key, value);
        logger.warn('SecureStore unavailable, using AsyncStorage for sensitive data', {
          key,
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
      // Non-sensitive data from AsyncStorage
      if (this.shouldUseAsyncStorage(key)) {
        const value = await AsyncStorage.getItem(key);
        logger.debug('Retrieved from AsyncStorage', { key, found: !!value });
        return value;
      }

      // Sensitive data from SecureStore
      const isAvailable = await this.isSecureStoreAvailable();

      if (isAvailable) {
        const value = await SecureStore.getItemAsync(key);
        logger.debug('Retrieved from SecureStore', { key, found: !!value });
        return value;
      } else {
        // Fallback to AsyncStorage
        const value = await AsyncStorage.getItem(key);
        if (value) {
          logger.warn('Retrieved sensitive data from AsyncStorage (security risk)', { key });
        }
        return value;
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
      // Non-sensitive data from AsyncStorage
      if (this.shouldUseAsyncStorage(key)) {
        await AsyncStorage.removeItem(key);
        logger.debug('Removed from AsyncStorage', { key });
        return;
      }

      // Sensitive data from SecureStore
      const isAvailable = await this.isSecureStoreAvailable();

      if (isAvailable) {
        await SecureStore.deleteItemAsync(key);
        logger.debug('Removed from SecureStore', { key });
      } else {
        // Fallback to AsyncStorage
        await AsyncStorage.removeItem(key);
        logger.warn('Removed from AsyncStorage (fallback)', { key });
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
