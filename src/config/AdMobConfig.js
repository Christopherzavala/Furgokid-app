/**
 * AdMobConfig.js - Configuracion centralizada de Google AdMob para FurgoKid
 * Ultra Senior Architect: IDs REALES de AdMob configurados - PRODUCCION READY
 */

import Constants from 'expo-constants';

const AD_UNITS = {
  // Banner Ads - Mostrador pequeno en parte inferior/superior
  BANNER_HOME: 'ca-app-pub-6159996738450051/5061917035',
  BANNER_MAP: 'ca-app-pub-6159996738450051/5061917035',
  BANNER_SETTINGS: 'ca-app-pub-6159996738450051/5061917035',

  // Interstitial Ads - Pantalla completa (cuando cambian de pantalla)
  INTERSTITIAL_NAV: 'ca-app-pub-6159996738450051/9969972240',
  INTERSTITIAL_TRACKING: 'ca-app-pub-6159996738450051/9969972240',

  // Rewarded Ads - Anuncios con recompensa
  REWARDED_FEATURE: 'ca-app-pub-6159996738450051/5608055408',
};

// Google-provided test ad unit IDs (safe for development)
const TEST_AD_UNITS = {
  BANNER_HOME: 'ca-app-pub-3940256099942544/6300978111',
  BANNER_MAP: 'ca-app-pub-3940256099942544/6300978111',
  BANNER_SETTINGS: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL_NAV: 'ca-app-pub-3940256099942544/1033173712',
  INTERSTITIAL_TRACKING: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED_FEATURE: 'ca-app-pub-3940256099942544/5224354917',
};

const AD_CONFIG = {
  // Tiempo minimo entre intersticiales (ms)
  INTERSTITIAL_INTERVAL: 60000, // 1 minuto

  // Mostrar ads solo si el usuario ha pasado cierto tiempo en la app
  MINIMUM_SESSION_TIME: 30000, // 30 segundos

  // Habilitar/deshabilitar ads por rol
  SHOW_ADS_TO_DRIVERS: true,
  SHOW_ADS_TO_PARENTS: true,

  // Frecuencia de banners
  BANNER_LOAD_DELAY: 3000, // 3 segundos entre banner loads

  // Cap diario (en memoria) para proteger UX/retención
  DAILY_INTERSTITIAL_CAP: 10,

  // ID de la aplicacion - REAL de Google Play Console
  APP_ID: 'ca-app-pub-6159996738450051~7339939476',
};

const getAdsRuntimeConfig = () => {
  const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};
  const adsModeRaw = String(extra.adsMode || '').toLowerCase();
  const forceTestRaw = String(extra.adsForceTest || '').toLowerCase();

  const forceTest = forceTestRaw === '1' || forceTestRaw === 'true' || forceTestRaw === 'yes';
  const adsMode = adsModeRaw || 'test';

  return {
    forceTest,
    isProdMode: adsMode === 'prod' || adsMode === 'production',
  };
};

let lastInterstitialTime = 0;
let sessionStartTime = Date.now();
let dailyCount = 0;
let dailyKey = new Date().toISOString().slice(0, 10);

const resetDailyIfNeeded = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyKey) {
    dailyKey = today;
    dailyCount = 0;
  }
};

/**
 * Obtiene el ID de unidad de anuncio según tipo y rol de usuario
 * @param {string} adType - Tipo de anuncio ('BANNER_HOME', 'INTERSTITIAL_NAV', etc)
 * @param {string} userRole - Rol del usuario ('parent' | 'driver')
 * @returns {string|null} - ID de la unidad o null si no está disponible
 */
const getAdUnitId = (adType, userRole = 'parent') => {
  // ✅ Enhanced validation
  if (!adType || typeof adType !== 'string') {
    console.warn('[AdMob] Invalid adType:', adType);
    return null;
  }

  if (userRole === 'driver' && !AD_CONFIG.SHOW_ADS_TO_DRIVERS) {
    console.log('[AdMob] Ads disabled for drivers');
    return null;
  }

  if (userRole === 'parent' && !AD_CONFIG.SHOW_ADS_TO_PARENTS) {
    console.log('[AdMob] Ads disabled for parents');
    return null;
  }

  const { forceTest, isProdMode } = getAdsRuntimeConfig();
  const useTest = forceTest || !isProdMode;
  const units = useTest ? TEST_AD_UNITS : AD_UNITS;
  const unitId = units[adType];
  if (!unitId) {
    console.warn('[AdMob] Ad unit not found:', adType);
  }

  return unitId || null;
};

const shouldShowInterstitial = () => {
  resetDailyIfNeeded();

  // Session minimum time guard
  const sessionTimeOk = Date.now() - sessionStartTime >= AD_CONFIG.MINIMUM_SESSION_TIME;
  if (!sessionTimeOk) return false;

  // Daily cap (in-memory)
  if (dailyCount >= AD_CONFIG.DAILY_INTERSTITIAL_CAP) return false;

  const now = Date.now();
  const canShow = now - lastInterstitialTime >= AD_CONFIG.INTERSTITIAL_INTERVAL;

  if (!canShow) {
    const timeSinceLastAd = Math.round((now - lastInterstitialTime) / 1000);
    const timeUntilNext = Math.round(
      (AD_CONFIG.INTERSTITIAL_INTERVAL - (now - lastInterstitialTime)) / 1000
    );
    console.log(
      `[AdMob] Interstitial cooldown: ${timeSinceLastAd}s since last ad, ${timeUntilNext}s until next`
    );
  }

  return canShow;
};

const recordInterstitialShown = () => {
  resetDailyIfNeeded();
  lastInterstitialTime = Date.now();
  dailyCount += 1;
  console.log('[AdMob] Interstitial shown, cooldown started');
};

export { AD_CONFIG, AD_UNITS, getAdUnitId, recordInterstitialShown, shouldShowInterstitial };
