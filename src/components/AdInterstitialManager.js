/**
 * AdInterstitialManager.js
 * Manejador centralizado para anuncios intersticiales (pantalla completa)
 * Ultra Senior Architect: Singleton pattern para evitar instancias multiples
 */

import { AD_UNITS, AD_CONFIG, shouldShowInterstitial, recordInterstitialShown } from '../config/AdMobConfig';

class AdInterstitialManager {
  constructor() {
    this.isLoading = false;
    this.isShowing = false;
  }

  /**
   * Carga un anuncio intersticial
   * @param {string} placementId - ID del placement (INTERSTITIAL_NAV, INTERSTITIAL_TRACKING, etc)
   * @param {string} userRole - Rol del usuario (driver, parent)
   */
  async loadInterstitial(placementId, userRole = 'parent') {
    if (!shouldShowInterstitial()) {
      console.log('Aun no es tiempo de mostrar intersticial');
      return false;
    }

    const adUnitId = AD_UNITS[placementId];
    if (!adUnitId) {
      console.warn(`Ad Unit ID no encontrado para: ${placementId}`);
      return false;
    }

    try {
      this.isLoading = true;
      // TODO: Integrar GoogleMobileAds cuando este disponible
      // await interstitialAd.load(adUnitId);
      return true;
    } catch (error) {
      console.error('Error cargando intersticial:', error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Muestra el intersticial
   */
  async show() {
    if (this.isShowing || this.isLoading) {
      return false;
    }

    try {
      this.isShowing = true;
      recordInterstitialShown();
      // TODO: await interstitialAd.show();
      return true;
    } catch (error) {
      console.error('Error mostrando intersticial:', error);
      return false;
    } finally {
      this.isShowing = false;
    }
  }

  /**
   * Muestra si hay intersticial disponible
   */
  isReady() {
    return !this.isLoading && !this.isShowing;
  }
}

// Singleton
const adInterstitialManager = new AdInterstitialManager();
export default adInterstitialManager;
