import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import MobileAds, {
  AdEventType,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import analyticsService from './analyticsService';

const TEST_IDS = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
};

type AdType = 'banner' | 'interstitial' | 'rewarded';

const getExtra = () =>
  Constants?.expoConfig?.extra ||
  (Constants as any)?.manifest?.extra ||
  (Constants as any)?.manifest2?.extra ||
  {};

const getAdsRuntimeConfig = () => {
  const extra = getExtra();
  const adsModeRaw = String(extra.adsMode || '').toLowerCase();
  const forceTestRaw = String(extra.adsForceTest || '').toLowerCase();

  const forceTest = forceTestRaw === '1' || forceTestRaw === 'true' || forceTestRaw === 'yes';
  const adsMode = adsModeRaw || 'test';

  return {
    forceTest,
    isProdMode: adsMode === 'prod' || adsMode === 'production',
    extra,
  };
};

const getProductionAdUnitId = (adType: AdType): string | null => {
  const { extra } = getAdsRuntimeConfig();
  const isIos = Platform.OS === 'ios';

  if (adType === 'banner') {
    return (
      String((isIos ? extra.admobBannerAdUnitIdIos : extra.admobBannerAdUnitIdAndroid) || '') ||
      null
    );
  }
  if (adType === 'interstitial') {
    return (
      String(
        (isIos ? extra.admobInterstitialAdUnitIdIos : extra.admobInterstitialAdUnitIdAndroid) || ''
      ) || null
    );
  }
  return (
    String((isIos ? extra.admobRewardedAdUnitIdIos : extra.admobRewardedAdUnitIdAndroid) || '') ||
    null
  );
};

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

class AdMobService {
  private initialized = false;
  private interstitialAd: InterstitialAd | null = null;
  private rewardedAd: RewardedAd | null = null;
  private lastInterstitialAdUnitId: string | null = null;
  private lastRewardedAdUnitId: string | null = null;

  async initialize(): Promise<void> {
    if (isExpoGo) {
      console.log('[AdMob] Expo Go detectado - AdMob deshabilitado');
      return;
    }

    if (this.initialized) return;
    try {
      await MobileAds().initialize();
      this.initialized = true;
      console.log('[AdMob] Inicializado correctamente');
    } catch (error) {
      console.error('[AdMob] Error al inicializar:', error);
    }
  }

  private getAdUnitId(adType: AdType): string | null {
    const { forceTest, isProdMode } = getAdsRuntimeConfig();
    const useTest = forceTest || !isProdMode;
    if (useTest) {
      return TEST_IDS[adType.toUpperCase() as keyof typeof TEST_IDS];
    }

    return getProductionAdUnitId(adType);
  }

  async loadInterstitialAd(adUnitIdOverride?: string, requestOptions?: any): Promise<boolean> {
    if (isExpoGo) return false;

    try {
      const adUnitId = adUnitIdOverride || this.getAdUnitId('interstitial');
      if (!adUnitId) {
        console.warn('[AdMob] Interstitial adUnitId missing (prod ads mode). Skipping load.');
        return false;
      }
      const interstitialAd = InterstitialAd.createForAdRequest(adUnitId, requestOptions);
      this.lastInterstitialAdUnitId = adUnitId;

      await new Promise<void>((resolve, reject) => {
        let done = false;
        let unsubscribeLoaded: (() => void) | null = null;
        let unsubscribeError: (() => void) | null = null;

        const finish = (fn: (value?: any) => void, value?: any) => {
          if (done) return;
          done = true;
          clearTimeout(timeoutId);
          try {
            unsubscribeLoaded?.();
          } catch {
            // no-op
          }
          try {
            unsubscribeError?.();
          } catch {
            // no-op
          }
          fn(value);
        };

        unsubscribeLoaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
          this.interstitialAd = interstitialAd;
          finish(resolve);
        });

        unsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
          console.error('[AdMob] Error cargando interstitial:', error);
          finish(reject, error);
        });

        interstitialAd.load();

        const timeoutId = setTimeout(() => {
          finish(reject, new Error('Intersticial no cargó a tiempo'));
        }, 8000);
      });

      console.log('[AdMob] Intersticial precargado');
      return true;
    } catch (error) {
      console.error('[AdMob] Error precargando intersticial:', error);
      return false;
    }
  }

  async showInterstitialAd(placement: string = 'INTERSTITIAL'): Promise<boolean> {
    if (isExpoGo) {
      console.log('[AdMob] Expo Go - Simulación de Interstitial');
      return false;
    }

    try {
      if (this.interstitialAd) {
        const adUnitIdForEvent = this.lastInterstitialAdUnitId || 'unknown';

        const unsubscribeOpened = this.interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
          analyticsService.trackAdImpression('interstitial', placement);
        });

        const unsubscribeClicked = this.interstitialAd.addAdEventListener(
          AdEventType.CLICKED,
          () => {
            analyticsService.trackAdClick('interstitial', adUnitIdForEvent, placement);
          }
        );

        const unsubscribePaid = this.interstitialAd.addAdEventListener(
          AdEventType.PAID,
          (event) => {
            try {
              analyticsService.trackAdPaid(
                'interstitial',
                placement,
                Number((event as any)?.valueMicros || 0),
                String((event as any)?.currencyCode || 'USD'),
                (event as any)?.precision
              );
            } catch {
              // no-op
            }
          }
        );

        const unsubscribeClosed = this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
          unsubscribeClosed();
          unsubscribeOpened();
          unsubscribeClicked();
          unsubscribePaid();
          this.interstitialAd = null;
          if (this.lastInterstitialAdUnitId) {
            this.loadInterstitialAd(this.lastInterstitialAdUnitId);
          } else {
            this.loadInterstitialAd();
          }
        });

        await this.interstitialAd.show();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[AdMob] Error mostrando intersticial:', error);
      return false;
    }
  }

  async loadRewardedAd(adUnitIdOverride?: string, requestOptions?: any): Promise<boolean> {
    if (isExpoGo) return false;

    try {
      const adUnitId = adUnitIdOverride || this.getAdUnitId('rewarded');
      if (!adUnitId) {
        console.warn('[AdMob] Rewarded adUnitId missing (prod ads mode). Skipping load.');
        return false;
      }
      const rewardedAd = RewardedAd.createForAdRequest(adUnitId, requestOptions);
      this.lastRewardedAdUnitId = adUnitId;

      await new Promise<void>((resolve, reject) => {
        let done = false;
        let unsubscribeLoaded: (() => void) | null = null;
        let unsubscribeError: (() => void) | null = null;

        const finish = (fn: (value?: any) => void, value?: any) => {
          if (done) return;
          done = true;
          clearTimeout(timeoutId);
          try {
            unsubscribeLoaded?.();
          } catch {
            // no-op
          }
          try {
            unsubscribeError?.();
          } catch {
            // no-op
          }
          fn(value);
        };

        unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
          this.rewardedAd = rewardedAd;
          finish(resolve);
        });

        unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
          console.error('[AdMob] Error cargando rewarded:', error);
          finish(reject, error);
        });

        rewardedAd.load();

        const timeoutId = setTimeout(() => {
          finish(reject, new Error('Recompensado no cargó a tiempo'));
        }, 8000);
      });

      console.log('[AdMob] Anuncio recompensado precargado');
      return true;
    } catch (error) {
      console.error('[AdMob] Error precargando recompensado:', error);
      return false;
    }
  }

  async showRewardedAd(): Promise<boolean> {
    if (isExpoGo) {
      console.log('[AdMob] Expo Go - Simulación de Rewarded (Recompensa otorgada)');
      return true;
    }

    return new Promise((resolve) => {
      try {
        if (this.rewardedAd) {
          let earned = false;

          const unsubscribeEarned = this.rewardedAd.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            (reward) => {
              console.log('[AdMob] ¡Recompensa otorgada!', reward);
              earned = true;
            }
          );

          const unsubscribeClosed = this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
            unsubscribeEarned();
            unsubscribeClosed();
            this.rewardedAd = null;
            if (this.lastRewardedAdUnitId) {
              this.loadRewardedAd(this.lastRewardedAdUnitId);
            } else {
              this.loadRewardedAd();
            }
            resolve(earned);
          });

          this.rewardedAd.show();
        } else {
          resolve(false);
        }
      } catch (error) {
        console.error('[AdMob] Error mostrando recompensado:', error);
        resolve(false);
      }
    });
  }

  isProductionAds(): boolean {
    const { forceTest, isProdMode } = getAdsRuntimeConfig();
    return isProdMode && !forceTest;
  }

  reset(): void {
    this.initialized = false;
    this.interstitialAd = null;
    this.rewardedAd = null;
  }
}

export default new AdMobService();
