// AuthContext.js - Context API for Authentication State Management
import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import analyticsService from '../services/analyticsService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUserProfile = async (uid) => {
    const startedAt = Date.now();
    if (!uid) {
      setUserProfile(null);
      return null;
    }

    let data = null;
    try {
      const userProfileDoc = await getDoc(doc(db, 'users', uid));
      data = userProfileDoc.exists() ? userProfileDoc.data() : null;
      setUserProfile(data);
      analyticsService.trackPerformance('auth_load_profile', Date.now() - startedAt, {
        screen: 'Auth',
        role: data?.role || 'unknown',
        ok: true,
      });
    } catch (err) {
      analyticsService.trackPerformance('auth_load_profile', Date.now() - startedAt, {
        screen: 'Auth',
        ok: false,
      });
      analyticsService.trackAppError(err?.message || 'Load profile failed', {
        name: err?.name,
        stack: err?.stack,
        fatal: false,
        tag: 'auth',
        action: 'load_profile',
      });
      throw err;
    }

    // Analytics user binding + segmentation
    try {
      await analyticsService.setUserId(uid);
      const role = data?.role || 'parent';
      await analyticsService.trackUserRole(role);
      const isPremium = Boolean(data?.isPremium || data?.subscriptionActive || data?.noAds);
      await analyticsService.trackUserSegment(isPremium);
    } catch {
      // no-op
    }

    return data;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          await loadUserProfile(firebaseUser.uid);
        } catch (err) {
          console.log('No se pudo cargar perfil:', err);
          setUserProfile(null); // tolera perfil faltante
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      const profile = await loadUserProfile(result.user.uid);

      // Track login event
      const role = profile?.role || 'parent';
      await analyticsService.trackLogin(role);

      return { success: true, user: result.user };
    } catch (err) {
      console.error('Sign in error:', err);
      analyticsService.trackAppError(err?.message || 'Sign in failed', {
        name: err?.name,
        stack: err?.stack,
        fatal: false,
        tag: 'auth',
        action: 'sign_in',
      });
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, displayName, role = 'parent') => {
    try {
      setError(null);
      setLoading(true);

      const result = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(result.user, { displayName });

      const newUserProfile = {
        uid: result.user.uid,
        email,
        displayName,
        role, // 'parent' or 'driver'
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', result.user.uid), newUserProfile);
      setUserProfile(newUserProfile);

      // Track signup event
      await analyticsService.setUserId(result.user.uid);
      await analyticsService.trackSignUp(role);

      return { success: true, user: result.user };
    } catch (err) {
      console.error('Sign up error:', err);
      analyticsService.trackAppError(err?.message || 'Sign up failed', {
        name: err?.name,
        stack: err?.stack,
        fatal: false,
        tag: 'auth',
        action: 'sign_up',
      });
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      return { success: true };
    } catch (err) {
      console.error('Sign out error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const updateUserProfile = async (updates) => {
    try {
      if (!user) throw new Error('No user logged in');

      const updatedProfile = {
        ...userProfile,
        ...updates,
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);

      return { success: true };
    } catch (err) {
      console.error('Update profile error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
    isAuthenticated: !!user,
    isParent: userProfile?.role === 'parent',
    isDriver: userProfile?.role === 'driver',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
