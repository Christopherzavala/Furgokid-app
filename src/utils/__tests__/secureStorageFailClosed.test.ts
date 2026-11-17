import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import secureStorage from '../secureStorage';

describe('secureStorage Fail-Closed Security Policy & Migration Tests', () => {
  let asyncStorageMap: Map<string, string>;
  let secureStoreMap: Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    asyncStorageMap = new Map();
    secureStoreMap = new Map();

    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      async (key: string, value: string) => {
        secureStoreMap.set(key, value);
      }
    );

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === '__secure_store_test__') return 'test';
      return secureStoreMap.get(key) || null;
    });

    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      secureStoreMap.delete(key);
    });

    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      return asyncStorageMap.get(key) || null;
    });

    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
      asyncStorageMap.set(key, value);
    });

    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
      asyncStorageMap.delete(key);
    });
  });

  describe('Non-Sensitive Whitelisted Data', () => {
    it('stores non-sensitive whitelisted keys in AsyncStorage', async () => {
      await secureStorage.setItem('notifications_enabled', 'true');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('notifications_enabled', 'true');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        'notifications_enabled',
        expect.anything()
      );
    });

    it('retrieves non-sensitive whitelisted keys from AsyncStorage', async () => {
      asyncStorageMap.set('app_theme', 'dark');
      const val = await secureStorage.getItem('app_theme');
      expect(val).toBe('dark');
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('app_theme');
    });
  });

  describe('Sensitive Data Fail-Closed Policy', () => {
    it('stores sensitive keys in SecureStore when available', async () => {
      await secureStorage.setItem(
        'passenger_authorization_pending_v1.uid1.req1',
        '{"requestId":"req1"}'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'passenger_authorization_pending_v1.uid1.req1',
        '{"requestId":"req1"}',
        undefined
      );
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('BLOCKS sensitive writes when SecureStore is unavailable (Fail-Closed)', async () => {
      // Simulate SecureStore probe failure
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('SecureStore unavailable')
      );

      await expect(
        secureStorage.setItem(
          'passenger_authorization_pending_v1.uid1.req1',
          '{"requestId":"req1"}'
        )
      ).rejects.toThrow(/SECURE_STORAGE_UNAVAILABLE/i);

      // Verify ZERO write to unencrypted AsyncStorage
      expect(asyncStorageMap.has('passenger_authorization_pending_v1.uid1.req1')).toBe(false);
    });

    it('BLOCKS sensitive reads when SecureStore is unavailable (Fail-Closed)', async () => {
      // Simulate SecureStore probe failure
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('SecureStore unavailable')
      );
      asyncStorageMap.set('parental_consent', 'unencrypted_secret');

      const result = await secureStorage.getItem('parental_consent');

      // Returns null and does NOT return unencrypted AsyncStorage data
      expect(result).toBeNull();
    });
  });

  describe('Historical Migration Path', () => {
    it('safely migrates historical AsyncStorage sensitive key to SecureStore after verifying read-back', async () => {
      // Historical value in AsyncStorage
      asyncStorageMap.set('parental_consent', 'historical_consent');

      const result = await secureStorage.getItem('parental_consent');

      expect(result).toBe('historical_consent');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'parental_consent',
        'historical_consent'
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('parental_consent');
      expect(asyncStorageMap.has('parental_consent')).toBe(false);
    });

    it('does NOT delete historical AsyncStorage key if SecureStore migration verification fails', async () => {
      let setCalls = 0;
      (SecureStore.setItemAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          if (key === 'parental_consent') {
            setCalls++;
          }
        }
      );

      (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === '__secure_store_test__') return 'test';
        if (key === 'parental_consent') {
          if (setCalls > 0) return 'different_mismatched_val'; // Failed verification
        }
        return null;
      });

      asyncStorageMap.set('parental_consent', 'historical_consent');

      const result = await secureStorage.getItem('parental_consent');

      expect(result).toBeNull();
      // AsyncStorage origin document is NOT deleted
      expect(asyncStorageMap.get('parental_consent')).toBe('historical_consent');
    });
  });
});
