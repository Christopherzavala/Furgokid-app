import { useEffect, useState } from 'react';
import admobService from '../services/admobService';

export const useAdMob = () => {
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    admobService
      .initialize()
      .then(async () => {
        const [interstitialOk, rewardedOk] = await Promise.all([
          admobService.loadInterstitialAd(),
          admobService.loadRewardedAd(),
        ]);

        if (!cancelled) {
          setAdLoaded(Boolean(interstitialOk || rewardedOk));
        }
      })
      .catch(() => {
        if (!cancelled) setAdLoaded(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    adLoaded,
    showInterstitial: () => admobService.showInterstitialAd(),
    showRewarded: () => admobService.showRewardedAd(),
  };
};
