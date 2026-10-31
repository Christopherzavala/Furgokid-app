// AuthContext.js - Context API for Authentication State Management
import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import { setUserContext } from '../config/sentry';
import analyticsService from '../services/analyticsService';
import notificationService from '../services/notificationService';
import { ensureUserProfile, waitForUserProfile } from '../services/userProfileService';
import { requestDriverApproval } from '../services/driverApprovalService';

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
      data = userProfileDoc.exists() ? userProfileDoc.data() : await ensureUserProfile(uid);
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

      // Sentry user context - CRITICAL FOR ERROR TRACKING
      // Track which user (driver/parent/admin) + school had the error
      setUserContext({
        id: uid,
        role: role,
        schoolId: data?.schoolId || data?.school || undefined,
      });
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
          console.log('No se pudo cargar el perfil');
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

      // Register for push notifications (non-blocking)
      notificationService.registerForPushNotifications(result.user.uid).catch((err) => {
        console.warn('⚠️ Push notification setup failed (non-critical):', err);
      });

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

  const signUp = async (email, password, displayName, requestedRole = 'parent') => {
    try {
      setError(null);
      setLoading(true);

      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Auth displayName is updated after account creation, so it is not
      // available to the beforeUserCreated trigger in this client flow.
      await updateProfile(result.user, { displayName });

      // The trusted trigger creates the initial parent/unapproved profile
      // before the Auth account is committed. Recovery is idempotent and
      // never overwrites an existing profile.
      let profile;
      try {
        profile = await waitForUserProfile(result.user.uid);
      } catch (waitError) {
        profile = await ensureUserProfile(result.user.uid);
      }

      // Enrich the already-created profile without writing privileged fields.
      await updateDoc(doc(db, 'users', result.user.uid), {
        displayName,
        updatedAt: serverTimestamp(),
      });
      profile = {
        ...profile,
        displayName,
      };

      let driverRequestSubmitted = false;
      if (requestedRole === 'driver') {
        try {
          await requestDriverApproval();
          driverRequestSubmitted = true;
          profile = await waitForUserProfile(result.user.uid);
        } catch {
          // The account and safe parent profile remain valid. A later increment
          // can expose a retry action without turning signup into a partial
          // authentication failure.
          console.warn('Driver request could not be submitted');
        }
      }
      setUserProfile(profile);

      // Send email verification
      try {
        await sendEmailVerification(result.user);
        console.log('✅ Email verification sent');
      } catch (emailError) {
        console.warn('⚠️ Failed to send verification email');
        // Don't fail signup if email verification fails
      }

      // Register for push notifications (non-blocking)
      notificationService.registerForPushNotifications(result.user.uid).catch(() => {
        console.warn('⚠️ Push notification setup failed (non-critical)');
      });

      // Track signup event
      await analyticsService.setUserId(result.user.uid);
      await analyticsService.trackSignUp(requestedRole);

      return {
        success: true,
        user: result.user,
        emailVerificationSent: true,
        driverRequestSubmitted,
      };
    } catch (err) {
      console.error('Sign up failed:', err?.code || 'unknown');
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

      const {
        role: _role,
        approved: _approved,
        driverRequestStatus: _driverRequestStatus,
        driverRequestUpdatedAt: _driverRequestUpdatedAt,
        ...safeUpdates
      } = updates;
      const updatedProfile = {
        ...safeUpdates,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'users', user.uid), updatedProfile);
      setUserProfile({
        ...userProfile,
        ...safeUpdates,
      });

      return { success: true };
    } catch (err) {
      console.error('Update profile failed:', err?.code || 'unknown');
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
    reloadUser: async () => {
      if (user) {
        await reload(user);
        setUser({ ...user }); // Trigger re-render
      }
    },
    isAuthenticated: !!user,
    isEmailVerified: user?.emailVerified || false,
    isParent: userProfile?.role === 'parent',
    isDriver: userProfile?.role === 'driver',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
