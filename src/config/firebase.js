// firebase.js - Configuración de Firebase para FurgoKid
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import { Platform } from 'react-native';

// Configuración de Firebase (reemplazar con tus credenciales reales)
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "furgokid.firebaseapp.com",
  projectId: "furgokid",
  storageBucket: "furgokid.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789012"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios de Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Solo inicializar messaging en dispositivos móviles
let messaging = null;
if (Platform.OS !== 'web') {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.log('Messaging not supported on this device');
  }
}
export { messaging };

export default app;