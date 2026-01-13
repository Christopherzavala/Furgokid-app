import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import useConsent from '../hooks/useConsent';
import admobService from '../services/admobService';
import analyticsService from '../services/analyticsService';

import Constants, { ExecutionEnvironment } from 'expo-constants';

interface AdBannerProps {
  unitId: string;
  screenName: string;
  style?: any;
}

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const AdBanner: React.FC<AdBannerProps> = ({ unitId, screenName, style }) => {
  const adRef = useRef(null);
  const impressionTracked = useRef(false);
  const { loading: consentLoading, hasAcceptedRequired, canShowPersonalizedAds } = useConsent();

  useEffect(() => {
    if (!isExpoGo && !consentLoading && hasAcceptedRequired) {
      admobService.initialize();
      analyticsService.trackAdLoadAttempt('banner', screenName);
    }
  }, [screenName, consentLoading, hasAcceptedRequired]);

  if (isExpoGo) {
    return (
      <View style={[styles.container, style, { backgroundColor: '#e0e0e0', padding: 10 }]}>
        <Text style={{ fontSize: 10, color: '#666' }}>[AdMob Banner - Disabled in Expo Go]</Text>
      </View>
    );
  }

  if (consentLoading || !hasAcceptedRequired) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        ref={adRef}
        unitId={unitId}
        size={BannerAdSize.FULL_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: !canShowPersonalizedAds,
          keywords: ['parenting', 'children', 'education', 'tracking'],
        }}
        onAdLoaded={() => {
          analyticsService.trackAdLoaded('banner', screenName);
        }}
        onAdFailedToLoad={(error) => {
          if (__DEV__) {
            console.log(`[AdBanner] Error: ${error}`);
          }
          analyticsService.trackAdLoadFailed('banner', screenName, String(error?.message || error));
        }}
        onAdImpression={() => {
          if (!impressionTracked.current) {
            analyticsService.trackAdImpression('banner', screenName);
            impressionTracked.current = true;
          }
        }}
        onAdClicked={() => {
          analyticsService.trackAdClick('banner', unitId, screenName);
        }}
        onPaid={(event: any) => {
          try {
            analyticsService.trackAdPaid(
              'banner',
              screenName,
              Number(event?.valueMicros || 0),
              String(event?.currencyCode || 'USD'),
              event?.precision
            );
          } catch {
            // no-op
          }
        }}
        onAdOpened={() => {
          if (__DEV__) {
            console.log('[AdBanner] Ad opened');
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
});
