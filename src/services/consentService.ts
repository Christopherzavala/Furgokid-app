/**
 * ConsentService - Sistema de Gestión de Consentimiento (GDPR/COPPA/CCPA)
 *
 * Maneja:
 * - Consentimiento de privacidad
 * - Preferencias de anuncios personalizados
 * - Tracking opt-in/opt-out
 * - Derecho a eliminación de datos
 * - Registro de consentimientos para compliance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import analyticsService from './analyticsService';

const CONSENT_KEY = '@furgokid_consent';
const CONSENT_HISTORY_KEY = '@furgokid_consent_history';

export interface ConsentPreferences {
  // Core consents
  privacyPolicyAccepted: boolean;
  termsOfServiceAccepted: boolean;

  // Data collection
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;

  // Advertising
  personalizedAdsEnabled: boolean;
  thirdPartyAdsEnabled: boolean;

  // Location
  locationTrackingEnabled: boolean;
  backgroundLocationEnabled: boolean;

  // Communications
  pushNotificationsEnabled: boolean;
  emailMarketingEnabled: boolean;

  // Timestamps
  consentVersion: string;
  acceptedAt: number | null;
  lastUpdatedAt: number;
}

export interface ConsentHistoryEntry {
  timestamp: number;
  action: 'accept' | 'reject' | 'update' | 'withdraw';
  preferences: Partial<ConsentPreferences>;
  consentVersion: string;
}

const CURRENT_CONSENT_VERSION = '1.0.0';

const DEFAULT_CONSENT: ConsentPreferences = {
  privacyPolicyAccepted: false,
  termsOfServiceAccepted: false,
  analyticsEnabled: false,
  crashReportingEnabled: true,
  personalizedAdsEnabled: false,
  thirdPartyAdsEnabled: false,
  locationTrackingEnabled: false,
  backgroundLocationEnabled: false,
  pushNotificationsEnabled: false,
  emailMarketingEnabled: false,
  consentVersion: CURRENT_CONSENT_VERSION,
  acceptedAt: null,
  lastUpdatedAt: Date.now(),
};

class ConsentService {
  private preferences: ConsentPreferences = { ...DEFAULT_CONSENT };
  private history: ConsentHistoryEntry[] = [];
  private initialized = false;

  async initialize(): Promise<ConsentPreferences> {
    if (this.initialized) return this.preferences;

    try {
      const stored = await AsyncStorage.getItem(CONSENT_KEY);
      if (stored) {
        this.preferences = { ...DEFAULT_CONSENT, ...JSON.parse(stored) };

        // Check if consent version changed (requires re-consent)
        if (this.preferences.consentVersion !== CURRENT_CONSENT_VERSION) {
          console.log('[Consent] Version changed, re-consent required');
          // Keep existing preferences but mark as needing re-consent
          this.preferences.consentVersion = CURRENT_CONSENT_VERSION;
          this.preferences.privacyPolicyAccepted = false;
          this.preferences.termsOfServiceAccepted = false;
        }
      }

      const historyStored = await AsyncStorage.getItem(CONSENT_HISTORY_KEY);
      if (historyStored) {
        this.history = JSON.parse(historyStored);
      }

      this.initialized = true;
      console.log('[Consent] Initialized');
      return this.preferences;
    } catch (error) {
      console.warn('[Consent] Init error:', error);
      this.initialized = true;
      return this.preferences;
    }
  }

  private async savePreferences(): Promise<void> {
    try {
      this.preferences.lastUpdatedAt = Date.now();
      await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(this.preferences));
    } catch {
      // Silently fail
    }
  }

  private async addHistoryEntry(
    action: ConsentHistoryEntry['action'],
    changes: Partial<ConsentPreferences>
  ): Promise<void> {
    const entry: ConsentHistoryEntry = {
      timestamp: Date.now(),
      action,
      preferences: changes,
      consentVersion: CURRENT_CONSENT_VERSION,
    };

    this.history.push(entry);

    // Keep last 100 entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    try {
      await AsyncStorage.setItem(CONSENT_HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      // Silently fail
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONSENT STATUS
  // ═══════════════════════════════════════════════════════════════

  getPreferences(): ConsentPreferences {
    return { ...this.preferences };
  }

  hasAcceptedRequired(): boolean {
    return this.preferences.privacyPolicyAccepted && this.preferences.termsOfServiceAccepted;
  }

  needsConsentPrompt(): boolean {
    return !this.hasAcceptedRequired();
  }

  canShowPersonalizedAds(): boolean {
    return this.preferences.personalizedAdsEnabled && this.preferences.privacyPolicyAccepted;
  }

  canTrackAnalytics(): boolean {
    return this.preferences.analyticsEnabled && this.preferences.privacyPolicyAccepted;
  }

  canTrackLocation(): boolean {
    return this.preferences.locationTrackingEnabled && this.preferences.privacyPolicyAccepted;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONSENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async acceptAll(): Promise<void> {
    const changes: Partial<ConsentPreferences> = {
      privacyPolicyAccepted: true,
      termsOfServiceAccepted: true,
      analyticsEnabled: true,
      crashReportingEnabled: true,
      personalizedAdsEnabled: true,
      thirdPartyAdsEnabled: true,
      locationTrackingEnabled: true,
      backgroundLocationEnabled: true,
      pushNotificationsEnabled: true,
      emailMarketingEnabled: true,
      acceptedAt: Date.now(),
    };

    this.preferences = { ...this.preferences, ...changes };
    await this.savePreferences();
    await this.addHistoryEntry('accept', changes);

    analyticsService.trackCustomEvent('consent_accepted', { type: 'all' });
    console.log('[Consent] All accepted');
  }

  async acceptRequired(): Promise<void> {
    const changes: Partial<ConsentPreferences> = {
      privacyPolicyAccepted: true,
      termsOfServiceAccepted: true,
      analyticsEnabled: false,
      crashReportingEnabled: true,
      personalizedAdsEnabled: false,
      thirdPartyAdsEnabled: false,
      locationTrackingEnabled: false,
      backgroundLocationEnabled: false,
      pushNotificationsEnabled: false,
      emailMarketingEnabled: false,
      acceptedAt: Date.now(),
    };

    this.preferences = { ...this.preferences, ...changes };
    await this.savePreferences();
    await this.addHistoryEntry('accept', changes);

    analyticsService.trackCustomEvent('consent_accepted', { type: 'required_only' });
    console.log('[Consent] Required only accepted');
  }

  async updatePreference(
    key: keyof Omit<ConsentPreferences, 'consentVersion' | 'acceptedAt' | 'lastUpdatedAt'>,
    value: boolean
  ): Promise<void> {
    const changes = { [key]: value } as Partial<ConsentPreferences>;
    this.preferences = { ...this.preferences, ...changes };
    await this.savePreferences();
    await this.addHistoryEntry('update', changes);

    console.log(`[Consent] ${key} = ${value}`);
  }

  async withdrawConsent(): Promise<void> {
    const oldPrefs = { ...this.preferences };

    this.preferences = {
      ...DEFAULT_CONSENT,
      lastUpdatedAt: Date.now(),
    };

    await this.savePreferences();
    await this.addHistoryEntry('withdraw', oldPrefs);

    analyticsService.trackCustomEvent('consent_withdrawn', {});
    console.log('[Consent] All consent withdrawn');
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA RIGHTS (GDPR Article 17)
  // ═══════════════════════════════════════════════════════════════

  async requestDataDeletion(): Promise<{ success: boolean; message: string }> {
    try {
      // Clear all local data
      const keysToDelete = [
        CONSENT_KEY,
        CONSENT_HISTORY_KEY,
        '@furgokid_analytics_queue',
        '@furgokid_analytics_user',
        '@furgokid_premium_status',
        '@furgokid_premium_trial',
      ];

      await AsyncStorage.multiRemove(keysToDelete);

      // Reset in-memory state
      this.preferences = { ...DEFAULT_CONSENT };
      this.history = [];

      analyticsService.clearAnalytics?.();

      console.log('[Consent] Data deletion completed');

      return {
        success: true,
        message:
          'Tus datos locales han sido eliminados. Para eliminar datos del servidor, contacta a support@furgokid.com',
      };
    } catch (error) {
      console.error('[Consent] Data deletion error:', error);
      return {
        success: false,
        message: 'Error al eliminar datos. Intenta de nuevo.',
      };
    }
  }

  async exportUserData(): Promise<{
    preferences: ConsentPreferences;
    history: ConsentHistoryEntry[];
    exportedAt: number;
  }> {
    return {
      preferences: { ...this.preferences },
      history: [...this.history],
      exportedAt: Date.now(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMOB CONSENT (UMP)
  // ═══════════════════════════════════════════════════════════════

  getAdMobConsentStatus(): 'PERSONALIZED' | 'NON_PERSONALIZED' | 'UNKNOWN' {
    if (!this.hasAcceptedRequired()) {
      return 'UNKNOWN';
    }
    return this.preferences.personalizedAdsEnabled ? 'PERSONALIZED' : 'NON_PERSONALIZED';
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════════

  getConsentHistory(): ConsentHistoryEntry[] {
    return [...this.history];
  }
}

export default new ConsentService();
