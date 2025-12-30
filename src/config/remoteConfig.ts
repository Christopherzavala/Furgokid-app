/**
 * Remote Config / Feature Flags
 * Centralized configuration for toggles and feature flags
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

interface FeatureFlags {
  // Analytics
  firebaseAnalyticsEnabled: boolean;

  // Error tracking
  sentryEnabled: boolean;
  sentrySampleRate: number;

  // Features
  premiumFeaturesEnabled: boolean;
  adsEnabled: boolean;

  // Performance
  performanceMonitoringEnabled: boolean;

  // Remote updates
  forceUpdateRequired: boolean;
  minimumVersion: string;
}

const DEFAULT_FLAGS: FeatureFlags = {
  firebaseAnalyticsEnabled: false, // Off by default, enable post SDK 55
  sentryEnabled: false,
  sentrySampleRate: 1.0,
  premiumFeaturesEnabled: true,
  adsEnabled: true,
  performanceMonitoringEnabled: true,
  forceUpdateRequired: false,
  minimumVersion: '1.0.0',
};

class RemoteConfigService {
  private flags: FeatureFlags = DEFAULT_FLAGS;
  private initialized = false;
  private readonly STORAGE_KEY = '@furgokid_feature_flags';

  /**
   * Initialize remote config
   * In production, this would fetch from Firebase Remote Config
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load from environment variables (EAS)
      const envFlags = this.getEnvironmentFlags();

      // Load cached flags from storage
      const cachedFlags = await this.loadCachedFlags();

      // Merge: env > cached > defaults
      this.flags = {
        ...DEFAULT_FLAGS,
        ...cachedFlags,
        ...envFlags,
      };

      // In production, fetch from remote (Firebase Remote Config)
      if (this.isProduction()) {
        await this.fetchRemoteFlags();
      }

      this.initialized = true;
      console.log('[RemoteConfig] Initialized:', this.flags);
    } catch (error) {
      console.error('[RemoteConfig] Init error:', error);
      this.flags = DEFAULT_FLAGS;
    }
  }

  /**
   * Get flags from environment variables
   */
  private getEnvironmentFlags(): Partial<FeatureFlags> {
    const extra = Constants.expoConfig?.extra || {};

    return {
      firebaseAnalyticsEnabled: extra.FIREBASE_ANALYTICS_ENABLED === 'true',
      sentryEnabled: extra.SENTRY_ENABLED === 'true',
    };
  }

  /**
   * Load cached flags from AsyncStorage
   */
  private async loadCachedFlags(): Promise<Partial<FeatureFlags>> {
    try {
      const cached = await AsyncStorage.getItem(this.STORAGE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('[RemoteConfig] Cache load error:', error);
      return {};
    }
  }

  /**
   * Fetch flags from remote (Firebase Remote Config)
   * TODO: Implement when Firebase Analytics is enabled (SDK 55+)
   */
  private async fetchRemoteFlags(): Promise<void> {
    try {
      // Placeholder for Firebase Remote Config
      // const remoteConfig = firebase.remoteConfig();
      // await remoteConfig.fetchAndActivate();
      // const flags = remoteConfig.getAll();

      // For now, just cache current flags
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.flags));
    } catch (error) {
      console.warn('[RemoteConfig] Fetch error:', error);
    }
  }

  /**
   * Get a feature flag value
   */
  getFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
    if (!this.initialized) {
      console.warn('[RemoteConfig] Not initialized, using default for:', key);
      return DEFAULT_FLAGS[key];
    }
    return this.flags[key];
  }

  /**
   * Check if Firebase Analytics should be enabled
   */
  isFirebaseAnalyticsEnabled(): boolean {
    return this.getFlag('firebaseAnalyticsEnabled');
  }

  /**
   * Check if Sentry should be enabled
   */
  isSentryEnabled(): boolean {
    return this.getFlag('sentryEnabled');
  }

  /**
   * Get Sentry sample rate
   */
  getSentrySampleRate(): number {
    return this.getFlag('sentrySampleRate');
  }

  /**
   * Check if premium features are enabled
   */
  isPremiumEnabled(): boolean {
    return this.getFlag('premiumFeaturesEnabled');
  }

  /**
   * Check if ads are enabled
   */
  isAdsEnabled(): boolean {
    return this.getFlag('adsEnabled');
  }

  /**
   * Check if performance monitoring is enabled
   */
  isPerformanceMonitoringEnabled(): boolean {
    return this.getFlag('performanceMonitoringEnabled');
  }

  /**
   * Check if force update is required
   */
  isForceUpdateRequired(): boolean {
    return this.getFlag('forceUpdateRequired');
  }

  /**
   * Get minimum required version
   */
  getMinimumVersion(): string {
    return this.getFlag('minimumVersion');
  }

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    const appVariant = Constants.expoConfig?.extra?.APP_VARIANT || 'development';
    return appVariant === 'production';
  }

  /**
   * Manually set a flag (for testing)
   */
  async setFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): Promise<void> {
    this.flags[key] = value;
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.flags));
    console.log(`[RemoteConfig] Flag updated: ${key} = ${value}`);
  }

  /**
   * Reset all flags to defaults
   */
  async resetFlags(): Promise<void> {
    this.flags = DEFAULT_FLAGS;
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    console.log('[RemoteConfig] Flags reset to defaults');
  }
}

// Export singleton instance
export const remoteConfig = new RemoteConfigService();

export default remoteConfig;
