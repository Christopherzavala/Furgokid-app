import 'dotenv/config';

/**
 * IMPORTANTE - SEGURIDAD:
 *
 * FIREBASE API KEY RESTRICTIONS (Configurar en Firebase Console):
 * - Android: Restringir a package name 'com.furgokid.app'
 * - iOS: Restringir a bundle ID 'com.furgokid.app'
 * - Web: Restringir a dominios autorizados
 *
 * Ir a: Firebase Console → Project Settings → General → Web API Key → Application restrictions
 */

const admobAndroidAppId = process.env.ADMOB_ANDROID_APP_ID;
const admobIosAppId = process.env.ADMOB_IOS_APP_ID;
const enableAdmobPlugin = Boolean(admobAndroidAppId && admobIosAppId);

// Ad unit IDs (should be provided via EAS Secrets / CI envs for production)
const admobBannerAdUnitIdAndroid = process.env.BANNER_AD_UNIT_ID || '';
const admobInterstitialAdUnitIdAndroid = process.env.INTERSTITIAL_AD_UNIT_ID || '';
const admobRewardedAdUnitIdAndroid = process.env.REWARDED_AD_UNIT_ID || '';

const admobBannerAdUnitIdIos = process.env.BANNER_AD_UNIT_IOS || '';
const admobInterstitialAdUnitIdIos = process.env.INTERSTITIAL_AD_UNIT_IOS || '';
const admobRewardedAdUnitIdIos = process.env.REWARDED_AD_UNIT_IOS || '';

export default {
  expo: {
    name: 'FurgoKid',
    slug: 'furgokid',
    scheme: 'furgokid',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['assets/**/*'],
    jsEngine: 'hermes',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.furgokid.app',
      jsEngine: 'hermes',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      package: 'com.furgokid.app',
      jsEngine: 'hermes',
      enableProguardInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Permitir FurgoKid usar tu ubicación para rastrear el transporte escolar.',
        },
      ],
      'expo-font',
      ...(enableAdmobPlugin
        ? [
            [
              'react-native-google-mobile-ads',
              {
                androidAppId: admobAndroidAppId,
                iosAppId: admobIosAppId,
              },
            ],
          ]
        : []),
    ],
    extra: {
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      admobAndroidAppId: admobAndroidAppId || '',
      admobIosAppId: admobIosAppId || '',
      admobBannerAdUnitIdAndroid,
      admobInterstitialAdUnitIdAndroid,
      admobRewardedAdUnitIdAndroid,
      admobBannerAdUnitIdIos,
      admobInterstitialAdUnitIdIos,
      admobRewardedAdUnitIdIos,
      adsMode: process.env.EXPO_PUBLIC_ADS_MODE || 'test',
      adsForceTest: process.env.EXPO_PUBLIC_ADS_FORCE_TEST || '1',
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      // Public web pages (GitHub Pages)
      privacyPolicyUrl: 'https://christopherzavala.github.io/Furgokid-app/docs/privacy-policy.html',
      termsOfServiceUrl:
        'https://christopherzavala.github.io/Furgokid-app/docs/terms-of-service.html',
      SENTRY_DSN: process.env.SENTRY_DSN,
      SENTRY_ENABLED: process.env.SENTRY_ENABLED,
      APP_VARIANT: process.env.APP_VARIANT || 'development',
      eas: {
        projectId: 'a73187e9-3163-4996-bc85-9ad0e038d81e',
      },
    },
    owner: 'christopher69',
    updates: {
      url: 'https://u.expo.dev/a73187e9-3163-4996-bc85-9ad0e038d81e',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  },
};
