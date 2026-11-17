/**
 * Secure Storage Service
 *
 * Encrypted storage wrapper using expo-secure-store for sensitive data.
 * Falls back to AsyncStorage ONLY for non-sensitive whitelisted data.
 *
 * Senior Engineering / Privacy-by-Design Rule (Fail-Closed):
 * All sensitive data (tokens, credentials, PII, child authorizations, parental consent)
 * MUST be stored encrypted in SecureStore. If SecureStore is unavailable, sensitive writes and
 * reads FAIL CLOSED (throwing or returning null/error) without falling back to unencrypted AsyncStorage.
 *
 * @example
 * ```typescript
 * import secureStorage from '@/utils/secureStorage';
 *
 * // Store sensitive data (Fail-Closed if SecureStore unavailable)
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

const PII_STORAGE_KEYS = new Set(['parental_consent', 'passenger_authorization']);

class SecureStorage {
  /**
   * Check if SecureStore is available on the device
   */
  private async isSecureStoreAvailable(
    key = '',
    operation: 'read' | 'set' | 'remove' = 'set'
  ): Promise<boolean> {
    try {
      // Test if SecureStore works by attempting to set/get/delete a test value
      const testKey = '__secure_store_test__';
      await SecureStore.setItemAsync(testKey, 'test');
      await SecureStore.getItemAsync(testKey);
      await SecureStore.deleteItemAsync(testKey);
      return true;
    } catch (error) {
      if (this.isSensitiveKey(key)) {
        logger.privacySafeWarn(
          'SecureStore not available, sensitive operation blocked (fail-closed)',
          {
            operation: `secure_storage_${operation}`,
            stage: 'availability_check',
            code: 'SECURE_STORE_UNAVAILABLE',
          }
        );
      } else {
        logger.warn(
          'SecureStore not available, falling back to AsyncStorage for non-sensitive data',
          {
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
      }
      return false;
    }
  }

  /**
   * Check if key is non-sensitive whitelisted data (can use AsyncStorage)
   */
  private shouldUseAsyncStorage(key: string): boolean {
    return ASYNC_STORAGE_WHITELIST.some((whitelistedKey) => key.includes(whitelistedKey));
  }

  /**
   * Check if key is sensitive (MUST use SecureStore, fail-closed)
   */
  public isSensitiveKey(key: string): boolean {
    return !this.shouldUseAsyncStorage(key);
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

  private isPiiKey(key: string): boolean {
    return (
      PII_STORAGE_KEYS.has(key) ||
      key.includes('passenger_authorization') ||
      key.includes('parental_consent')
    );
  }

  private logDebugForKey(key: string, message: string, context: Record<string, unknown>): void {
    const log = this.isPiiKey(key) ? logger.privacySafeDebug : logger.debug;
    log.call(logger, message, context);
  }

  private logWarnForKey(key: string, message: string, context: Record<string, unknown>): void {
    const log = this.isPiiKey(key) ? logger.privacySafeWarn : logger.warn;
    log.call(logger, message, context);
  }

  private logErrorForKey(
    key: string,
    message: string,
    operation: 'read' | 'set' | 'remove',
    stage: string,
    code: string,
    context: Record<string, unknown>,
    error: unknown
  ): void {
    if (this.isPiiKey(key)) {
      logger.privacySafeError(message, {
        operation: `secure_storage_${operation}`,
        stage,
        code,
      });
    } else {
      logger.error(message, context, error as Error);
    }
  }

  /**
   * Set item in secure storage
   * FAIL-CLOSED: Sensitive data is NEVER written to AsyncStorage when SecureStore is unavailable.
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
        this.logDebugForKey(key, 'Stored in AsyncStorage (non-sensitive)', {
          key,
          storageKey: primary,
        });
        return;
      }

      // Sensitive data MUST go to SecureStore (Fail-Closed)
      const isAvailable = await this.isSecureStoreAvailable(key, 'set');

      if (isAvailable) {
        await SecureStore.setItemAsync(primary, value, options);
        if (legacy && this.isValidSecureStoreKey(legacy)) {
          await SecureStore.deleteItemAsync(legacy).catch(() => undefined);
        }
        this.logDebugForKey(key, 'Stored in SecureStore (encrypted)', { key, storageKey: primary });
      } else {
        // FAIL-CLOSED: Refuse to write sensitive data to unencrypted AsyncStorage
        this.logWarnForKey(
          key,
          'SecureStore unavailable, sensitive data write blocked (fail-closed)',
          {
            key,
            storageKey: primary,
            security_risk: 'prevented',
          }
        );
        const error = new Error(
          'SECURE_STORAGE_UNAVAILABLE: SecureStore is unavailable for sensitive encrypted data.'
        );
        (error as any).code = 'SECURE_STORAGE_UNAVAILABLE';
        throw error;
      }
    } catch (error) {
      this.logErrorForKey(
        key,
        'Failed to store item in secure storage',
        'set',
        'write',
        'SECURE_STORAGE_WRITE_FAILED',
        { key },
        error
      );
      throw error;
    }
  }

  /**
   * Get item from secure storage
   * FAIL-CLOSED: Sensitive data is NEVER retrieved from AsyncStorage when SecureStore is unavailable.
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
          this.logDebugForKey(key, 'Retrieved from AsyncStorage', {
            key,
            storageKey: primary,
            found: true,
          });
          return value;
        }

        if (legacy) {
          const legacyValue = await AsyncStorage.getItem(legacy);
          if (legacyValue != null) {
            await AsyncStorage.setItem(primary, legacyValue);
            await AsyncStorage.removeItem(legacy).catch(() => undefined);
            this.logDebugForKey(key, 'Retrieved from AsyncStorage (legacy key migrated)', {
              key,
              storageKey: primary,
              legacyKey: legacy,
            });
            return legacyValue;
          }
        }

        this.logDebugForKey(key, 'Retrieved from AsyncStorage', {
          key,
          storageKey: primary,
          found: false,
        });
        return null;
      }

      // Sensitive data MUST come from SecureStore (Fail-Closed)
      const isAvailable = await this.isSecureStoreAvailable(key, 'read');

      if (isAvailable) {
        const value = await SecureStore.getItemAsync(primary);
        if (value != null) {
          this.logDebugForKey(key, 'Retrieved from SecureStore', {
            key,
            storageKey: primary,
            found: true,
          });
          return value;
        }

        // Backward-compatible safe migration: if value exists in historical AsyncStorage,
        // copy to SecureStore FIRST, verify read-back, and ONLY THEN remove from AsyncStorage.
        const asyncValue = await AsyncStorage.getItem(primary);
        if (asyncValue != null) {
          try {
            await SecureStore.setItemAsync(primary, asyncValue);
            const verifiedValue = await SecureStore.getItemAsync(primary);
            if (verifiedValue === asyncValue) {
              await AsyncStorage.removeItem(primary).catch(() => undefined);
              this.logWarnForKey(
                key,
                'Safely migrated sensitive data from AsyncStorage to SecureStore',
                {
                  key,
                  storageKey: primary,
                }
              );
              return asyncValue;
            }
          } catch {
            // Migration failed: do NOT delete from origin, do NOT return unencrypted fallback as secure
            this.logWarnForKey(
              key,
              'Migration from AsyncStorage to SecureStore failed verification',
              { key }
            );
          }
        }

        if (legacy) {
          const legacyAsyncValue = await AsyncStorage.getItem(legacy);
          if (legacyAsyncValue != null) {
            try {
              await SecureStore.setItemAsync(primary, legacyAsyncValue);
              const verifiedValue = await SecureStore.getItemAsync(primary);
              if (verifiedValue === legacyAsyncValue) {
                await AsyncStorage.removeItem(legacy).catch(() => undefined);
                this.logWarnForKey(
                  key,
                  'Safely migrated sensitive data from legacy AsyncStorage key to SecureStore',
                  {
                    key,
                    storageKey: primary,
                    legacyKey: legacy,
                  }
                );
                return legacyAsyncValue;
              }
            } catch {
              this.logWarnForKey(
                key,
                'Legacy migration from AsyncStorage to SecureStore failed verification',
                { key }
              );
            }
          }

          if (this.isValidSecureStoreKey(legacy)) {
            const legacySecureValue = await SecureStore.getItemAsync(legacy);
            if (legacySecureValue != null) {
              await SecureStore.setItemAsync(primary, legacySecureValue).catch(() => undefined);
              await SecureStore.deleteItemAsync(legacy).catch(() => undefined);
              this.logWarnForKey(key, 'Migrated sensitive data from legacy SecureStore key', {
                key,
                storageKey: primary,
                legacyKey: legacy,
              });
              return legacySecureValue;
            }
          }
        }

        this.logDebugForKey(key, 'Retrieved from SecureStore', {
          key,
          storageKey: primary,
          found: false,
        });
        return null;
      } else {
        // FAIL-CLOSED: SecureStore unavailable $\rightarrow$ refuse to return unencrypted data from AsyncStorage
        this.logWarnForKey(key, 'SecureStore unavailable, sensitive read blocked (fail-closed)', {
          key,
          storageKey: primary,
        });
        return null;
      }
    } catch (error) {
      this.logErrorForKey(
        key,
        'Failed to retrieve item from secure storage',
        'read',
        'read',
        'SECURE_STORAGE_READ_FAILED',
        { key },
        error
      );
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
        this.logDebugForKey(key, 'Removed from AsyncStorage', { key, storageKey: primary });
        return;
      }

      // Sensitive data from SecureStore
      const isAvailable = await this.isSecureStoreAvailable(key, 'remove');

      if (isAvailable) {
        await SecureStore.deleteItemAsync(primary);
        if (legacy && this.isValidSecureStoreKey(legacy)) {
          await SecureStore.deleteItemAsync(legacy).catch(() => undefined);
        }
        await AsyncStorage.removeItem(primary).catch(() => undefined);
        if (legacy) {
          await AsyncStorage.removeItem(legacy).catch(() => undefined);
        }
        this.logDebugForKey(key, 'Removed from SecureStore', { key, storageKey: primary });
      } else {
        // Fail-closed remove: if SecureStore unavailable, attempt cleanup on AsyncStorage without exposing data
        await AsyncStorage.removeItem(primary).catch(() => undefined);
        if (legacy) {
          await AsyncStorage.removeItem(legacy).catch(() => undefined);
        }
        this.logWarnForKey(
          key,
          'SecureStore unavailable, removed fallback copy from AsyncStorage',
          { key, storageKey: primary }
        );
      }
    } catch (error) {
      this.logErrorForKey(
        key,
        'Failed to remove item from secure storage',
        'remove',
        'delete',
        'SECURE_STORAGE_REMOVE_FAILED',
        { key },
        error
      );
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
      this.logErrorForKey(
        key,
        'Failed to parse JSON from secure storage',
        'read',
        'deserialize',
        'SECURE_STORAGE_DESERIALIZE_FAILED',
        { key },
        error
      );
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
        if (this.shouldUseAsyncStorage(key)) {
          logger.debug('Skipping whitelisted key', { key });
          continue;
        }

        const value = await AsyncStorage.getItem(key);
        if (!value) {
          logger.debug('Key not found in AsyncStorage', { key });
          continue;
        }

        // Store in SecureStore
        await this.setItem(key, value);

        // Verify and remove from AsyncStorage
        const verified = await this.getItem(key);
        if (verified === value) {
          await AsyncStorage.removeItem(key);
          migrated++;
          logger.debug('Migrated key successfully', { key });
        } else {
          failed++;
          logger.warn('Migration verification failed', { key });
        }
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
