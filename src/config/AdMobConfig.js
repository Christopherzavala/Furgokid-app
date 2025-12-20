/**
 * AdMobConfig.js - Configuracion centralizada de Google AdMob para FurgoKid
 * Ultra Senior Architect: IDs REALES de AdMob configurados - PRODUCCION READY
 */

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
  
  // ID de la aplicacion - REAL de Google Play Console
  APP_ID: 'ca-app-pub-6159996738450051~7339939476',
};

let lastInterstitialTime = 0;

const getAdUnitId = (adType, userRole = 'parent') => {
  if (userRole === 'driver' && !AD_CONFIG.SHOW_ADS_TO_DRIVERS) return null;
  if (userRole === 'parent' && !AD_CONFIG.SHOW_ADS_TO_PARENTS) return null;
  return AD_UNITS[adType] || null;
};

const shouldShowInterstitial = () => {
  const now = Date.now();
  return (now - lastInterstitialTime) >= AD_CONFIG.INTERSTITIAL_INTERVAL;
};

const recordInterstitialShown = () => {
  lastInterstitialTime = Date.now();
};

export { AD_UNITS, AD_CONFIG, getAdUnitId, shouldShowInterstitial, recordInterstitialShown };
