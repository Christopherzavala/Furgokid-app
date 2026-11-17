/** AdMob is disabled for FurgoKid; configuration cannot re-enable requests. */
const AD_CONFIG = Object.freeze({
  ENABLED: false,
  SHOW_ADS_TO_DRIVERS: false,
  SHOW_ADS_TO_PARENTS: false,
  INTERSTITIAL_INTERVAL: 0,
  MINIMUM_SESSION_TIME: 0,
  DAILY_INTERSTITIAL_CAP: 0,
  BANNER_LOAD_DELAY: 0,
  APP_ID: '',
});

const AD_UNITS = Object.freeze({
  BANNER_HOME: null,
  BANNER_MAP: null,
  BANNER_SETTINGS: null,
  INTERSTITIAL_NAV: null,
  INTERSTITIAL_TRACKING: null,
  REWARDED_FEATURE: null,
});

const getAdUnitId = (_adType, _userRole) => null;
const shouldShowInterstitial = () => false;
const recordInterstitialShown = () => {};

export { AD_CONFIG, AD_UNITS, getAdUnitId, recordInterstitialShown, shouldShowInterstitial };
