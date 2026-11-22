/**
 * Alert Preferences Client Service (Ola 4 - #8)
 *
 * Connects frontend Settings to Firestore user document for reading and saving push alert preferences.
 */

import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../config/firebase';

export const DEFAULT_ALERT_PREFERENCES = Object.freeze({
  boardingAlert: true,
  etaProximityAlert: true,
  handoverAlert: true,
  absenceAlert: true,
});

export function resolveAlertPreferences(rawPrefs) {
  if (!rawPrefs || typeof rawPrefs !== 'object') {
    return { ...DEFAULT_ALERT_PREFERENCES };
  }
  return {
    boardingAlert: rawPrefs.boardingAlert !== false,
    etaProximityAlert: rawPrefs.etaProximityAlert !== false,
    handoverAlert: rawPrefs.handoverAlert !== false,
    absenceAlert: rawPrefs.absenceAlert !== false,
  };
}

export const fetchAlertPreferences = async (uid) => {
  if (!uid) return { ...DEFAULT_ALERT_PREFERENCES };
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      return resolveAlertPreferences(data.alertPreferences);
    }
  } catch (err) {
    console.warn('Failed to fetch alert preferences:', err?.message);
  }
  return { ...DEFAULT_ALERT_PREFERENCES };
};

export const saveAlertPreferences = async (preferences) => {
  if (!auth.currentUser) {
    throw new Error('Authentication is required to save alert preferences.');
  }
  const normalized = resolveAlertPreferences(preferences);
  const fn = httpsCallable(functions, 'updateAlertPreferences');
  const result = await fn({ preferences: normalized });
  return result.data?.preferences || normalized;
};
