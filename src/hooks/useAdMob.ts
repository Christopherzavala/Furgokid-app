import { useEffect, useState } from 'react';
import admobService from '../services/admobService';
import useConsent from './useConsent';

export const useAdMob = () => {
  const [adLoaded, setAdLoaded] = useState(false);
  const { loading: consentLoading, hasAcceptedRequired, canShowPersonalizedAds } = useConsent();

  useEffect(() => {
    let cancelled = false;

    if (consentLoading || !hasAcceptedRequired) {
      setAdLoaded(false);
      return () => {
        cancelled = true;
      };
    }

    const requestOptions = {
      requestNonPersonalizedAdsOnly: !canShowPersonalizedAds,
    };

    admobService
      .initialize()
      .then(async () => {
        const [interstitialOk, rewardedOk] = await Promise.all([
          admobService.loadInterstitialAd(undefined, requestOptions),
          admobService.loadRewardedAd(undefined, requestOptions),
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
  }, [consentLoading, hasAcceptedRequired, canShowPersonalizedAds]);

  return {
    adLoaded,
    showInterstitial: () => admobService.showInterstitialAd(),
    showRewarded: () => admobService.showRewardedAd(),
  };
};
