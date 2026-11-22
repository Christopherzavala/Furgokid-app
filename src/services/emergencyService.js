/**
 * Emergency & SOS Service (Ola 2 - #12)
 *
 * Connects client actions to Cloud Functions for triggering and resolving SOS emergency alerts.
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

export const triggerSosAlert = async ({ matchId, location, reason }) => {
  assertAuthenticated();
  if (!matchId) {
    throw new Error('matchId is required to trigger SOS alert.');
  }
  const triggerSosFn = httpsCallable(functions, 'triggerSosAlert');
  const result = await triggerSosFn({ matchId, location, reason });
  return result.data;
};

export const resolveSosAlert = async ({ incidentId, resolutionNotes }) => {
  assertAuthenticated();
  if (!incidentId) {
    throw new Error('incidentId is required to resolve SOS alert.');
  }
  const resolveSosFn = httpsCallable(functions, 'resolveSosAlert');
  const result = await resolveSosFn({ incidentId, resolutionNotes });
  return result.data;
};
