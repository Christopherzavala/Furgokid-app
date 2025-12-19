import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import analyticsService from '../services/analyticsService';

interface AdBannerProps {
  unitId: string;
  screenName: string;
  style?: any;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  unitId,
  screenName,
  style,
}) => {
  const adRef = useRef(null);
  const impressionTracked = useRef(false);

  useEffect(() => {
    if (!impressionTracked.current) {
      analyticsService.trackAdImpression('banner', screenName);
      impressionTracked.current = true;
    }
  }, [screenName]);

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        ref={adRef}
        unitId={unitId}
        size={BannerAdSize.FULL_BANNER}
        requestOptions={{
          requestNonPersonalizedAds: false,
          keywords: ['parenting', 'children', 'education', 'tracking'],
        }}
        onAdFailedToLoad={(error) => {
          console.log([AdBanner] Error: \);
        }}
        onAdOpened={() => {
          console.log('[AdBanner] Ad opened');
          analyticsService.trackAdClick('banner', unitId, screenName);
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
