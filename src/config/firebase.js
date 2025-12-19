// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import {
    initializeAuth,
    getReactNativePersistence,
    getAuth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================

// Validar que las variables de entorno existan
const extra = Constants.expoConfig?.extra;

if (!extra) {
    console.error('❌ Error crítico: No se encontró configuración en Constants.expoConfig.extra');
    console.error('Asegúrate de tener un archivo .env y app.config.js configurado correctamente.');
}

const firebaseConfig = {
    apiKey: extra?.firebaseApiKey,
    authDomain: extra?.firebaseAuthDomain,
    projectId: extra?.firebaseProjectId,
    storageBucket: extra?.firebaseStorageBucket,
    messagingSenderId: extra?.firebaseMessagingSenderId,
    appId: extra?.firebaseAppId
};

// ============================================
// INICIALIZAR FIREBASE APP
// ============================================
let app;
try {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado correctamente');
} catch (error) {
    console.error('❌ Error inicializando Firebase. Verifica tus credenciales en el .env:', error);
    throw error;
}

// ============================================
// AUTH CON PERSISTENCIA
// ============================================
let auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log('✅ Firebase Auth con persistencia configurado');
} catch (error) {
    console.log('⚠️ Auth ya inicializado, usando instancia existente');
    auth = getAuth(app);
}

// ============================================
// FIRESTORE & STORAGE
// ============================================
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================
// EXPORTS
// ============================================
export { auth, db, storage };
export default app;

// ============================================
// HELPERS
// ============================================

export const isAuthenticated = () => {
    return auth.currentUser !== null;
};

export const getCurrentUser = () => {
    return auth.currentUser;
};

export const getCurrentUserId = () => {
    return auth.currentUser?.uid || null;
};
