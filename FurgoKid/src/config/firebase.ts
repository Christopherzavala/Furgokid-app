// Firebase Configuration for FurgoKid
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase Configuration
// IMPORTANT: Replace with your actual Firebase credentials from Firebase Console
// Or better: use environment variables (.env)

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDASJhdpXLU95W4bHWYlMD_5qKsZhxV5xI",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "furgokid.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "furgokid",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "furgokid.appspot.com",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1061722538586",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:1061722538586:android:d7bb00da1e6c334fd30e63"
};

// Initialize Firebase App (only once)
let app: FirebaseApp;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
} else {
    app = getApp();
    console.log('✅ Using existing Firebase instance');
}

// Initialize Auth
const auth: Auth = getAuth(app);

// Initialize Firestore Database
const db: Firestore = getFirestore(app);

// Initialize Firebase Storage
const storage: FirebaseStorage = getStorage(app);

// Exports
export { auth, db, storage };
export default app;

// Helper Functions

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
    return auth.currentUser !== null;
};

/**
 * Get current user
 */
export const getCurrentUser = () => {
    return auth.currentUser;
};

/**
 * Get current user ID
 */
export const getCurrentUserId = (): string | null => {
    return auth.currentUser?.uid || null;
};
