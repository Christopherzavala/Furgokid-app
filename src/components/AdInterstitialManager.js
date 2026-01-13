/**
 * AdInterstitialManager.js
 * Manejador centralizado para anuncios intersticiales (pantalla completa)
 * Conectado a SDK real via react-native-google-mobile-ads (admobService)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AD_CONFIG,
  getAdUnitId,
  recordInterstitialShown,
  shouldShowInterstitial,
} from '../config/AdMobConfig';
import admobService from '../services/admobService';
import analyticsService from '../services/analyticsService';
import consentService from '../services/consentService';

class AdInterstitialManager {
  constructor() {
    this.isLoading = false;
    this.isShowing = false;
    this.hasLoaded = false;
    this.sessionStartTime = Date.now();
    this.dailyCountCache = null;
    this.dailyCountKey = null;
    this.lastPlacementId = null;
  }

  getDailyKey() {
    const today = new Date().toISOString().slice(0, 10);
    return `admob_interstitial_count_${today}`;
  }

  async getDailyCount() {
    const key = this.getDailyKey();
    if (this.dailyCountKey !== key) {
      this.dailyCountKey = key;
      this.dailyCountCache = null;
    }

    if (typeof this.dailyCountCache === 'number') {
      return this.dailyCountCache;
    }

    try {
      const raw = await AsyncStorage.getItem(key);
      const parsed = raw ? Number(raw) : 0;
      this.dailyCountCache = Number.isFinite(parsed) ? parsed : 0;
      return this.dailyCountCache;
    } catch {
      this.dailyCountCache = 0;
      return 0;
    }
  }

  async incrementDailyCount() {
    const key = this.getDailyKey();
    const current = await this.getDailyCount();
    const next = current + 1;
    this.dailyCountCache = next;
    this.dailyCountKey = key;
    try {
      await AsyncStorage.setItem(key, String(next));
    } catch {
      // no-op
    }
  }

  /**
   * Guardas centralizadas (UX + policies): cooldown, session-min, daily-cap, no-ads.
   */
  async canShow(placementId, userRole = 'parent', adsDisabled = false) {
    if (adsDisabled) return false;

    await consentService.initialize();
    if (consentService.needsConsentPrompt()) return false;

    const sessionOk = Date.now() - this.sessionStartTime >= AD_CONFIG.MINIMUM_SESSION_TIME;
    if (!sessionOk) return false;

    if (!shouldShowInterstitial()) return false;

    const dailyCount = await this.getDailyCount();
    if (dailyCount >= AD_CONFIG.DAILY_INTERSTITIAL_CAP) return false;

    const adUnitId = getAdUnitId(placementId, userRole);
    return Boolean(adUnitId);
  }

  /**
   * Carga un anuncio intersticial
   * @param {string} placementId - ID del placement (INTERSTITIAL_NAV, INTERSTITIAL_TRACKING, etc)
   * @param {string} userRole - Rol del usuario (driver, parent)
   * @param {boolean} adsDisabled - Para suscripción/no-ads
   */
  async loadInterstitial(placementId, userRole = 'parent', adsDisabled = false) {
    if (adsDisabled) {
      this.hasLoaded = false;
      return false;
    }

    const allowed = await this.canShow(placementId, userRole, adsDisabled);
    if (!allowed) {
      this.hasLoaded = false;
      return false;
    }

    const requestOptions = {
      requestNonPersonalizedAdsOnly: consentService.getAdMobConsentStatus() !== 'PERSONALIZED',
    };

    const adUnitId = getAdUnitId(placementId, userRole);
    this.lastPlacementId = placementId;

    try {
      this.isLoading = true;
      await admobService.initialize();

      analyticsService.trackAdLoadAttempt('interstitial', placementId);
      const ok = await admobService.loadInterstitialAd(adUnitId, requestOptions);
      this.hasLoaded = Boolean(ok);

      if (ok) {
        analyticsService.trackAdLoaded('interstitial', placementId);
      } else {
        analyticsService.trackAdLoadFailed('interstitial', placementId, 'load returned false');
      }
      return Boolean(ok);
    } catch (error) {
      console.error('Error cargando intersticial:', error);
      analyticsService.trackAdLoadFailed(
        'interstitial',
        placementId,
        String(error?.message || error)
      );
      this.hasLoaded = false;
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Muestra el intersticial
   */
  async show() {
    if (this.isShowing || this.isLoading || !this.hasLoaded) {
      return false;
    }

    try {
      this.isShowing = true;
      const placement = this.lastPlacementId || 'INTERSTITIAL_UNKNOWN';
      analyticsService.trackAdShowAttempt('interstitial', placement);
      const shown = await admobService.showInterstitialAd(placement);
      if (shown) {
        recordInterstitialShown();
        await this.incrementDailyCount();
        analyticsService.trackAdShown('interstitial', placement);
      } else {
        analyticsService.trackAdShowFailed('interstitial', placement, 'show returned false');
      }
      return Boolean(shown);
    } catch (error) {
      console.error('Error mostrando intersticial:', error);
      const placement = this.lastPlacementId || 'INTERSTITIAL_UNKNOWN';
      analyticsService.trackAdShowFailed(
        'interstitial',
        placement,
        String(error?.message || error)
      );
      return false;
    } finally {
      this.isShowing = false;
      this.hasLoaded = false;
    }
  }

  /**
   * Indica si hay intersticial disponible
   */
  isReady() {
    return !this.isLoading && !this.isShowing && this.hasLoaded;
  }
}

// Singleton
const adInterstitialManager = new AdInterstitialManager();
export default adInterstitialManager;
