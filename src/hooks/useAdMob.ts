import { useEffect, useState } from 'react';
import admobService from '../services/admobService';

export const useAdMob = () => {
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    admobService.initialize().then(() => {
      admobService.loadInterstitialAd();
      admobService.loadRewardedAd();
      setAdLoaded(true);
    });
  }, []);

  return {
    adLoaded,
    showInterstitial: () => admobService.showInterstitialAd(),
    showRewarded: () => admobService.showRewardedAd(),
  };
};
