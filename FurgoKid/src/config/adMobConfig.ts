// Configuración de Google Mobile Ads (AdMob) para FurgoKid

import { GoogleMobileAdsSDK } from 'google-mobile-ads';

/**
 * ID de anuncios de AdMob para la aplicación FurgoKid
 * Reemplazar con tus IDs reales de AdMob
 */
export const AD_MOB_CONFIG = {
  // IDs de aplicación
  appId: {
    ios: 'ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy', // Reemplazar con tu App ID de iOS
    android: 'ca-app-pub-xxxxxxxxxxxxxxxx~zzzzzzzzzz', // Reemplazar con tu App ID de Android
  },

  // Anuncios de banner
  bannerAds: {
    homeScreen: {
      ios: 'ca-app-pub-3940256099942544/2934735716', // Banner de prueba iOS
      android: 'ca-app-pub-3940256099942544/6300978111', // Banner de prueba Android
    },
    trackingScreen: {
      ios: 'ca-app-pub-3940256099942544/2934735716',
      android: 'ca-app-pub-3940256099942544/6300978111',
    },
  },

  // Anuncios intersticiales
  interstitialAds: {
    afterTracking: {
      ios: 'ca-app-pub-3940256099942544/4411468910', // Intersticial de prueba iOS
      android: 'ca-app-pub-3940256099942544/1033173712', // Intersticial de prueba Android
    },
    afterProfileUpdate: {
      ios: 'ca-app-pub-3940256099942544/4411468910',
      android: 'ca-app-pub-3940256099942544/1033173712',
    },
  },

  // Anuncios recompensados
  rewardedAds: {
    premiumFeatures: {
      ios: 'ca-app-pub-3940256099942544/5224354917', // Anuncio recompensado de prueba iOS
      android: 'ca-app-pub-3940256099942544/5224354917', // Anuncio recompensado de prueba Android
    },
  },
};

/**
 * Inicializa Google Mobile Ads
 * Debe llamarse una sola vez en el componente App
 */
export const initializeAdMob = async () => {
  try {
    // Inicializar AdMob (sin pasar app ID aquí, se configura en app.json para Expo)
    await GoogleMobileAdsSDK.initialize();
    console.log('Google Mobile Ads inicializado correctamente');
  } catch (error) {
    console.error('Error al inicializar Google Mobile Ads:', error);
  }
};

/**
 * Obtiene el ID de anuncio apropiado para la plataforma
 * @param adType - Tipo de anuncio (banner, intersticial, etc)
 * @param screen - Pantalla donde se mostrará el anuncio
 * @param platform - 'ios' o 'android' (se detecta automáticamente si no se proporciona)
 */
export const getAdUnitId = (
  adType: 'banner' | 'intersticial' | 'rewarded',
  screen: string,
  platform?: 'ios' | 'android'
) => {
  // Detectar plataforma si no se proporciona
  if (!platform) {
    // Esto requiere react-native-platform para estar disponible
    platform = 'android'; // Por defecto android, se puede mejorar
  }

  switch (adType) {
    case 'banner':
      return AD_MOB_CONFIG.bannerAds[screen as keyof typeof AD_MOB_CONFIG.bannerAds]?.[platform];
    case 'intersticial':
      return AD_MOB_CONFIG.interstitialAds[screen as keyof typeof AD_MOB_CONFIG.interstitialAds]?.[platform];
    case 'rewarded':
      return AD_MOB_CONFIG.rewardedAds[screen as keyof typeof AD_MOB_CONFIG.rewardedAds]?.[platform];
    default:
      return null;
  }
};

export default AD_MOB_CONFIG;
