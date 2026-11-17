import {
  AD_CONFIG,
  AD_UNITS,
  getAdUnitId,
  recordInterstitialShown,
  shouldShowInterstitial,
} from '../config/AdMobConfig';
import admobService from '../services/admobService';
import adInterstitialManager from '../components/AdInterstitialManager';
import { AdBanner } from '../components/AdBanner';
import AdBannerComponent from '../components/AdBannerComponent';
import { useAdMob } from '../hooks/useAdMob';

describe('AdMob disabled configuration', () => {
  it('has no enabled audience, app ID, or ad unit IDs', () => {
    expect(AD_CONFIG.ENABLED).toBe(false);
    expect(AD_CONFIG.SHOW_ADS_TO_DRIVERS).toBe(false);
    expect(AD_CONFIG.SHOW_ADS_TO_PARENTS).toBe(false);
    expect(AD_CONFIG.APP_ID).toBe('');
    expect(Object.values(AD_UNITS).every((unitId) => unitId === null)).toBe(true);
  });

  it('cannot return an ad unit or approve an interstitial request', () => {
    expect(getAdUnitId('BANNER_HOME', 'parent')).toBeNull();
    expect(getAdUnitId('INTERSTITIAL_NAV', 'driver')).toBeNull();
    expect(shouldShowInterstitial()).toBe(false);
    expect(recordInterstitialShown()).toBeUndefined();
  });

  it('does not initialize, load, or present any ad format', async () => {
    await expect(admobService.initialize()).resolves.toBeUndefined();
    await expect(admobService.loadInterstitialAd()).resolves.toBe(false);
    await expect(admobService.showInterstitialAd()).resolves.toBe(false);
    await expect(admobService.loadRewardedAd()).resolves.toBe(false);
    await expect(admobService.showRewardedAd()).resolves.toBe(false);
    await expect(adInterstitialManager.canShow('INTERSTITIAL_NAV', 'parent')).resolves.toBe(false);
    await expect(
      adInterstitialManager.loadInterstitial('INTERSTITIAL_NAV', 'parent')
    ).resolves.toBe(false);
    await expect(adInterstitialManager.show()).resolves.toBe(false);
    expect(adInterstitialManager.isReady()).toBe(false);
  });

  it('keeps banner components and the AdMob hook inactive', () => {
    expect(AdBanner({ unitId: 'test-unit', screenName: 'home' })).toBeNull();
    expect(AdBannerComponent()).toBeNull();
    expect(useAdMob()).toEqual({
      adLoaded: false,
      showInterstitial: expect.any(Function),
      showRewarded: expect.any(Function),
    });
  });
});
