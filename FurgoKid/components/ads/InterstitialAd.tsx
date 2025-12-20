import React, { useEffect, useRef } from 'react';
import { InterstitialAd as GoogleInterstitialAd, AdEventType } from 'google-mobile-ads';
import { getAdUnitId } from '../src/config/adMobConfig';

interface InterstitialAdProps {
  screenName: string;
  onAdClosed?: () => void;
  onAdFailedToLoad?: (error: any) => void;
  autoLoad?: boolean;
}

/**
 * Componente de anuncio intersticial para Google Mobile Ads
 * Muestra un anuncio a pantalla completa en momentos clave de la app
 */
const InterstitialAd: React.FC<InterstitialAdProps> = ({
  screenName,
  onAdClosed,
  onAdFailedToLoad,
  autoLoad = true,
}) => {
  const interstitialRef = useRef<any>(null);
  const [isAdLoaded, setIsAdLoaded] = React.useState(false);
  const [adError, setAdError] = React.useState<string | null>(null);

  // Obtener el ID del anuncio para esta pantalla
  const adUnitId = getAdUnitId('intersticial', screenName);

  /**
   * Carga el anuncio intersticial
   */
  const loadAd = React.useCallback(async () => {
    if (!adUnitId) {
      console.warn(`No ad unit ID found for interstitial: ${screenName}`);
      setAdError(`No ad configured for ${screenName}`);
      return;
    }

    try {
      const interstitial = GoogleInterstitialAd.createForAdRequest(adUnitId, {
        keywords: ['vehicle', 'tracking', 'kids', 'safety'],
        contentUrl: 'https://www.example.com',
        nonPersonalizedAds: false,
      });

      // Configurar listeners
      interstitial.addEventListener(AdEventType.LOADED, () => {
        console.log('Interstitial ad loaded');
        setIsAdLoaded(true);
        interstitialRef.current = interstitial;
      });

      interstitial.addEventListener(AdEventType.CLOSED, () => {
        console.log('Interstitial ad closed');
        setIsAdLoaded(false);
        if (onAdClosed) {
          onAdClosed();
        }
        // Recargar el anuncio después de cerrarse
        loadAd();
      });

      interstitial.addEventListener(AdEventType.FAILED_TO_LOAD, (error) => {
        console.error('Interstitial ad failed to load:', error);
        setAdError('Failed to load ad');
        if (onAdFailedToLoad) {
          onAdFailedToLoad(error);
        }
      });

      // Cargar el anuncio
      await interstitial.load();
    } catch (error) {
      console.error('Error loading interstitial ad:', error);
      setAdError(error instanceof Error ? error.message : 'Error loading ad');
      if (onAdFailedToLoad) {
        onAdFailedToLoad(error);
      }
    }
  }, [adUnitId, screenName, onAdClosed, onAdFailedToLoad]);

  useEffect(() => {
    if (autoLoad && adUnitId) {
      loadAd();
    }
  }, [autoLoad, adUnitId, loadAd]);

  /**
   * Muestra el anuncio intersticial
   */
  const showAd = React.useCallback(() => {
    if (isAdLoaded && interstitialRef.current) {
      try {
        interstitialRef.current.show();
      } catch (error) {
        console.error('Error showing interstitial ad:', error);
      }
    } else {
      console.warn('Interstitial ad is not loaded yet');
    }
  }, [isAdLoaded]);

  // Exponer el método showAd como una instancia ref
  (InterstitialAd as any).current = { showAd, isAdLoaded };

  return null; // Los anuncios intersticiales no tienen UI propia
};

export default InterstitialAd;
export { InterstitialAd };
