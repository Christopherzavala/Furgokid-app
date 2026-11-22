import 'dotenv/config';
import fs from 'fs';
import path from 'path';

/**
 * IMPORTANTE - SEGURIDAD Y MULTI-ENTORNO:
 *
 * Validaciones de Configuración de Firebase y Expo:
 * - APP_VARIANT: 'development' | 'staging' | 'production'
 * - Rechaza variantes desconocidas o archivos Google Services inexistentes/descalzados.
 * - Prohibido el fallback silencioso hacia producción.
 */

const ALLOWED_VARIANTS = new Set(['development', 'staging', 'production']);
const APP_VARIANT = process.env.APP_VARIANT || 'development';

if (!ALLOWED_VARIANTS.has(APP_VARIANT)) {
  throw new Error(
    `[CRITICAL CONFIG ERROR] Unknown APP_VARIANT: '${APP_VARIANT}'. Allowed values: 'development', 'staging', 'production'.`
  );
}

const IS_DEV = APP_VARIANT === 'development';
const IS_STAGING = APP_VARIANT === 'staging';

// Mapeo unívoco e inalterable por variante
const CONFIG_PER_VARIANT = {
  development: {
    packageName: 'com.furgokid.app.dev',
    scheme: 'furgokid-dev',
    projectId: 'demo-furgokid',
    projectNumber: '000000000000',
    googleServicesFile: './google-services.dev.json',
  },
  staging: {
    packageName: 'com.furgokid.app.staging',
    scheme: 'furgokid-staging',
    projectId: 'furgokid-staging',
    projectNumber: '1030782410558',
    googleServicesFile: './google-services.staging.json',
  },
  production: {
    packageName: 'com.furgokid.app',
    scheme: 'furgokid',
    projectId: 'furgokid',
    projectNumber: '1061722538586',
    googleServicesFile: './google-services.json',
  },
};

const currentConfig = CONFIG_PER_VARIANT[APP_VARIANT];
const targetFilePath = path.resolve(__dirname, currentConfig.googleServicesFile);

// VALIDACIÓN 1: Existencia de archivo obligatorio para Staging y Producción
if (!IS_DEV) {
  if (!fs.existsSync(targetFilePath)) {
    throw new Error(
      `[CRITICAL CONFIG ERROR] Missing required Google Services file: '${currentConfig.googleServicesFile}' for APP_VARIANT='${APP_VARIANT}'. Staging build is blocked until authentic configuration file is provided.`
    );
  }
}

// VALIDACIÓN 2: Parsing y coincidencia interna de campos en Google Services JSON si el archivo existe
if (fs.existsSync(targetFilePath)) {
  try {
    const rawContent = fs.readFileSync(targetFilePath, 'utf8');
    const parsedJson = JSON.parse(rawContent);

    // a) Validar Project ID interno
    const jsonProjectId = parsedJson.project_info?.project_id;
    if (jsonProjectId !== currentConfig.projectId) {
      throw new Error(
        `[CRITICAL CONFIG ERROR] Project ID mismatch in '${currentConfig.googleServicesFile}': Found '${jsonProjectId}', expected '${currentConfig.projectId}'.`
      );
    }

    // b) Validar Project Number interno
    const jsonProjectNumber = parsedJson.project_info?.project_number;
    if (!IS_DEV && jsonProjectNumber !== currentConfig.projectNumber) {
      throw new Error(
        `[CRITICAL CONFIG ERROR] Project Number mismatch in '${currentConfig.googleServicesFile}': Found '${jsonProjectNumber}', expected '${currentConfig.projectNumber}'.`
      );
    }

    // c) Validar Package Name interno
    const clientPackages =
      parsedJson.client?.map((c) => c.client_info?.android_client_info?.package_name) || [];
    if (!clientPackages.includes(currentConfig.packageName)) {
      throw new Error(
        `[CRITICAL CONFIG ERROR] Package name '${currentConfig.packageName}' not found in '${
          currentConfig.googleServicesFile
        }'. Found packages: [${clientPackages.join(', ')}].`
      );
    }
  } catch (err) {
    if (err.message.startsWith('[CRITICAL CONFIG ERROR]')) throw err;
    throw new Error(
      `[CRITICAL CONFIG ERROR] Invalid JSON structure in '${currentConfig.googleServicesFile}': ${err.message}`
    );
  }
}

// VALIDACIÓN 3: Coincidencia con variables de entorno JS SDK
const currentEnvProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
if (currentEnvProjectId && currentEnvProjectId !== currentConfig.projectId) {
  throw new Error(
    `[CRITICAL CONFIG ERROR] Environment mismatch: EXPO_PUBLIC_FIREBASE_PROJECT_ID='${currentEnvProjectId}' does not match expected '${currentConfig.projectId}' for APP_VARIANT='${APP_VARIANT}'.`
  );
}

export default {
  expo: {
    name: IS_STAGING ? 'FurgoKid Staging' : IS_DEV ? 'FurgoKid Dev' : 'FurgoKid',
    slug: 'furgokid',
    scheme: currentConfig.scheme,
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
      bundleIdentifier: currentConfig.packageName,
      jsEngine: 'hermes',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      package: currentConfig.packageName,
      googleServicesFile: fs.existsSync(targetFilePath)
        ? currentConfig.googleServicesFile
        : undefined,
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
    ],
    extra: {
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: currentConfig.projectId,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      privacyPolicyUrl: 'https://christopherzavala.github.io/Furgokid-app/docs/privacy-policy.html',
      termsOfServiceUrl:
        'https://christopherzavala.github.io/Furgokid-app/docs/terms-of-service.html',
      SENTRY_DSN: process.env.SENTRY_DSN,
      SENTRY_ENABLED: process.env.SENTRY_ENABLED,
      APP_VARIANT,
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
