import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

// Detecta si estamos en Expo Go (desarrollo)
// En Expo Go no funcionan módulos nativos compilados
const isExpoGo = Constants.executionEnvironment === 'StoreClient';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBuckets: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

if (__DEV__) {
  const missing = Object.entries(firebaseConfig)
    .filter(([_, v]) => !v)
    .map(([k]) => k);
  if (missing.length) console.warn('[Firebase] Env vars faltantes:', missing);
}

const existingApps = getApps();
const isNewApp = existingApps.length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : existingApps[0];

// Inicializar Auth según el entorno
let auth;

if (!isNewApp) {
  // Ya fue inicializado anteriormente
  auth = getAuth(app);
} else if (isExpoGo) {
  // En Expo Go: Sin persistencia compilada (causa error)
  console.log('[Firebase] Expo Go detectado - Auth sin persistencia compilada');
  auth = getAuth(app);
} else {
  // En builds nativos (EAS/APK/AAB): Con persistencia usando AsyncStorage
  // Esto permite mantener la sesión entre reinicios de la app
  console.log('[Firebase] Build nativo - Auth con persistencia AsyncStorage');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { auth };
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Soporte de validación local contra Firebase Emulator Suite (solo pruebas).
// Se activa únicamente con EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true en .env (gitignoreado).
// No modifica el modelo de autorización: los callables y Rules siguen siendo la única vía de acceso.
if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
  const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '10.0.2.2';
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
  console.log(
    `[Firebase] Emuladores locales conectados: auth:9099, firestore:8080, functions:5001 @ ${emulatorHost}`
  );
}
