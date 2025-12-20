/**
 * AdMobConfig.js - Configuracion centralizada de Google AdMob para FurgoKid
 */

const AD_UNITS = {
  BANNER_HOME: __DEV__ ? 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyyyy' : 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzzzz',
  BANNER_MAP: __DEV__ ? 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyyyy' : 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzzzz',
  INTERSTITIAL_NAV: __DEV__ ? 'ca-app-pub-xxxxxxxxxxxxxxxx/wwwwwwwwwwww' : 'ca-app-pub-xxxxxxxxxxxxxxxx/vvvvvvvvvvvv',
  REWARDED_FEATURE: __DEV__ ? 'ca-app-pub-xxxxxxxxxxxxxxxx/uuuuuuuuuuuu' : 'ca-app-pub-xxxxxxxxxxxxxxxx/tttttttttttt',
};

const AD_CONFIG = {
  INTERSTITIAL_INTERVAL: 60000,
  MINIMUM_SESSION_TIME: 30000,
  SHOW_ADS_TO_DRIVERS: true,
  SHOW_ADS_TO_PARENTS: true,
  BANNER_LOAD_DELAY: 3000,
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
