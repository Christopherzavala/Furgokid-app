import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth/react-native';
import { getFirestore } from 'firebase/firestore';

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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Inicializar Auth según el entorno
let auth;

if (getApps().length > 0) {
  // Ya fue inicializado anteriormente
  auth = getAuth(app);
} else if (isExpoGo) {
  // En Expo Go: Sin persistencia compilada (causa error)
  // La sesión se mantendrá en memoria durante la sesión actual
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
