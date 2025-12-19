import MobileAds, {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
} from 'react-native-google-mobile-ads';

const TEST_IDS = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
};

const PRODUCTION_IDS = {
  BANNER: process.env.BANNER_AD_UNIT_ID || TEST_IDS.BANNER,
  INTERSTITIAL: process.env.INTERSTITIAL_AD_UNIT_ID || TEST_IDS.INTERSTITIAL,
  REWARDED: process.env.REWARDED_AD_UNIT_ID || TEST_IDS.REWARDED,
};

class AdMobService {
  private initialized = false;
  private interstitialAd: InterstitialAd | null = null;
  private rewardedAd: RewardedAd | null = null;
  private isProduction = process.env.NODE_ENV === 'production';

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await MobileAds().initialize();
      this.initialized = true;
      console.log('[AdMob] Inicializado correctamente');
    } catch (error) {
      console.error('[AdMob] Error al inicializar:', error);
    }
  }

  private getAdUnitId(adType: 'banner' | 'interstitial' | 'rewarded'): string {
    if (this.isProduction) {
      return PRODUCTION_IDS[adType.toUpperCase() as keyof typeof PRODUCTION_IDS];
    }
    return TEST_IDS[adType.toUpperCase() as keyof typeof TEST_IDS];
  }

  async loadInterstitialAd(): Promise<void> {
    try {
      const adUnitId = this.getAdUnitId('interstitial');
      const interstitialAd = InterstitialAd.createForAdRequest(adUnitId);

      await new Promise<void>((resolve, reject) => {
        const unsubscribe = interstitialAd.onAdEvent((type) => {
          if (type === 'loaded') {
            this.interstitialAd = interstitialAd;
            unsubscribe();
            resolve();
          }
        });

        interstitialAd.load();

        setTimeout(() => {
          reject(new Error('Intersticial no cargó a tiempo'));
        }, 5000);
      });

      console.log('[AdMob] Intersticial precargado');
    } catch (error) {
      console.error('[AdMob] Error precargando intersticial:', error);
    }
  }

  async showInterstitialAd(): Promise<void> {
    try {
      if (this.interstitialAd) {
        await this.interstitialAd.show();
        this.interstitialAd = null;
        this.loadInterstitialAd();
      }
    } catch (error) {
      console.error('[AdMob] Error mostrando intersticial:', error);
    }
  }

  async loadRewardedAd(): Promise<void> {
    try {
      const adUnitId = this.getAdUnitId('rewarded');
      const rewardedAd = RewardedAd.createForAdRequest(adUnitId);

      await new Promise<void>((resolve, reject) => {
        const unsubscribe = rewardedAd.onAdEvent((type) => {
          if (type === 'loaded') {
            this.rewardedAd = rewardedAd;
            unsubscribe();
            resolve();
          }
        });

        rewardedAd.load();

        setTimeout(() => {
          reject(new Error('Recompensado no cargó a tiempo'));
        }, 5000);
      });

      console.log('[AdMob] Anuncio recompensado precargado');
    } catch (error) {
      console.error('[AdMob] Error precargando recompensado:', error);
    }
  }

  async showRewardedAd(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (this.rewardedAd) {
          const unsubscribe = this.rewardedAd.onAdEvent((type, error) => {
            if (type === 'earned_reward') {
              console.log('[AdMob] ¡Recompensa otorgada!');
              unsubscribe();
              this.rewardedAd = null;
              this.loadRewardedAd();
              resolve(true);
            } else if (type === 'closed') {
              unsubscribe();
              this.rewardedAd = null;
              this.loadRewardedAd();
              resolve(false);
            }
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
    return this.isProduction;
  }

  reset(): void {
    this.initialized = false;
    this.interstitialAd = null;
    this.rewardedAd = null;
  }
}

export default new AdMobService();
