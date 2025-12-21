import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyC4Qkq7uhLgXtdtmZkpTIeTJlyGq26Kazk",
  authDomain: "furgokid.firebaseapp.com",
  projectId: "furgokid",
  storageBucket: "furgokid.firebasestorage.app",
  messagingSenderId: "1061722538586",
  appId: "1:1061722538586:web:25dba05616d10e86d30e63",
  measurementId: "G-P4QGS8D5JM"
};

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
const db = getFirestore(app);

export { auth, db };
