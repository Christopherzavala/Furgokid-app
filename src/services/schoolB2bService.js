/**
 * School B2B & Driver Fleet Management Service (Ola 3 - #1 & #4)
 *
 * Connects frontend screens to Cloud Functions for B2B school registration,
 * driver authorization by school admins, real-time arrival snapshots, and driver fleet verification.
 */

import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../config/firebase';

const assertAuthenticated = () => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required.');
    error.code = 'unauthenticated';
    throw error;
  }
};

export const registerSchoolB2b = async (payload) => {
  assertAuthenticated();
  const fn = httpsCallable(functions, 'registerSchoolB2b');
  const result = await fn(payload);
  return result.data;
};

export const authorizeSchoolDriver = async ({ schoolId, driverId, action }) => {
  assertAuthenticated();
  const fn = httpsCallable(functions, 'authorizeSchoolDriver');
  const result = await fn({ schoolId, driverId, action });
  return result.data;
};

export const fetchSchoolArrivalsSnapshot = async ({ schoolId }) => {
  assertAuthenticated();
  const fn = httpsCallable(functions, 'getSchoolArrivalsSnapshot');
  const result = await fn({ schoolId });
  return result.data;
};

export const upsertDriverFleetAsset = async ({ assetType, payload }) => {
  assertAuthenticated();
  const fn = httpsCallable(functions, 'upsertDriverFleetAsset');
  const result = await fn({ assetType, payload });
  return result.data;
};

export const verifyDriverFleetAsset = async ({ driverId, assetType, assetId, decision }) => {
  assertAuthenticated();
  const fn = httpsCallable(functions, 'verifyDriverFleetAsset');
  const result = await fn({ driverId, assetType, assetId, decision });
  return result.data;
};

export const fetchDriverFleet = async (driverId) => {
  assertAuthenticated();
  if (!driverId) return { vehicles: [], assistants: [] };

  const vehiclesSnap = await getDocs(collection(db, 'driverFleets', driverId, 'vehicles'));
  const assistantsSnap = await getDocs(collection(db, 'driverFleets', driverId, 'assistants'));

  const vehicles = vehiclesSnap.docs.map((docSnap) => docSnap.data());
  const assistants = assistantsSnap.docs.map((docSnap) => docSnap.data());

  return { vehicles, assistants };
};
