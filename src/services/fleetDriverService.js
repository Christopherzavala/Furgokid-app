/**
 * Verified Multi-Driver & Rental Fleet Service
 *
 * Connects frontend screens to Cloud Functions for submitting driver verification
 * documents and assigning verified drivers (owner, rental, substitute) to vehicles and matches.
 */

import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';

const assertAuthenticated = () => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required.');
    error.code = 'unauthenticated';
    throw error;
  }
};

/**
 * Submits driver verification documents (Professional License, Criminal Record, Child Inability Registry).
 * @param {Object} params
 * @param {string} [params.targetDriverUid]
 * @param {Object} params.documents
 */
export const submitDriverVerificationDocs = async ({ targetDriverUid, documents } = {}) => {
  assertAuthenticated();
  if (!documents || typeof documents !== 'object') {
    throw new Error('Valid documents object is required.');
  }
  const fn = httpsCallable(functions, 'submitDriverVerificationDocs');
  const result = await fn({ targetDriverUid, documents });
  return result.data;
};

/**
 * Assigns a verified driver (owner, rental, substitute) to a vehicle and match.
 * @param {Object} params
 * @param {string} params.vehicleId
 * @param {string} params.matchId
 * @param {string} params.driverUid
 * @param {'owner'|'rental'|'substitute'} params.assignmentType
 * @param {string} [params.validUntil]
 */
export const assignVerifiedVehicleDriver = async ({
  vehicleId,
  matchId,
  driverUid,
  assignmentType,
  validUntil = null,
} = {}) => {
  assertAuthenticated();
  if (!vehicleId || !matchId || !driverUid || !assignmentType) {
    throw new Error('vehicleId, matchId, driverUid, and assignmentType are required.');
  }
  const fn = httpsCallable(functions, 'assignVerifiedVehicleDriver');
  const result = await fn({
    vehicleId,
    matchId,
    driverUid,
    assignmentType,
    validUntil,
  });
  return result.data;
};
