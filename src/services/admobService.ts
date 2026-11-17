/**
 * AdMob is disabled for FurgoKid. Keep this no-op service so existing callers
 * fail closed while they are removed in a separately approved product change.
 */
class AdMobService {
  async initialize(): Promise<void> {}

  async loadInterstitialAd(_adUnitIdOverride?: string, _requestOptions?: any): Promise<boolean> {
    return false;
  }

  async showInterstitialAd(): Promise<boolean> {
    return false;
  }

  async loadRewardedAd(_adUnitIdOverride?: string, _requestOptions?: any): Promise<boolean> {
    return false;
  }

  async showRewardedAd(): Promise<boolean> {
    return false;
  }
}

export default new AdMobService();
