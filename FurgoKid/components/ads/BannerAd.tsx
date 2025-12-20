import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GoogleMobileAdsSDK, BannerAd as GoogleBannerAd, BannerAdSize } from 'google-mobile-ads';
import { getAdUnitId } from '../src/config/adMobConfig';

interface BannerAdProps {
  screenName: string;
  size?: BannerAdSize;
  testDevices?: string[];
}

/**
 * Componente de anuncio banner para Google Mobile Ads
 * Muestra un banner en la parte inferior de la pantalla
 */
const BannerAd: React.FC<BannerAdProps> = ({
  screenName,
  size = BannerAdSize.SMART_BANNER,
  testDevices = [],
}) => {
  const bannerRef = React.useRef<any>(null);
  const [adLoaded, setAdLoaded] = React.useState(false);
  const [adError, setAdError] = React.useState<string | null>(null);

  // Obtener el ID del anuncio para esta pantalla
  const adUnitId = getAdUnitId('banner', screenName);

  useEffect(() => {
    if (!adUnitId) {
      console.warn(`No ad unit ID found for screen: ${screenName}`);
      setAdError(`No ad configured for ${screenName}`);
      return;
    }

    const loadAd = async () => {
      try {
        if (bannerRef.current) {
          // Cargar el anuncio
          await bannerRef.current?.load();
          setAdLoaded(true);
        }
      } catch (error) {
        console.error('Error loading banner ad:', error);
        setAdError(error instanceof Error ? error.message : 'Error loading ad');
      }
    };

    loadAd();
  }, [adUnitId, screenName]);

  if (adError) {
    console.warn(`Banner ad error for ${screenName}: ${adError}`);
    return null;
  }

  if (!adUnitId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <GoogleBannerAd
        ref={bannerRef}
        unitId={adUnitId}
        size={size}
        requestOptions={{
          keywords: ['vehicle', 'tracking', 'kids', 'safety'],
          contentUrl: 'https://www.example.com',
          nonPersonalizedAds: false,
        }}
        onAdLoaded={() => {
          console.log('Banner ad loaded');
          setAdLoaded(true);
        }}
        onAdFailedToLoad={(error) => {
          console.error('Banner ad failed to load:', error);
          setAdError('Failed to load ad');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
  },
});

export default BannerAd;
