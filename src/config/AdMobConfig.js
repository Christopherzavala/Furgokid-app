/**
 * AdMobConfig.js - Configuracion centralizada de Google AdMob para FurgoKid
 * Ultra Senior Architect: IDs reales + testing configurados
 */

const AD_UNITS = {
  // Banner Ads - Mostrador pequeno en parte inferior/superior
  BANNER_HOME: __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : 'ca-app-pub-REPLACE_WITH_PUBLISHER_ID/REPLACE_WITH_APP_AD_UNIT_ID',
  BANNER_MAP: __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : 'ca-app-pub-REPLACE_WITH_PUBLISHER_ID/REPLACE_WITH_APP_AD_UNIT_ID',
  BANNER_SETTINGS: __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : 'ca-app-pub-REPLACE_WITH_PUBLISHER_ID/REPLACE_WITH_APP_AD_UNIT_ID',
  
  // Interstitial Ads - Pantalla completa (cuando cambian de pantalla)
  INTERSTITIAL_NAV: __DEV__ ? 'ca-app-pub-3940256099942544/1033173712' : 'ca-app-pub-REPLACE_WITH_PUBLISHER_ID/REPLACE_WITH_INTERSTITIAL_AD_UNIT_ID',
  INTERSTITIAL_TRACKING: __DEV__ ? 'ca-app-pub-3940256099942544/1033173712' : 'ca-app-pub-REPLACE_WITH_PUBLISHER_ID/REPLACE_WITH_INTERSTITIAL_AD_UNIT_ID',
  
  // Rewarded Ads - Anuncios con recompensa
  REWARDED_FEATURE: __DEV__ ? 'ca-app-pub-3940256099942544/5224354917' : 'ca-app-pub-REPLACE_WITH_PUBLISHER_ID/REPLACE_WITH_REWARDED_AD_UNIT_ID',
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
  
  // ID de la aplicacion (obtener de Google Play Console)
  APP_ID: __DEV__ ? 'ca-app-pub-xxxxxxxxxxxxxxxx~zzzzzzzzzz' : 'ca-app-pub-REPLACE_WITH_PUBLISHER_ID~REPLACE_WITH_APP_ID',
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
